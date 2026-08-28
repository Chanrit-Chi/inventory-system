import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  Platform,
  ActivityIndicator,
  RefreshControl,
} from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { tokens } from '../theme/tokens'
import type { BankAccount, TabType } from '../types'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { bankAccountSchema, BankAccountFormValues } from '../utils/validation'
import { ControlledInput } from '../components/ControlledInput'
import {
  fetchBankAccounts,
  createBankAccount,
  updateBankAccount,
  deleteBankAccount,
  uploadMedia,
} from '../api/endpoints'

export interface BankAccountsScreenProps {
  onNavigate: (tab: TabType) => void
}

export const INITIAL_BANK_ACCOUNTS: BankAccount[] = []

const POPULAR_BANKS = [
  { name: 'ABA Bank', color: '#005F83', icon: 'qr-code' as const },
  { name: 'ACLEDA Bank', color: '#0D3880', icon: 'business' as const },
  { name: 'Wing Bank', color: '#6EBE44', icon: 'phone-portrait' as const },
  { name: 'Canadia Bank', color: '#B91C1C', icon: 'card' as const },
  { name: 'Sathapana Bank', color: '#1E3A8A', icon: 'wallet' as const },
  { name: 'Custom Bank', color: '#475569', icon: 'cash' as const },
]

