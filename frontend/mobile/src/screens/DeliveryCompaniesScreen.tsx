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
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../theme/tokens'
import type { DeliveryCompany, TabType } from '../types'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { deliveryCompanySchema, DeliveryCompanyFormValues } from '../utils/validation'
import { ControlledInput } from '../components/ControlledInput'
import {
  fetchDeliveryCompanies,
  createDeliveryCompany,
  updateDeliveryCompany,
  deleteDeliveryCompany,
} from '../api/endpoints'
import { useToast } from '../context/ToastContext'

export interface DeliveryCompaniesScreenProps {
  onNavigate: (tab: TabType) => void
}

export const INITIAL_DELIVERY_COMPANIES: DeliveryCompany[] = []

const COLOR_OPTIONS = [
  '#DC2626', // Red (J&T)
  '#0284C7', // Sky Blue (VET)
  '#16A34A', // Green (Grab)
  '#EAB308', // Yellow
  '#8B5CF6', // Purple
  '#EA580C', // Orange
  '#475569', // Slate
]

const ICON_OPTIONS: { icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { icon: 'car', label: 'Truck / Car' },
  { icon: 'bicycle', label: 'Bike' },
  { icon: 'airplane', label: 'Air Freight' },
  { icon: 'boat', label: 'Boat' },
]

