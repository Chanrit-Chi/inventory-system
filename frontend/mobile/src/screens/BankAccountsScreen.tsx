import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../theme/tokens'
import type { BankAccount, TabType } from '../types'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { bankAccountSchema, BankAccountFormValues } from '../utils/validation'
import {
  fetchBankAccounts,
  createBankAccount,
  updateBankAccount,
  deleteBankAccount,
} from '../api/endpoints'
import { useToast } from '../context/ToastContext'
import { styles } from './bank_accounts/BankAccountsScreen.styles'
import {
  INITIAL_BANK_ACCOUNTS,
  POPULAR_BANKS,
} from './bank_accounts/bankAccountUtils'
import { BankAccountCardItem } from './bank_accounts/components/BankAccountCardItem'
import { BankAccountFormModal } from './bank_accounts/components/BankAccountFormModal'
import { BankAccountQrPreviewModal } from './bank_accounts/components/BankAccountQrPreviewModal'

export interface BankAccountsScreenProps {
  onNavigate: (tab: TabType) => void
}

export const BankAccountsScreen: React.FC<BankAccountsScreenProps> = () => {
  const { showToast } = useToast()
  const [accounts, setAccounts] = useState<BankAccount[]>(INITIAL_BANK_ACCOUNTS)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [previewQrModal, setPreviewQrModal] = useState<BankAccount | null>(null)

  // Form State
  const [editingId, setEditingId] = useState<string | null>(null)
  const [qrImageUrl, setQrImageUrl] = useState('')
  const [isDefault, setIsDefault] = useState(false)

  const { control, handleSubmit, reset, watch, setValue } = useForm<BankAccountFormValues>({
    resolver: zodResolver(bankAccountSchema),
    defaultValues: {
      bankName: 'ABA Bank',
      accountName: '',
      accountNumber: '',
      currency: 'USD',
      isActive: true,
    },
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
    reset({
      bankName: 'ABA Bank',
      accountName: '',
      accountNumber: '',
      currency: 'USD',
      isActive: true,
    })
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
      isActive: acc.isActive,
    })
    setQrImageUrl(acc.qrImageUrl || '')
    setIsDefault(Boolean(acc.isDefault))
    setModalVisible(true)
  }

  const onSubmit = async (data: BankAccountFormValues) => {
    const selectedBankMeta = POPULAR_BANKS.find((b) => b.name === data.bankName) || {
      color: '#005F83',
      icon: 'business' as const,
    }

    const resolvedQr =
      qrImageUrl.trim() ||
      `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(
        `${data.bankName}:${data.accountNumber}:${data.accountName}`
      )}`

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
        showToast(`${data.bankName} updated.`, 'success')
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
        showToast(`${data.bankName} added to payment options.`, 'success')
      }
      setModalVisible(false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save bank account.'
      showToast(msg, 'error')
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
            showToast(`${name} removed.`, 'success')
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Failed to delete bank account.'
            showToast(msg, 'error')
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

  return (
    <View style={styles.container}>
      {/* Header Toolbar */}
      <View
        style={[
          styles.header,
          { justifyContent: 'flex-end', borderBottomWidth: 0, paddingBottom: 0 },
        ]}
      >
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
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
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
          {accounts.length === 0 && !loading ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="business-outline" size={48} color={tokens.colors.secondary} />
              <Text style={styles.emptyTitle}>No Bank Accounts</Text>
              <Text style={styles.emptySub}>
                Add a bank account to enable KHQR and bank payments at POS checkout.
              </Text>
            </View>
          ) : (
            accounts.map((acc) => (
              <BankAccountCardItem
                key={acc.id}
                account={acc}
                onSetDefault={handleToggleDefault}
                onOpenEdit={handleOpenEdit}
                onOpenQrPreview={setPreviewQrModal}
                onDelete={handleDelete}
              />
            ))
          )}
        </View>
      </ScrollView>

      {/* ADD / EDIT MODAL */}
      <BankAccountFormModal
        visible={modalVisible}
        editingId={editingId}
        control={control}
        setValue={setValue}
        formBankName={formBankName}
        formCurrency={formCurrency}
        qrImageUrl={qrImageUrl}
        setQrImageUrl={setQrImageUrl}
        isDefault={isDefault}
        setIsDefault={setIsDefault}
        onClose={() => setModalVisible(false)}
        onSubmit={handleSubmit(onSubmit)}
      />

      {/* FULL QR PREVIEW MODAL */}
      <BankAccountQrPreviewModal
        account={previewQrModal}
        onClose={() => setPreviewQrModal(null)}
      />
    </View>
  )
}

export default BankAccountsScreen