export const BankAccountsScreen: React.FC<BankAccountsScreenProps> = ({ onNavigate }) => {
  const [accounts, setAccounts] = useState<BankAccount[]>(INITIAL_BANK_ACCOUNTS)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [previewQrModal, setPreviewQrModal] = useState<BankAccount | null>(null)

  // Form State
  const [editingId, setEditingId] = useState<string | null>(null)
  const [qrImageUrl, setQrImageUrl] = useState('')
  const [isDefault, setIsDefault] = useState(false)

  const { control, handleSubmit, reset, watch, setValue } = useForm<BankAccountFormValues>({
    resolver: zodResolver(bankAccountSchema),
    defaultValues: { bankName: 'ABA Bank', accountName: '', accountNumber: '', currency: 'USD', isActive: true }
  })

  const formBankName = watch('bankName')
  const formCurrency = watch('currency')

  const loadAccounts = useCallback(async () => {
    try {
      const res = await fetchBankAccounts({ include_inactive: true })
      if (res.success && Array.isArray(res.data)) {
        setAccounts(res.data)
      }
    } catch (err: unknown) {
      console.warn('Failed to load bank accounts:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    loadAccounts()
  }, [loadAccounts])

  const onRefresh = () => {
    setRefreshing(true)
    loadAccounts()
  }

  const handleOpenAdd = () => {
    setEditingId(null)
    reset({ bankName: 'ABA Bank', accountName: '', accountNumber: '', currency: 'USD', isActive: true })
    setQrImageUrl('')
    setIsDefault(accounts.length === 0)
    setModalVisible(true)
  }

  const handleOpenEdit = (acc: BankAccount) => {
    setEditingId(acc.id)
    reset({
      bankName: acc.bankName,
      accountName: acc.accountName,
      accountNumber: acc.accountNumber,
      currency: acc.currency,
      isActive: acc.isActive
    })
    setQrImageUrl(acc.qrImageUrl || '')
    setIsDefault(!!acc.isDefault)
    setModalVisible(true)
  }

  const onSubmit = async (data: BankAccountFormValues) => {
    const selectedBankMeta = POPULAR_BANKS.find(b => b.name === data.bankName) || {
      color: '#005F83',
      icon: 'business' as const,
    }

    const resolvedQr =
      qrImageUrl.trim() ||
      `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(
        `${data.bankName}:${data.accountNumber}:${data.accountName}`
      )}`

    setSubmitting(true)
    try {
      if (editingId) {
        await updateBankAccount(editingId, {
          bankName: data.bankName,
          accountName: data.accountName.trim().toUpperCase(),
          accountNumber: data.accountNumber.trim(),
          currency: data.currency,
          qrImageUrl: resolvedQr,
          isDefault,
          isActive: data.isActive,
          color: selectedBankMeta.color,
          logoIcon: selectedBankMeta.icon,
        })
        await loadAccounts()
        Alert.alert('Updated', `${data.bankName} details updated successfully.`)
      } else {
        await createBankAccount({
          bankName: data.bankName,
          accountName: data.accountName.trim().toUpperCase(),
          accountNumber: data.accountNumber.trim(),
          currency: data.currency,
          qrImageUrl: resolvedQr,
          isDefault,
          isActive: data.isActive,
          color: selectedBankMeta.color,
          logoIcon: selectedBankMeta.icon,
        })
        await loadAccounts()
        Alert.alert('Bank Added', `${data.bankName} added to your payment options.`)
      }
      setModalVisible(false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save bank account.'
      Alert.alert('Error', msg)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = (id: string, name: string) => {
    Alert.alert('Delete Bank Account', `Are you sure you want to remove ${name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteBankAccount(id)
            await loadAccounts()
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Failed to delete bank account.'
            Alert.alert('Error', msg)
          }
        },
      },
    ])
  }

  const handleToggleDefault = async (id: string) => {
    try {
      await updateBankAccount(id, { isDefault: true })
      await loadAccounts()
    } catch (err: unknown) {
      console.warn('Failed to set default bank account:', err)
    }
  }

  const handleToggleActive = async (acc: BankAccount) => {
    try {
      await updateBankAccount(acc.id, { isActive: !acc.isActive })
      await loadAccounts()
    } catch (err: unknown) {
      console.warn('Failed to toggle bank active status:', err)
    }
  }

  return (
    <View style={styles.container}>
      {/* Header Toolbar */}
      <View style={[styles.header, { justifyContent: 'flex-end', borderBottomWidth: 0, paddingBottom: 0 }]}>
        <TouchableOpacity
          testID="btn-add-bank-account"
          style={styles.addBtn}
          onPress={handleOpenAdd}
          activeOpacity={0.85}
        >
          <Ionicons name="add-circle" size={18} color={tokens.colors.onPrimary} />
          <Text style={styles.addBtnText}>Add Bank</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Notice Info Banner */}
        <View style={styles.infoBanner}>
          <Ionicons name="information-circle" size={20} color="#0284C7" />
          <View style={{ flex: 1 }}>
            <Text style={styles.infoBannerTitle}>Cambodia KHQR & Transfer Ready</Text>
            <Text style={styles.infoBannerText}>
              Accounts set here are instantly selectable at the POS Checkout screen with visual QR codes and quick transfer details.
            </Text>
          </View>
        </View>

        {/* Bank Account Cards List */}
        <View style={styles.cardsContainer}>
          {accounts.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="business-outline" size={48} color={tokens.colors.secondary} />
              <Text style={styles.emptyTitle}>No Bank Accounts</Text>
              <Text style={styles.emptySub}>
                Add a bank account to enable KHQR and bank payments at POS checkout.
              </Text>
            </View>
          ) : (
            accounts.map(acc => {
            const isAba = acc.bankName.includes('ABA')
            const isAcleda = acc.bankName.includes('ACLEDA')
            const isWing = acc.bankName.includes('Wing')

            return (
              <View key={acc.id} style={styles.bankCard}>
                {/* Colored Top Bar */}
                <View
                  style={[
                    styles.bankCardHeader,
                    { backgroundColor: acc.color || tokens.colors.accentBank },
                  ]}
                >
                  <View style={styles.bankHeaderLeft}>
                    <View style={styles.bankIconCircle}>
                      <Ionicons
                        name={
                          isAba
                            ? 'qr-code'
                            : isAcleda
                            ? 'business'
                            : isWing
                            ? 'phone-portrait'
                            : 'card'
                        }
                        size={16}
                        color={tokens.colors.onPrimary}
                      />
                    </View>
                    <Text style={styles.bankNameText}>{acc.bankName}</Text>
                  </View>

                  <View style={styles.bankHeaderRight}>
                    {acc.isDefault ? (
                      <View style={styles.defaultBadge}>
                        <Text style={styles.defaultBadgeText}>PRIMARY POS</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.setDefaultBtn}
                        onPress={() => handleToggleDefault(acc.id)}
                      >
                        <Text style={styles.setDefaultBtnText}>Set Default</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* Card Body */}
                <View style={styles.bankCardBody}>
                  <View style={styles.bankInfoRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.infoFieldLabel}>ACCOUNT NUMBER</Text>
                      <Text style={styles.accountNumberText}>{acc.accountNumber}</Text>

                      <Text style={[styles.infoFieldLabel, { marginTop: 8 }]}>ACCOUNT NAME</Text>
                      <Text style={styles.accountNameText}>{acc.accountName}</Text>

                      <View style={styles.metaPillsRow}>
                        <View style={styles.currencyBadge}>
                          <Text style={styles.currencyBadgeText}>{acc.currency}</Text>
                        </View>
                        <View style={styles.activePill}>
                          <View style={styles.activeDot} />
                          <Text style={styles.activePillText}>ACTIVE</Text>
                        </View>
                      </View>
                    </View>

                    {/* QR Code Preview Thumbnail */}
                    {acc.qrImageUrl ? (
                      <TouchableOpacity
                        style={styles.qrThumbWrap}
                        onPress={() => setPreviewQrModal(acc)}
                        activeOpacity={0.85}
                      >
                        <Image
                          source={{ uri: acc.qrImageUrl }}
                          style={styles.qrThumbnail}
                          resizeMode="cover"
                        />
                        <View style={styles.qrZoomHint}>
                          <Ionicons name="expand" size={12} color="#FFFFFF" />
                        </View>
                      </TouchableOpacity>
                    ) : (
                      <View style={[styles.qrThumbWrap, styles.qrPlaceholder]}>
                        <Ionicons name="qr-code-outline" size={28} color={tokens.colors.textMuted} />
                        <Text style={styles.noQrText}>No QR</Text>
                      </View>
                    )}
                  </View>

                  {/* Card Bottom Actions */}
                  <View style={styles.bankCardActions}>
                    <TouchableOpacity
                      style={styles.actionBtnEdit}
                      onPress={() => handleOpenEdit(acc)}
                    >
                      <Ionicons name="create-outline" size={14} color={tokens.colors.primary} />
                      <Text style={styles.actionBtnEditText}>Edit Details</Text>
                    </TouchableOpacity>

                    {acc.qrImageUrl ? (
                      <TouchableOpacity
                        style={styles.actionBtnQr}
                        onPress={() => setPreviewQrModal(acc)}
                      >
                        <Ionicons name="qr-code-outline" size={14} color="#0284C7" />
                        <Text style={styles.actionBtnQrText}>View QR Code</Text>
                      </TouchableOpacity>
                    ) : null}

                    <TouchableOpacity
                      style={styles.actionBtnDelete}
                      onPress={() => handleDelete(acc.id, acc.bankName)}
                    >
                      <Ionicons name="trash-outline" size={14} color="#DC2626" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )
          }))}
        </View>
      </ScrollView>

      {/* ADD / EDIT MODAL */}
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{editingId ? 'Edit Bank Account' : 'Add Bank Account'}</Text>
                <Text style={styles.modalSub}>Configure bank details for checkout QR and wire info</Text>
              </View>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color={tokens.colors.secondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Select Bank Provider */}
              <Text style={styles.inputLabel}>Bank Provider</Text>
              <View style={styles.bankSelectRow}>
                {POPULAR_BANKS.map(bank => {
                  const isSelected = formBankName === bank.name
                  return (
                    <TouchableOpacity
                      key={bank.name}
                      style={[
                        styles.bankSelectChip,
                        isSelected && { borderColor: bank.color, backgroundColor: `${bank.color}15` },
                      ]}
                      onPress={() => setValue('bankName', bank.name)}
                    >
                      <View style={[styles.bankChipIcon, { backgroundColor: bank.color }]}>
                        <Ionicons name={bank.icon} size={12} color="#FFFFFF" />
                      </View>
                      <Text
                        style={[
                          styles.bankSelectChipText,
                          isSelected && { color: bank.color, fontWeight: '700' },
                        ]}
                      >
                        {bank.name}
                      </Text>
                    </TouchableOpacity>
                  )
                })}
              </View>

              {/* Account Number */}
              <ControlledInput
                name="accountNumber"
                control={control}
                label="Account Number *"
                placeholder="e.g. 001 234 567"
                inputProps={{ keyboardType: 'numeric' }}
              />

              {/* Account Name */}
              <ControlledInput
                name="accountName"
                control={control}
                label="Account Holder Name *"
                placeholder="e.g. KC INVENTORY STORE"
                inputProps={{ autoCapitalize: 'characters' }}
              />

              {/* Currency Selector */}
              <Text style={styles.inputLabel}>Accepted Currency</Text>
              <View style={styles.currencyRow}>
                {(['USD', 'KHR', 'Dual'] as const).map(c => {
                  const isSelected = formCurrency === c
                  return (
                    <TouchableOpacity
                      key={c}
                      style={[styles.currencyBtn, isSelected && styles.currencyBtnActive]}
                      onPress={() => setValue('currency', c)}
                    >
                      <Text style={[styles.currencyBtnText, isSelected && styles.currencyBtnTextActive]}>
                        {c === 'Dual' ? 'Dual ($ & ៛)' : c}
                      </Text>
                    </TouchableOpacity>
                  )
                })}
              </View>

              {/* Optional Custom QR Image */}
              <Text style={styles.inputLabel}>QR Code Image (Optional)</Text>
              <TouchableOpacity
                style={styles.imagePickerBtn}
                onPress={async () => {
                  const result = await ImagePicker.launchImageLibraryAsync({
                    mediaTypes: ImagePicker.MediaTypeOptions.Images,
                    allowsEditing: true,
                    aspect: [1, 1],
                    quality: 0.8,
                  });
                  if (!result.canceled && result.assets && result.assets.length > 0) {
                    setQrImageUrl(result.assets[0].uri);
                  }
                }}
              >
                <Ionicons name="image-outline" size={20} color={tokens.colors.primary} />
                <Text style={styles.imagePickerText}>
                  {qrImageUrl ? 'Change QR Image' : 'Select Image from Phone'}
                </Text>
              </TouchableOpacity>
              {qrImageUrl ? (
                <Image source={{ uri: qrImageUrl }} style={styles.selectedQrImage} resizeMode="contain" />
              ) : null}

              {/* Default Switch */}
              <TouchableOpacity
                style={styles.defaultToggleRow}
                onPress={() => setIsDefault(!isDefault)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={isDefault ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={isDefault ? tokens.colors.primaryContainer : tokens.colors.secondary}
                />
                <Text style={styles.defaultToggleText}>Set as Default Bank Account for POS</Text>
              </TouchableOpacity>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSubmit(onSubmit)}>
                <Text style={styles.saveBtnText}>Save Account</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* FULL QR PREVIEW MODAL */}
      <Modal
        visible={!!previewQrModal}
        animationType="fade"
        transparent
        onRequestClose={() => setPreviewQrModal(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.qrPreviewCard}>
            <View style={styles.qrPreviewHeader}>
              <Text style={styles.qrPreviewTitle}>{previewQrModal?.bankName} KHQR</Text>
              <TouchableOpacity onPress={() => setPreviewQrModal(null)}>
                <Ionicons name="close" size={20} color={tokens.colors.secondary} />
              </TouchableOpacity>
            </View>

            {previewQrModal?.qrImageUrl ? (
              <View style={styles.qrFullWrap}>
                <Image
                  source={{ uri: previewQrModal.qrImageUrl }}
                  style={styles.qrFullImage}
                  resizeMode="contain"
                />
              </View>
            ) : null}

            <Text style={styles.qrAccName}>{previewQrModal?.accountName}</Text>
            <Text style={styles.qrAccNum}>{previewQrModal?.accountNumber}</Text>
            <Text style={styles.qrScanHint}>Customer can scan with any Cambodian banking app</Text>

            <TouchableOpacity
              style={styles.closeQrBtn}
              onPress={() => setPreviewQrModal(null)}
            >
              <Text style={styles.closeQrBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.md,
    backgroundColor: tokens.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderSubtle,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: tokens.colors.onBackground,
  },
  headerSubtitle: {
    fontSize: 11,
    color: tokens.colors.secondary,
    marginTop: 2,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.primaryContainer,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: tokens.borderRadius.pill,
    gap: 6,
    ...tokens.shadows.card,
  },
  addBtnText: {
    color: tokens.colors.onPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: tokens.spacing.md,
    paddingBottom: 40,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#E0F2FE',
    borderRadius: tokens.borderRadius.card,
    padding: 12,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    gap: 10,
    marginBottom: 16,
  },
  infoBannerTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0369A1',
  },
  infoBannerText: {
    fontSize: 11,
    color: '#0C4A6E',
    marginTop: 2,
    lineHeight: 16,
  },
  cardsContainer: {
    gap: 14,
  },
  bankCard: {
    backgroundColor: tokens.colors.surfaceCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    overflow: 'hidden',
    ...tokens.shadows.card,
  },
  bankCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bankHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bankIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bankNameText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  bankHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  defaultBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: tokens.borderRadius.pill,
  },
  defaultBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  setDefaultBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: tokens.borderRadius.pill,
  },
  setDefaultBtnText: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
  },
  bankCardBody: {
    padding: 14,
  },
  bankInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  infoFieldLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: tokens.colors.textMuted,
    letterSpacing: 0.5,
  },
  accountNumberText: {
    fontSize: 16,
    fontWeight: '800',
    color: tokens.colors.onBackground,
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  accountNameText: {
    fontSize: 12,
    fontWeight: '700',
    color: tokens.colors.secondary,
    marginTop: 1,
  },
  metaPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  currencyBadge: {
    backgroundColor: tokens.colors.surfaceMuted,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  currencyBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: tokens.colors.onBackground,
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 4,
  },
  activeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#16A34A',
  },
  activePillText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#15803D',
  },
  qrThumbWrap: {
    width: 68,
    height: 68,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    overflow: 'hidden',
    position: 'relative',
  },
  qrThumbnail: {
    width: '100%',
    height: '100%',
  },
  qrPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.surfaceMuted,
  },
  noQrText: {
    fontSize: 8,
    color: tokens.colors.textMuted,
    fontWeight: '600',
  },
  qrZoomHint: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 4,
    padding: 2,
  },
  bankCardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.borderSubtle,
  },
  actionBtnEdit: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.surfaceMuted,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: tokens.borderRadius.pill,
    gap: 4,
  },
  actionBtnEditText: {
    fontSize: 11,
    fontWeight: '700',
    color: tokens.colors.primary,
  },
  actionBtnQr: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: tokens.borderRadius.pill,
    gap: 4,
  },
  actionBtnQrText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0369A1',
  },
  actionBtnDelete: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: tokens.borderRadius.pill,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    padding: tokens.spacing.md,
  },
  imagePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    borderStyle: 'dashed',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  imagePickerText: {
    fontSize: 13,
    fontWeight: '600',
    color: tokens.colors.primary,
  },
  selectedQrImage: {
    width: 120,
    height: 120,
    borderRadius: 8,
    alignSelf: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
  },
  modalContainer: {
    backgroundColor: tokens.colors.surfaceCard,
    borderRadius: 20,
    maxHeight: '85%',
    overflow: 'hidden',
    ...tokens.shadows.cardElevated,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderSubtle,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: tokens.colors.onBackground,
  },
  modalSub: {
    fontSize: 11,
    color: tokens.colors.secondary,
    marginTop: 1,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalBody: {
    padding: 16,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: tokens.colors.onBackground,
    marginBottom: 6,
    marginTop: 10,
  },
  bankSelectRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  bankSelectChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: tokens.borderRadius.pill,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    backgroundColor: tokens.colors.surfaceMuted,
    gap: 6,
  },
  bankChipIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bankSelectChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: tokens.colors.onBackground,
  },
  textInput: {
    backgroundColor: tokens.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    borderRadius: tokens.borderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: tokens.colors.onBackground,
  },
  currencyRow: {
    flexDirection: 'row',
    gap: 8,
  },
  currencyBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: tokens.colors.surfaceMuted,
    borderRadius: tokens.borderRadius.md,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
  },
  currencyBtnActive: {
    backgroundColor: tokens.colors.primaryFixed,
    borderColor: tokens.colors.primaryContainer,
  },
  currencyBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: tokens.colors.secondary,
  },
  currencyBtnTextActive: {
    color: tokens.colors.primary,
    fontWeight: '800',
  },
  defaultToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    marginBottom: 10,
  },
  defaultToggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: tokens.colors.onBackground,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.borderSubtle,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: tokens.borderRadius.pill,
    backgroundColor: tokens.colors.surfaceMuted,
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.secondary,
  },
  saveBtn: {
    flex: 1.5,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: tokens.borderRadius.pill,
    backgroundColor: tokens.colors.primaryContainer,
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.onPrimary,
  },
  qrPreviewCard: {
    backgroundColor: tokens.colors.surfaceCard,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    ...tokens.shadows.cardElevated,
  },
  qrPreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 14,
  },
  qrPreviewTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: tokens.colors.onBackground,
  },
  qrFullWrap: {
    width: 220,
    height: 220,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    padding: 8,
  },
  qrFullImage: {
    width: '100%',
    height: '100%',
  },
  qrAccName: {
    fontSize: 14,
    fontWeight: '800',
    color: tokens.colors.onBackground,
    marginTop: 14,
    textAlign: 'center',
  },
  qrAccNum: {
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.primary,
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  qrScanHint: {
    fontSize: 10,
    color: tokens.colors.textMuted,
    marginTop: 6,
    textAlign: 'center',
  },
  closeQrBtn: {
    marginTop: 16,
    backgroundColor: tokens.colors.surfaceMuted,
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: tokens.borderRadius.pill,
  },
  closeQrBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: tokens.colors.onBackground,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: tokens.colors.onBackground,
  },
  emptySub: {
    fontSize: 12,
    color: tokens.colors.secondary,
    textAlign: 'center',
    maxWidth: 260,
  },
})

export default BankAccountsScreen
