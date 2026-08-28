import React, { useState, useMemo, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  Linking,
  Platform,
  ActivityIndicator,
  FlatList,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../theme/tokens'
import type { Supplier, TabType } from '../types'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { supplierSchema, SupplierFormValues } from '../utils/validation'
import { ControlledInput } from '../components/ControlledInput'
import { fetchSuppliers, createSupplier, updateSupplier, deleteSupplier } from '../api/endpoints'
import { usePermissions } from '../hooks/usePermissions'
import { SearchBar } from '../components/SearchBar'
import { matchSearch } from '../utils/searchHelper'

export interface SuppliersScreenProps {
  onNavigate: (tab: TabType) => void
  onSelectSupplierForPO?: (supplier: Supplier) => void
  onOpenPurchaseOrder?: (opts?: { mode?: 'list' | 'create'; supplierId?: string }) => void
}

export const INITIAL_SUPPLIERS: Supplier[] = []

interface SupplierCardItemProps {
  supplier: Supplier
  canManage: boolean
  onSelect: (s: Supplier) => void
  onEdit: (s: Supplier) => void
  onCall: (phone?: string) => void
  onEmail: (email?: string) => void
}

const SupplierCardItem: React.FC<SupplierCardItemProps> = React.memo(({
  supplier,
  canManage,
  onSelect,
  onEdit,
  onCall,
  onEmail,
}) => {
  const initials = supplier.name
    .split(' ')
    .map((w: string) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.7}
      onPress={() => onSelect(supplier)}
    >
      <View style={styles.cardHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={styles.cardMainInfo}>
          <Text style={styles.supplierName} numberOfLines={1}>
            {supplier.name}
          </Text>
          {!!supplier.contactPerson && (
            <View style={styles.contactRow}>
              <Ionicons name="person-outline" size={12} color={tokens.colors.secondary} />
              <Text style={styles.contactPersonText}>{supplier.contactPerson}</Text>
            </View>
          )}
        </View>
        {Boolean(canManage) && (
          <TouchableOpacity
            style={styles.moreBtn}
            onPress={() => onEdit(supplier)}
          >
            <Ionicons name="pencil-outline" size={16} color={tokens.colors.secondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Details Badges */}
      <View style={styles.badgeRow}>
        <View style={styles.badge}>
          <Ionicons name="time-outline" size={12} color="#D97706" />
          <Text style={styles.badgeText}>{supplier.leadTimeDays || 3} days lead</Text>
        </View>
        {supplier.activeOrdersCount ? (
          <View style={[styles.badge, styles.badgeActive]}>
            <Ionicons name="cube-outline" size={12} color="#FF8800" />
            <Text style={[styles.badgeText, { color: '#FF8800' }]}>
              {supplier.activeOrdersCount} Active PO{supplier.activeOrdersCount > 1 ? 's' : ''}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Contact Channels */}
      <View style={styles.cardFooter}>
        <TouchableOpacity
          style={styles.contactChip}
          onPress={() => onCall(supplier.phone)}
        >
          <Ionicons name="call-outline" size={13} color={tokens.colors.primaryContainer} />
          <Text style={styles.contactChipText}>{supplier.phone}</Text>
        </TouchableOpacity>

        {!!supplier.email && (
          <TouchableOpacity
            style={styles.contactChip}
            onPress={() => onEmail(supplier.email)}
          >
            <Ionicons name="mail-outline" size={13} color={tokens.colors.primaryContainer} />
            <Text style={styles.contactChipText} numberOfLines={1}>
              {supplier.email}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  )
})

export const SuppliersScreen: React.FC<SuppliersScreenProps> = ({
  onNavigate,
  onSelectSupplierForPO,
  onOpenPurchaseOrder,
}) => {
  const { can } = usePermissions()
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)

  // Details Modal
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null)

  // Create / Edit Modal
  const [modalOpen, setModalOpen] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)

  const loadSuppliers = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchSuppliers()
      if (Array.isArray(data)) {
        setSuppliers(data)
      } else {
        setSuppliers([])
      }
    } catch {
      setSuppliers([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSuppliers()
  }, [loadSuppliers])

  const { control, handleSubmit, reset } = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      name: '',
      contactPerson: '',
      phone: '',
      email: '',
      address: '',
      leadTimeDays: 3,
    },
  })

  const filteredSuppliers = useMemo(() => {
    if (!search.trim()) return suppliers
    return suppliers.filter((s) =>
      matchSearch(
        search,
        s.name,
        s.contactPerson,
        s.contact_person,
        s.phone,
        s.email,
        s.address,
        s.notes
      )
    )
  }, [suppliers, search])

  const handleOpenCreate = () => {
    setEditingSupplier(null)
    reset({
      name: '',
      contactPerson: '',
      phone: '',
      email: '',
      address: '',
      leadTimeDays: 3,
    })
    setModalOpen(true)
  }

  const handleOpenEdit = (s: Supplier) => {
    setEditingSupplier(s)
    reset({
      name: s.name,
      contactPerson: s.contactPerson || s.contact_person || '',
      phone: s.phone,
      email: s.email || '',
      address: s.address || '',
      leadTimeDays: s.leadTimeDays ?? s.lead_time_days ?? 3,
    })
    setModalOpen(true)
  }

  const onSubmit = async (data: SupplierFormValues) => {
    if (editingSupplier) {
      const updated: Supplier = {
        ...editingSupplier,
        name: data.name.trim(),
        contactPerson: data.contactPerson?.trim() || '',
        contact_person: data.contactPerson?.trim() || '',
        phone: data.phone.trim(),
        email: data.email?.trim() || '',
        address: data.address?.trim() || '',
        leadTimeDays: Number(data.leadTimeDays) || 0,
        lead_time_days: Number(data.leadTimeDays) || 0,
      }
      setSuppliers((prev) => prev.map((s) => (s.id === editingSupplier.id ? updated : s)))
      if (selectedSupplier?.id === editingSupplier.id) {
        setSelectedSupplier(updated)
      }
      try {
        await updateSupplier(editingSupplier.id, {
          name: updated.name,
          contact_person: updated.contact_person,
          phone: updated.phone,
          email: updated.email,
          address: updated.address,
          lead_time_days: updated.lead_time_days,
        })
      } catch {
        // Saved locally
      }
      Alert.alert('Success', `Supplier "${data.name}" updated.`)
    } else {
      const tempId = `sup-${Date.now()}`
      const newSupplier: Supplier = {
        id: tempId,
        name: data.name.trim(),
        contactPerson: data.contactPerson?.trim() || '',
        contact_person: data.contactPerson?.trim() || '',
        phone: data.phone.trim(),
        email: data.email?.trim() || '',
        address: data.address?.trim() || '',
        leadTimeDays: Number(data.leadTimeDays) || 3,
        lead_time_days: Number(data.leadTimeDays) || 3,
        activeOrdersCount: 0,
      }
      setSuppliers((prev) => [newSupplier, ...prev])
      try {
        const created = await createSupplier({
          name: newSupplier.name,
          contact_person: newSupplier.contact_person,
          phone: newSupplier.phone,
          email: newSupplier.email,
          address: newSupplier.address,
          lead_time_days: newSupplier.lead_time_days,
        })
        if (created && created.id) {
          setSuppliers((prev) => prev.map((s) => (s.id === tempId ? created : s)))
        }
      } catch {
        // Saved locally
      }
      Alert.alert('Success', `Supplier "${data.name}" added successfully.`)
    }
    setModalOpen(false)
  }

  const handleDelete = (s: Supplier) => {
    Alert.alert(
      'Delete Supplier',
      `Are you sure you want to remove "${s.name}"? Active purchase orders may be affected.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setSuppliers((prev) => prev.filter((item) => item.id !== s.id))
            if (selectedSupplier?.id === s.id) {
              setSelectedSupplier(null)
            }
            try {
              await deleteSupplier(s.id)
            } catch {
              // Local delete
            }
          },
        },
      ]
    )
  }

  const handleCall = (phone: string) => {
    Linking.openURL(`tel:${phone.replace(/\s+/g, '')}`).catch(() => {
      Alert.alert('Error', 'Unable to initiate phone call on this device.')
    })
  }

  const handleEmail = (email: string) => {
    Linking.openURL(`mailto:${email}`).catch(() => {
      Alert.alert('Error', 'Unable to open mail client on this device.')
    })
  }

  return (
    <View style={styles.container}>
      {/* Sticky Top Toolbar with same background as main */}
      <View style={styles.stickyToolbar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => onNavigate('hub')}
          accessibilityLabel="Back to Hub"
        >
          <Ionicons name="arrow-back" size={20} color={tokens.colors.onSurface} />
        </TouchableOpacity>

        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Search suppliers, contact, phone..."
          containerStyle={styles.searchBarContainer}
        />

        {Boolean(can('suppliers:manage')) && (
          <TouchableOpacity
            style={styles.addBtn}
            onPress={handleOpenCreate}
            activeOpacity={0.85}
            accessibilityLabel="Add New Supplier"
          >
            <Ionicons name="add" size={20} color="#FFFFFF" />
            <Text style={styles.addBtnText}>Add</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        data={filteredSuppliers}
        keyExtractor={(item: Supplier) => item.id}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={Platform.OS === 'android'}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="briefcase-outline" size={48} color={tokens.colors.outline} />
            <Text style={styles.emptyTitle}>No Suppliers Found</Text>
            <Text style={styles.emptySubtitle}>
              {search
                ? `No vendor matches "${search}". Try adjusting your search query.`
                : 'You have not added any suppliers yet. Tap "+ Add" to get started.'}
            </Text>
          </View>
        }
        renderItem={({ item: supplier }: { item: Supplier }) => (
          <SupplierCardItem
            supplier={supplier}
            canManage={Boolean(can('suppliers:manage'))}
            onSelect={setSelectedSupplier}
            onEdit={handleOpenEdit}
            onCall={(ph) => ph && handleCall(ph)}
            onEmail={(em) => em && handleEmail(em)}
          />
        )}
      />

      {/* Supplier Details Modal */}
      {selectedSupplier ? (
        <Modal
          visible={!!selectedSupplier}
          animationType="slide"
          transparent
          onRequestClose={() => setSelectedSupplier(null)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.detailsSheet}>
              <View style={styles.sheetHandle} />

              <View style={styles.sheetHeader}>
                <View style={styles.sheetAvatar}>
                  <Text style={styles.sheetAvatarText}>
                    {selectedSupplier.name
                      .split(' ')
                      .map((w) => w[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sheetTitle}>{selectedSupplier.name}</Text>
                  {!!selectedSupplier.contactPerson && (
                    <Text style={styles.sheetSubtitle}>Contact: {selectedSupplier.contactPerson}</Text>
                  )}
                </View>
                <TouchableOpacity
                  style={styles.sheetCloseBtn}
                  onPress={() => setSelectedSupplier(null)}
                >
                  <Ionicons name="close" size={20} color={tokens.colors.secondary} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.sheetBody}>
                {/* Details Bento */}
                <View style={styles.sheetInfoBox}>
                  <View style={styles.infoRow}>
                    <Ionicons name="call-outline" size={16} color={tokens.colors.secondary} />
                    <Text style={styles.infoLabel}>Phone:</Text>
                    <TouchableOpacity onPress={() => handleCall(selectedSupplier.phone)}>
                      <Text style={styles.infoValueLink}>{selectedSupplier.phone}</Text>
                    </TouchableOpacity>
                  </View>

                  {!!selectedSupplier.email && (
                    <View style={styles.infoRow}>
                      <Ionicons name="mail-outline" size={16} color={tokens.colors.secondary} />
                      <Text style={styles.infoLabel}>Email:</Text>
                      <TouchableOpacity onPress={() => selectedSupplier.email && handleEmail(selectedSupplier.email)}>
                        <Text style={styles.infoValueLink}>{selectedSupplier.email}</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {!!selectedSupplier.address && (
                    <View style={styles.infoRow}>
                      <Ionicons name="location-outline" size={16} color={tokens.colors.secondary} />
                      <Text style={styles.infoLabel}>Address:</Text>
                      <Text style={styles.infoValueText}>{selectedSupplier.address}</Text>
                    </View>
                  )}

                  <View style={styles.infoRow}>
                    <Ionicons name="time-outline" size={16} color={tokens.colors.secondary} />
                    <Text style={styles.infoLabel}>Est. Delivery Lead Time:</Text>
                    <Text style={styles.infoValueText}>{selectedSupplier.leadTimeDays || 3} business days</Text>
                  </View>
                </View>

                {/* Action Buttons */}
                <View style={styles.sheetActions}>
                  {Boolean(can('purchase-orders:create')) && (
                    <TouchableOpacity
                      style={styles.sheetPrimaryBtn}
                      onPress={() => {
                        const targetSup = selectedSupplier
                        setSelectedSupplier(null)
                        if (onOpenPurchaseOrder && targetSup) {
                          onOpenPurchaseOrder({ mode: 'create', supplierId: targetSup.id })
                        } else if (onSelectSupplierForPO && targetSup) {
                          onSelectSupplierForPO(targetSup)
                        } else {
                          onNavigate('products')
                        }
                      }}
                    >
                      <Ionicons name="cart-outline" size={18} color="#FFFFFF" />
                      <Text style={styles.sheetPrimaryBtnText}>Create Restock PO</Text>
                    </TouchableOpacity>
                  )}

                  {Boolean(can('suppliers:manage')) && (
                    <View style={styles.sheetSecondaryRow}>
                      <TouchableOpacity
                        style={styles.sheetEditBtn}
                        onPress={() => {
                          const sup = selectedSupplier
                          setSelectedSupplier(null)
                          handleOpenEdit(sup)
                        }}
                      >
                        <Ionicons name="pencil" size={16} color={tokens.colors.onSurface} />
                        <Text style={styles.sheetEditBtnText}>Edit Supplier</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.sheetDeleteBtn}
                        onPress={() => {
                          const sup = selectedSupplier
                          handleDelete(sup)
                        }}
                      >
                        <Ionicons name="trash-outline" size={16} color="#DC2626" />
                        <Text style={styles.sheetDeleteBtnText}>Delete</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      ) : null}

      {/* Create / Edit Supplier Modal */}
      <Modal
        visible={modalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.formSheet}>
            <View style={styles.sheetHandle} />

            <View style={styles.formHeader}>
              <Text style={styles.formTitle}>
                {editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}
              </Text>
              <TouchableOpacity onPress={() => setModalOpen(false)}>
                <Ionicons name="close" size={20} color={tokens.colors.secondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={false}>
              <ControlledInput
                name="name"
                control={control}
                label="Supplier / Company Name *"
                placeholder="e.g. Phnom Penh Apparel Suppliers"
              />

              <ControlledInput
                name="contactPerson"
                control={control}
                label="Contact Person Name"
                placeholder="e.g. Mr. Vanna"
              />

              <ControlledInput
                name="phone"
                control={control}
                label="Phone Number *"
                placeholder="e.g. +855 23 444 555"
                inputProps={{ keyboardType: 'phone-pad' }}
              />

              <ControlledInput
                name="email"
                control={control}
                label="Email Address"
                placeholder="e.g. sales@vendor.com"
                inputProps={{ keyboardType: 'email-address', autoCapitalize: 'none' }}
              />

              <ControlledInput
                name="address"
                control={control}
                label="Office / Warehouse Address"
                placeholder="e.g. Street 271, Phnom Penh"
                inputProps={{ multiline: true }}
              />

              <ControlledInput
                name="leadTimeDays"
                control={control}
                label="Est. Lead Time (Days)"
                placeholder="e.g. 3"
                inputProps={{ keyboardType: 'numeric' }}
              />

              <TouchableOpacity
                style={styles.submitBtn}
                onPress={handleSubmit(onSubmit)}
                activeOpacity={0.8}
              >
                <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
                <Text style={styles.submitBtnText}>
                  {editingSupplier ? 'Save Changes' : 'Create Supplier'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
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
  stickyToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.md,
    paddingTop: Platform.OS === 'ios' ? 8 : 12,
    paddingBottom: tokens.spacing.xs,
    backgroundColor: tokens.colors.background,
    gap: 8,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: tokens.borderRadius.pill,
    backgroundColor: tokens.colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBarContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.surfaceCard,
    borderRadius: tokens.borderRadius.pill,
    paddingHorizontal: 12,
    height: 40,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: tokens.colors.onSurface,
    paddingVertical: 0,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.primaryContainer,
    paddingHorizontal: 14,
    height: 40,
    borderRadius: tokens.borderRadius.pill,
    gap: 4,
    ...tokens.shadows.card,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: tokens.spacing.md,
    gap: 12,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: tokens.colors.onSurface,
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: tokens.colors.secondary,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  card: {
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.borderRadius.lg,
    padding: tokens.spacing.md,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    gap: 10,
    ...tokens.shadows.card,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#059669',
  },
  cardMainInfo: {
    flex: 1,
  },
  supplierName: {
    fontSize: 15,
    fontWeight: '700',
    color: tokens.colors.onSurface,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  contactPersonText: {
    fontSize: 12,
    color: tokens.colors.secondary,
    fontWeight: '500',
  },
  moreBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: tokens.colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: tokens.borderRadius.pill,
    gap: 4,
  },
  badgeActive: {
    backgroundColor: '#FFF3E0',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#92400E',
  },
  cardFooter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.borderSubtle,
  },
  contactChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.surfaceAlt,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: tokens.borderRadius.md,
    gap: 6,
  },
  contactChipText: {
    fontSize: 12,
    color: tokens.colors.primaryContainer,
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  detailsSheet: {
    backgroundColor: tokens.colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingBottom: Platform.OS === 'ios' ? 32 : 20,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: tokens.colors.outline,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.md,
    paddingBottom: tokens.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderSubtle,
    gap: 12,
  },
  sheetAvatar: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheetAvatarText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#059669',
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: tokens.colors.onSurface,
  },
  sheetSubtitle: {
    fontSize: 12,
    color: tokens.colors.secondary,
    marginTop: 2,
  },
  sheetCloseBtn: {
    padding: 6,
  },
  sheetBody: {
    padding: tokens.spacing.md,
  },
  sheetInfoBox: {
    backgroundColor: tokens.colors.surfaceAlt,
    borderRadius: tokens.borderRadius.lg,
    padding: tokens.spacing.md,
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: tokens.colors.secondary,
    width: 140,
  },
  infoValueLink: {
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.primaryContainer,
    flex: 1,
  },
  infoValueText: {
    fontSize: 13,
    fontWeight: '600',
    color: tokens.colors.onSurface,
    flex: 1,
  },
  sheetActions: {
    marginTop: tokens.spacing.lg,
    gap: 10,
  },
  sheetPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.primaryContainer,
    paddingVertical: 14,
    borderRadius: tokens.borderRadius.pill,
    gap: 8,
    ...tokens.shadows.card,
  },
  sheetPrimaryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  sheetSecondaryRow: {
    flexDirection: 'row',
    gap: 10,
  },
  sheetEditBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.surfaceAlt,
    paddingVertical: 12,
    borderRadius: tokens.borderRadius.pill,
    gap: 6,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
  },
  sheetEditBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.onSurface,
  },
  sheetDeleteBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    paddingVertical: 12,
    borderRadius: tokens.borderRadius.pill,
    gap: 6,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  sheetDeleteBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#DC2626',
  },
  formSheet: {
    backgroundColor: tokens.colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: Platform.OS === 'ios' ? 32 : 20,
  },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing.md,
    paddingBottom: tokens.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderSubtle,
  },
  formTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: tokens.colors.onSurface,
  },
  formScroll: {
    padding: tokens.spacing.md,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.primaryContainer,
    paddingVertical: 14,
    borderRadius: tokens.borderRadius.pill,
    gap: 8,
    marginTop: tokens.spacing.md,
    marginBottom: tokens.spacing.lg,
    ...tokens.shadows.card,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
})

export default SuppliersScreen