export const DeliveryCompaniesScreen: React.FC<DeliveryCompaniesScreenProps> = ({ onNavigate }) => {
  const { showToast } = useToast()
  const [companies, setCompanies] = useState<DeliveryCompany[]>(INITIAL_DELIVERY_COMPANIES)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)

  // Form State
  const [editingId, setEditingId] = useState<string | null>(null)
  const [selectedColor, setSelectedColor] = useState(COLOR_OPTIONS[0])
  const [selectedIcon, setSelectedIcon] = useState<keyof typeof Ionicons.glyphMap>('car')
  const [isDefault, setIsDefault] = useState(false)

  const { control, handleSubmit, reset } = useForm<DeliveryCompanyFormValues>({
    resolver: zodResolver(deliveryCompanySchema),
    defaultValues: { name: '', phone: '', notes: '', isActive: true }
  })

  const loadCompanies = useCallback(async () => {
    try {
      const res = await fetchDeliveryCompanies({ include_inactive: true })
      if (res.success && Array.isArray(res.data)) {
        setCompanies(res.data)
      }
    } catch (err: unknown) {
      console.warn('Failed to load delivery companies:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    loadCompanies()
  }, [loadCompanies])

  const onRefresh = () => {
    setRefreshing(true)
    loadCompanies()
  }

  const handleOpenAdd = () => {
    setEditingId(null)
    reset({ name: '', phone: '', notes: '', isActive: true })
    setSelectedColor(COLOR_OPTIONS[0])
    setSelectedIcon('car')
    setIsDefault(companies.length === 0)
    setModalVisible(true)
  }

  const handleOpenEdit = (comp: DeliveryCompany) => {
    setEditingId(comp.id)
    reset({
      name: comp.name,
      phone: comp.phone || '',
      notes: comp.notes || '',
      isActive: comp.isActive,
    })
    setSelectedColor(comp.color || COLOR_OPTIONS[0])
    setSelectedIcon((comp.logoIcon as keyof typeof Ionicons.glyphMap) || 'car')
    setIsDefault(!!comp.isDefault)
    setModalVisible(true)
  }

  const onSubmit = async (data: DeliveryCompanyFormValues) => {
    setSubmitting(true)
    try {
      if (editingId) {
        const payload: Partial<DeliveryCompany> = {
          name: data.name.trim(),
          phone: data.phone?.trim() || undefined,
          color: selectedColor,
          logoIcon: selectedIcon,
          notes: data.notes?.trim() || undefined,
          isActive: data.isActive,
          isDefault,
        }
        await updateDeliveryCompany(editingId, payload)
        await loadCompanies()
        showToast(`Delivery company "${data.name}" updated.`, 'success')
      } else {
        const payload: Partial<DeliveryCompany> = {
          name: data.name.trim(),
          phone: data.phone?.trim() || undefined,
          color: selectedColor,
          logoIcon: selectedIcon,
          notes: data.notes?.trim() || undefined,
          isActive: data.isActive,
          isDefault,
        }
        await createDeliveryCompany(payload)
        await loadCompanies()
        showToast(`"${data.name}" added to delivery partners.`, 'success')
      }
      setModalVisible(false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save delivery company.'
      showToast(msg, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = (id: string, compName: string) => {
    Alert.alert('Delete Delivery Partner', `Are you sure you want to remove ${compName}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteDeliveryCompany(id)
            await loadCompanies()
            showToast(`${compName} removed.`, 'success')
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Failed to delete delivery company.'
            showToast(msg, 'error')
          }
        },
      },
    ])
  }

  const handleToggleDefault = async (id: string) => {
    try {
      await updateDeliveryCompany(id, { isDefault: true })
      await loadCompanies()
    } catch (err: unknown) {
      console.warn('Failed to update default company:', err)
    }
  }

  const handleToggleActive = async (comp: DeliveryCompany) => {
    try {
      await updateDeliveryCompany(comp.id, { isActive: !comp.isActive })
      await loadCompanies()
    } catch (err: unknown) {
      console.warn('Failed to toggle company active status:', err)
    }
  }

  return (
    <View style={styles.container}>
      {/* Header Toolbar */}
      <View style={[styles.header, { justifyContent: 'flex-end', borderBottomWidth: 0, paddingBottom: 0 }]}>
        <TouchableOpacity
          testID="btn-add-delivery-company"
          style={styles.addBtn}
          onPress={handleOpenAdd}
          activeOpacity={0.85}
        >
          <Ionicons name="add-circle" size={18} color={tokens.colors.onPrimary} />
          <Text style={styles.addBtnText}>Add Partner</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Info Banner */}
        <View style={styles.infoBanner}>
          <Ionicons name="information-circle" size={20} color="#0284C7" />
          <View style={{ flex: 1 }}>
            <Text style={styles.infoBannerTitle}>POS Shipping Integration</Text>
            <Text style={styles.infoBannerText}>
              Delivery partners listed here are selectable at POS checkout to record customer delivery preferences and addresses.
            </Text>
          </View>
        </View>

        {/* Company Cards List */}
        <View style={styles.cardsContainer}>
          {companies.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="car-outline" size={48} color={tokens.colors.secondary} />
              <Text style={styles.emptyTitle}>No Delivery Partners</Text>
              <Text style={styles.emptySub}>
                Add a delivery company to select shipping partners at POS checkout.
              </Text>
            </View>
          ) : (
            companies.map(comp => {
            const iconName = (comp.logoIcon as keyof typeof Ionicons.glyphMap) || 'car'
            const compColor = comp.color || '#DC2626'

            return (
              <View key={comp.id} style={styles.companyCard}>
                {/* Header bar */}
                <View style={[styles.cardHeader, { backgroundColor: compColor }]}>
                  <View style={styles.cardHeaderLeft}>
                    <View style={styles.iconCircle}>
                      <Ionicons name={iconName} size={18} color="#FFFFFF" />
                    </View>
                    <Text style={styles.companyNameText}>{comp.name}</Text>
                  </View>

                  <View style={styles.cardHeaderRight}>
                    {comp.isDefault ? (
                      <View style={styles.defaultBadge}>
                        <Text style={styles.defaultBadgeText}>DEFAULT</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.setDefaultBtn}
                        onPress={() => handleToggleDefault(comp.id)}
                      >
                        <Text style={styles.setDefaultBtnText}>Set Default</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* Card Body */}
                <View style={styles.cardBody}>
                  {comp.phone ? (
                    <View style={styles.infoRow}>
                      <Ionicons name="call-outline" size={15} color={tokens.colors.secondary} />
                      <Text style={styles.infoPhoneText}>{comp.phone}</Text>
                    </View>
                  ) : null}

                  {comp.notes ? (
                    <View style={[styles.infoRow, { marginTop: comp.phone ? 6 : 0 }]}>
                      <Ionicons name="document-text-outline" size={15} color={tokens.colors.textMuted} />
                      <Text style={styles.infoNotesText} numberOfLines={2}>
                        {comp.notes}
                      </Text>
                    </View>
                  ) : null}

                  <View style={styles.metaRow}>
                    <View style={styles.activePill}>
                      <View style={styles.activeDot} />
                      <Text style={styles.activePillText}>AVAILABLE IN POS</Text>
                    </View>
                  </View>

                  {/* Actions */}
                  <View style={styles.cardActions}>
                    <TouchableOpacity
                      style={styles.actionBtnEdit}
                      onPress={() => handleOpenEdit(comp)}
                    >
                      <Ionicons name="create-outline" size={14} color={tokens.colors.primary} />
                      <Text style={styles.actionBtnEditText}>Edit</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.actionBtnDelete}
                      onPress={() => handleDelete(comp.id, comp.name)}
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
                <Text style={styles.modalTitle}>
                  {editingId ? 'Edit Delivery Partner' : 'Add Delivery Partner'}
                </Text>
                <Text style={styles.modalSub}>Configure service name & hotline for checkout</Text>
              </View>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color={tokens.colors.secondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Company Name */}
              <ControlledInput
                name="name"
                control={control}
                label="Company Name *"
                placeholder="e.g. J&T Express, VET Express"
              />

              {/* Phone / Hotline */}
              <ControlledInput
                name="phone"
                control={control}
                label="Support Hotline / Phone"
                placeholder="e.g. 023 901 888"
                inputProps={{ keyboardType: 'phone-pad' }}
              />

              {/* Icon Selector */}
              <Text style={styles.inputLabel}>Vehicle / Delivery Type</Text>
              <View style={styles.iconSelectRow}>
                {ICON_OPTIONS.map(opt => {
                  const isSelected = selectedIcon === opt.icon
                  return (
                    <TouchableOpacity
                      key={opt.icon}
                      style={[
                        styles.iconSelectChip,
                        isSelected && styles.iconSelectChipActive,
                      ]}
                      onPress={() => setSelectedIcon(opt.icon)}
                    >
                      <Ionicons
                        name={opt.icon}
                        size={16}
                        color={isSelected ? tokens.colors.primaryContainer : tokens.colors.secondary}
                      />
                      <Text
                        style={[
                          styles.iconSelectChipText,
                          isSelected && styles.iconSelectChipTextActive,
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  )
                })}
              </View>

              {/* Theme Color */}
              <Text style={styles.inputLabel}>Brand Color</Text>
              <View style={styles.colorRow}>
                {COLOR_OPTIONS.map(c => {
                  const isSelected = selectedColor === c
                  return (
                    <TouchableOpacity
                      key={c}
                      style={[
                        styles.colorCircle,
                        { backgroundColor: c },
                        isSelected && styles.colorCircleSelected,
                      ]}
                      onPress={() => setSelectedColor(c)}
                    >
                      {Boolean(isSelected) && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                    </TouchableOpacity>
                  )
                })}
              </View>

              {/* Notes */}
              <ControlledInput
                name="notes"
                control={control}
                label="Coverage / Service Notes (Optional)"
                placeholder="e.g. 25 provinces, depot drop-off"
                inputProps={{ multiline: true, style: { height: 64 } }}
              />

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
                <Text style={styles.defaultToggleText}>Set as Default Delivery Service in POS</Text>
              </TouchableOpacity>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSubmit(onSubmit)}>
                <Text style={styles.saveBtnText}>Save Partner</Text>
              </TouchableOpacity>
            </View>
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
    gap: 12,
  },
  companyCard: {
    backgroundColor: tokens.colors.surfaceCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    overflow: 'hidden',
    ...tokens.shadows.card,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  companyNameText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  cardHeaderRight: {
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
  cardBody: {
    padding: 14,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoPhoneText: {
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.onBackground,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  infoNotesText: {
    fontSize: 11,
    color: tokens.colors.secondary,
    flex: 1,
    lineHeight: 16,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
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
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.borderSubtle,
  },
  actionBtnEdit: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.surfaceMuted,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: tokens.borderRadius.pill,
    gap: 4,
  },
  actionBtnEditText: {
    fontSize: 11,
    fontWeight: '700',
    color: tokens.colors.primary,
  },
  actionBtnDelete: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: tokens.borderRadius.pill,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    padding: tokens.spacing.md,
  },
  modalContainer: {
    backgroundColor: tokens.colors.surfaceCard,
    borderRadius: 20,
    maxHeight: '90%',
    overflow: 'hidden',
    ...tokens.shadows.modal,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: tokens.spacing.md,
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
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalBody: {
    padding: tokens.spacing.md,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: tokens.colors.onBackground,
    marginBottom: 6,
    marginTop: 10,
  },
  textInput: {
    backgroundColor: tokens.colors.surfaceMuted,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: tokens.colors.onBackground,
  },
  iconSelectRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  iconSelectChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: tokens.borderRadius.pill,
    gap: 6,
  },
  iconSelectChipActive: {
    borderColor: tokens.colors.primaryContainer,
    backgroundColor: tokens.colors.actionPrimaryBg,
  },
  iconSelectChipText: {
    fontSize: 11,
    color: tokens.colors.secondary,
    fontWeight: '600',
  },
  iconSelectChipTextActive: {
    color: tokens.colors.primaryContainer,
    fontWeight: '700',
  },
  colorRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  colorCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorCircleSelected: {
    borderWidth: 3,
    borderColor: '#FFFFFF',
    ...tokens.shadows.card,
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
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    padding: tokens.spacing.md,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.borderSubtle,
    backgroundColor: tokens.colors.surfaceCard,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: tokens.borderRadius.pill,
    backgroundColor: tokens.colors.surfaceMuted,
  },
  cancelBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: tokens.colors.secondary,
  },
  saveBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: tokens.borderRadius.pill,
    backgroundColor: tokens.colors.primaryContainer,
    ...tokens.shadows.card,
  },
  saveBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: tokens.colors.onPrimary,
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

export default DeliveryCompaniesScreen
