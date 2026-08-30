import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  Platform,
  ActivityIndicator,
  RefreshControl,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../theme/tokens'
import type { DeliveryZone, TabType } from '../types'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { deliveryZoneSchema, DeliveryZoneFormValues } from '../utils/validation'
import { ControlledInput } from '../components/ControlledInput'
import {
  fetchDeliveryZones,
  createDeliveryZone,
  updateDeliveryZone,
  deleteDeliveryZone,
} from '../api/endpoints'
import { useToast } from '../context/ToastContext'

export interface DeliveryZonesScreenProps {
  onNavigate: (tab: TabType) => void
}

export const INITIAL_DELIVERY_ZONES: DeliveryZone[] = []

const ZONE_COLORS = [
  { bg: '#FFF3E0', icon: '#FF8800', border: '#FFB781' },
  { bg: '#E0F2FE', icon: '#0284C7', border: '#7DD3FC' },
  { bg: '#F0FDF4', icon: '#16A34A', border: '#86EFAC' },
  { bg: '#F5F3FF', icon: '#7C3AED', border: '#C4B5FD' },
  { bg: '#FFF1F2', icon: '#E11D48', border: '#FDA4AF' },
  { bg: '#FFFBEB', icon: '#B45309', border: '#FCD34D' },
]

export const DeliveryZonesScreen: React.FC<DeliveryZonesScreenProps> = ({ onNavigate }) => {
  const { showToast } = useToast()
  const [zones, setZones] = useState<DeliveryZone[]>(INITIAL_DELIVERY_ZONES)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isDefault, setIsDefault] = useState(false)

  const { control, handleSubmit, reset } = useForm<DeliveryZoneFormValues>({
    resolver: zodResolver(deliveryZoneSchema),
    defaultValues: { name: '', cost: '', isActive: true },
  })

  const loadZones = useCallback(async () => {
    try {
      const res = await fetchDeliveryZones({ include_inactive: true })
      if (res.success && Array.isArray(res.data)) {
        setZones(res.data)
      }
    } catch (err: unknown) {
      console.warn('Failed to load delivery zones:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    loadZones()
  }, [loadZones])

  const onRefresh = () => {
    setRefreshing(true)
    loadZones()
  }

  const handleOpenAdd = () => {
    setEditingId(null)
    reset({ name: '', cost: '', isActive: true })
    setIsDefault(zones.length === 0)
    setModalVisible(true)
  }

  const handleOpenEdit = (zone: DeliveryZone) => {
    setEditingId(zone.id)
    reset({ name: zone.name, cost: String(zone.cost ?? '0'), isActive: zone.isActive })
    setIsDefault(!!zone.isDefault)
    setModalVisible(true)
  }

  const onSubmit = async (data: DeliveryZoneFormValues) => {
    const costValue = parseFloat(data.cost)
    setSubmitting(true)
    try {
      if (editingId) {
        await updateDeliveryZone(editingId, {
          name: data.name.trim(),
          cost: costValue,
          isActive: data.isActive,
          isDefault,
        })
        await loadZones()
        showToast(`Delivery zone "${data.name}" updated.`, 'success')
      } else {
        await createDeliveryZone({
          name: data.name.trim(),
          cost: costValue,
          isActive: data.isActive,
          isDefault,
        })
        await loadZones()
        showToast(`"${data.name}" added to delivery zones.`, 'success')
      }
      setModalVisible(false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save delivery zone.'
      showToast(msg, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = (id: string, zoneName: string) => {
    Alert.alert('Delete Zone', `Remove "${zoneName}" from delivery zones?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteDeliveryZone(id)
            await loadZones()
            showToast(`${zoneName} removed.`, 'success')
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Failed to delete delivery zone.'
            showToast(msg, 'error')
          }
        },
      },
    ])
  }

  const handleToggleDefault = async (id: string) => {
    try {
      await updateDeliveryZone(id, { isDefault: true })
      await loadZones()
    } catch (err: unknown) {
      console.warn('Failed to set default zone:', err)
    }
  }

  const handleToggleActive = async (zone: DeliveryZone) => {
    try {
      await updateDeliveryZone(zone.id, { isActive: !zone.isActive })
      await loadZones()
    } catch (err: unknown) {
      console.warn('Failed to toggle zone active status:', err)
    }
  }

  return (
    <View style={styles.container}>

      {/* ── Toolbar (Add button only — mirrors Bank screen) ── */}
      <View style={styles.toolbar}>
        <TouchableOpacity
          testID="btn-add-delivery-zone"
          style={styles.addBtn}
          onPress={handleOpenAdd}
          activeOpacity={0.85}
        >
          <Ionicons name="add-circle" size={18} color={tokens.colors.onPrimary} />
          <Text style={styles.addBtnText}>Add Zone</Text>
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
            <Text style={styles.infoBannerTitle}>Delivery Zone Pricing</Text>
            <Text style={styles.infoBannerText}>
              Zones defined here are selectable at POS Checkout. The default zone is pre-selected automatically.
            </Text>
          </View>
        </View>

        {/* Zone Cards */}
        <View style={styles.cardsContainer}>
          {zones.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="map-outline" size={48} color={tokens.colors.secondary} />
              <Text style={styles.emptyTitle}>No Delivery Zones</Text>
              <Text style={styles.emptySub}>
                Add a delivery zone and pricing to calculate delivery fees at checkout.
              </Text>
            </View>
          ) : (
            zones.map((zone, idx) => {
            const accent = ZONE_COLORS[idx % ZONE_COLORS.length]
            return (
              <View key={zone.id} style={[styles.zoneCard, !zone.isActive && styles.zoneCardInactive]}>

                {/* Coloured header bar — matches bank card pattern */}
                <View style={[styles.zoneCardHeader, { backgroundColor: accent.icon }]}>
                  <View style={styles.zoneHeaderLeft}>
                    <View style={styles.zoneIconCircle}>
                      <Ionicons name="location" size={16} color={tokens.colors.onPrimary} />
                    </View>
                    <Text style={styles.zoneNameText} numberOfLines={1}>{zone.name}</Text>
                  </View>

                  <View style={styles.zoneHeaderRight}>
                    {zone.isDefault ? (
                      <View style={styles.defaultBadge}>
                        <Text style={styles.defaultBadgeText}>DEFAULT</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.setDefaultBtn}
                        onPress={() => handleToggleDefault(zone.id)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.setDefaultBtnText}>Set Default</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* Card body */}
                <View style={styles.zoneCardBody}>
                  <View style={styles.zoneInfoRow}>
                    <View style={{ flex: 1, gap: 10 }}>
                      {/* Cost */}
                      <View>
                        <Text style={styles.infoFieldLabel}>DELIVERY COST</Text>
                        <Text style={styles.costValueText}>${zone.cost.toFixed(2)}</Text>
                      </View>

                      {/* Status pills */}
                      <View style={styles.metaPillsRow}>
                        <View style={[styles.statusPill, zone.isActive ? styles.statusPillActive : styles.statusPillInactive]}>
                          <View style={[styles.statusDot, zone.isActive ? styles.statusDotActive : styles.statusDotInactive]} />
                          <Text style={[styles.statusPillText, zone.isActive ? styles.statusPillTextActive : styles.statusPillTextInactive]}>
                            {zone.isActive ? 'ACTIVE' : 'INACTIVE'}
                          </Text>
                        </View>
                        {Boolean(zone.isDefault) && (
                          <View style={styles.defaultSmallPill}>
                            <Ionicons name="star" size={9} color="#16A34A" />
                            <Text style={styles.defaultSmallPillText}>Default Zone</Text>
                          </View>
                        )}
                      </View>
                    </View>

                    {/* Right: large cost display */}
                    <View style={[styles.costDisplay, { backgroundColor: accent.bg, borderColor: accent.border }]}>
                      <Ionicons name="pricetag" size={18} color={accent.icon} />
                      <Text style={[styles.costDisplayValue, { color: accent.icon }]}>
                        ${(parseFloat(String(zone.cost || '0')) || 0).toFixed(2)}
                      </Text>
                      <Text style={[styles.costDisplayLabel, { color: accent.icon }]}>per delivery</Text>
                    </View>
                  </View>

                  {/* Card actions — mirrors bank card */}
                  <View style={styles.zoneCardActions}>
                    <TouchableOpacity
                      style={styles.actionBtnEdit}
                      onPress={() => handleOpenEdit(zone)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="create-outline" size={14} color={tokens.colors.primary} />
                      <Text style={styles.actionBtnEditText}>Edit Zone</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.actionBtnToggle}
                      onPress={() => handleToggleActive(zone)}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name={zone.isActive ? 'pause-circle-outline' : 'play-circle-outline'}
                        size={14}
                        color={zone.isActive ? tokens.colors.statusWarning : tokens.colors.statusSuccess}
                      />
                      <Text style={[styles.actionBtnToggleText, { color: zone.isActive ? tokens.colors.statusWarning : tokens.colors.statusSuccess }]}>
                        {zone.isActive ? 'Deactivate' : 'Activate'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.actionBtnDelete}
                      onPress={() => handleDelete(zone.id, zone.name)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="trash-outline" size={14} color={tokens.colors.statusError} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )
          }))}
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* ── Add / Edit Modal ── */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{editingId ? 'Edit Delivery Zone' : 'Add Delivery Zone'}</Text>
                <Text style={styles.modalSub}>Configure zone name and delivery fee</Text>
              </View>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.modalCloseBtn} activeOpacity={0.7}>
                <Ionicons name="close" size={20} color={tokens.colors.secondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <ControlledInput
                name="name"
                control={control}
                label="Zone Name *"
                placeholder="e.g. Phnom Penh, Province"
              />

              <ControlledInput
                name="cost"
                control={control}
                label="Delivery Cost (USD) *"
                placeholder="e.g. 1.50"
                inputProps={{ keyboardType: 'numeric' }}
              />

              {/* Default toggle — same checkbox style as bank screen */}
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
                <Text style={styles.defaultToggleText}>Set as default zone for POS checkout</Text>
              </TouchableOpacity>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)} activeOpacity={0.8}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSubmit(onSubmit)} activeOpacity={0.85}>
                <Text style={styles.saveBtnText}>{editingId ? 'Update Zone' : 'Add Zone'}</Text>
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

  // ── Toolbar ───────────────────────────────────────────
  toolbar: {
    justifyContent: 'flex-end',
    flexDirection: 'row',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm + 4,
    borderBottomWidth: 0,
    backgroundColor: tokens.colors.background,
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
    fontWeight: '700',
    fontSize: 12,
  },

  // ── Scroll ────────────────────────────────────────────
  scrollArea: { flex: 1 },
  scrollContent: {
    padding: tokens.spacing.md,
    gap: tokens.spacing.md,
  },

  // ── Info Banner ───────────────────────────────────────
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spacing.sm,
    backgroundColor: tokens.colors.surfaceCard,
    borderRadius: tokens.borderRadius.md,
    padding: tokens.spacing.md,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
  },
  infoBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.onBackground,
    marginBottom: 2,
  },
  infoBannerText: {
    fontSize: 12,
    color: tokens.colors.secondary,
    lineHeight: 17,
  },

  // ── Cards container ───────────────────────────────────
  cardsContainer: {
    gap: tokens.spacing.md,
  },

  // ── Zone card ─────────────────────────────────────────
  zoneCard: {
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.borderRadius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: tokens.colors.border,
    ...tokens.shadows.card,
  },
  zoneCardInactive: {
    opacity: 0.6,
  },

  // Header bar (coloured — mirrors bank card)
  zoneCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm + 2,
  },
  zoneHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    flex: 1,
  },
  zoneIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoneNameText: {
    color: tokens.colors.onPrimary,
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  zoneHeaderRight: {
    flexShrink: 0,
  },
  defaultBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  defaultBadgeText: {
    color: tokens.colors.onPrimary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  setDefaultBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  setDefaultBtnText: {
    color: tokens.colors.onPrimary,
    fontSize: 11,
    fontWeight: '600',
  },

  // Card body
  zoneCardBody: {
    padding: tokens.spacing.md,
    gap: tokens.spacing.md,
  },
  zoneInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.md,
  },
  infoFieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: tokens.colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  costValueText: {
    fontSize: 22,
    fontWeight: '800',
    color: tokens.colors.onBackground,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  metaPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: tokens.borderRadius.pill,
  },
  statusPillActive: { backgroundColor: tokens.colors.badgeSuccessBg },
  statusPillInactive: { backgroundColor: tokens.colors.badgeNeutralBg },
  statusDot: { width: 5, height: 5, borderRadius: 2.5 },
  statusDotActive: { backgroundColor: tokens.colors.statusSuccess },
  statusDotInactive: { backgroundColor: tokens.colors.textMuted },
  statusPillText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
  statusPillTextActive: { color: tokens.colors.statusSuccess },
  statusPillTextInactive: { color: tokens.colors.textMuted },
  defaultSmallPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: tokens.colors.badgeSuccessBg,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: tokens.borderRadius.pill,
  },
  defaultSmallPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#16A34A',
  },

  // Cost display box (right side)
  costDisplay: {
    width: 88,
    height: 88,
    borderRadius: tokens.borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 3,
    borderWidth: 1,
    flexShrink: 0,
  },
  costDisplayValue: {
    fontSize: 18,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  costDisplayLabel: {
    fontSize: 9,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },

  // Action buttons
  zoneCardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border,
    paddingTop: tokens.spacing.sm + 2,
    gap: tokens.spacing.sm,
  },
  actionBtnEdit: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: tokens.spacing.sm,
    backgroundColor: tokens.colors.actionPrimaryBg,
    borderRadius: tokens.borderRadius.sm,
    borderWidth: 1,
    borderColor: tokens.colors.primaryFixedDim,
  },
  actionBtnEditText: {
    color: tokens.colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  actionBtnToggle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: tokens.spacing.sm,
    backgroundColor: tokens.colors.surfaceAlt,
    borderRadius: tokens.borderRadius.sm,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
  },
  actionBtnToggleText: {
    fontSize: 13,
    fontWeight: '600',
  },
  actionBtnDelete: {
    width: 36,
    height: 36,
    borderRadius: tokens.borderRadius.sm,
    backgroundColor: tokens.colors.actionDestructiveBg,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FECACA',
  },

  // ── Modal ─────────────────────────────────────────────
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: tokens.colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing.md,
    paddingTop: tokens.spacing.md,
    paddingBottom: tokens.spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.border,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: tokens.colors.onBackground,
    marginBottom: 2,
  },
  modalSub: {
    fontSize: 13,
    color: tokens.colors.textSecondary,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalBody: {
    padding: tokens.spacing.md,
    paddingBottom: tokens.spacing.lg,
  },
  defaultToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: tokens.spacing.sm,
    paddingVertical: tokens.spacing.sm,
  },
  defaultToggleText: {
    fontSize: 14,
    color: tokens.colors.onBackground,
    flex: 1,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: tokens.spacing.md,
    gap: tokens.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border,
    paddingBottom: Platform.OS === 'ios' ? 36 : tokens.spacing.md,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: tokens.colors.background,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: tokens.colors.borderDark,
  },
  cancelBtnText: {
    color: tokens.colors.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  saveBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: tokens.colors.primary,
    alignItems: 'center',
  },
  saveBtnText: {
    color: tokens.colors.onPrimary,
    fontSize: 15,
    fontWeight: '600',
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
