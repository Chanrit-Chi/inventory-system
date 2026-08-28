import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  RefreshControl,
  FlatList,
  Platform,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../theme/tokens'
import type { Customer, TabType, PaginatedData } from '../types'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { customerSchema, CustomerFormValues } from '../utils/validation'
import { ControlledInput } from '../components/ControlledInput'
import { fetchCustomers } from '../api/endpoints'
import { usePermissions } from '../hooks/usePermissions'
import { SearchBar } from '../components/SearchBar'
import { matchSearch } from '../utils/searchHelper'

export interface CustomersScreenProps {
  onNavigate: (tab: TabType) => void
  onSelectCustomerForPOS?: (customer: Customer) => void
}

const INITIAL_CUSTOMERS: Customer[] = []

export const CustomersScreen: React.FC<CustomersScreenProps> = ({
  onNavigate,
  onSelectCustomerForPOS,
}) => {
  const { can } = usePermissions()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  // Details Modal
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)

  // Create / Edit Modal
  const [customerModalOpen, setCustomerModalOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)

  const { control, handleSubmit, reset, setValue } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: { name: '', phone: '', address: '', email: '', preferred_delivery_company: '' },
  })

  const loadCustomers = useCallback(async (query = '') => {
    setLoading(true)
    try {
      const res = await fetchCustomers({ search: query })
      const resData = res.data
      if (Array.isArray(resData)) {
        setCustomers(resData)
      } else if (resData && typeof resData === 'object' && 'data' in resData && Array.isArray((resData as PaginatedData<Customer>).data)) {
        setCustomers((resData as PaginatedData<Customer>).data)
      } else {
        setCustomers([])
      }
    } catch {
      setCustomers([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    loadCustomers()
  }, [loadCustomers])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    loadCustomers(search)
  }, [loadCustomers, search])

  const filteredCustomers = useMemo(() => {
    if (!search.trim()) return customers
    return customers.filter((c) =>
      matchSearch(search, c.name, c.phone, c.email, c.address, c.preferred_delivery_company)
    )
  }, [customers, search])

  const handleOpenCreate = () => {
    setEditingCustomer(null)
    reset({ name: '', phone: '', address: '', email: '', preferred_delivery_company: '' })
    setCustomerModalOpen(true)
  }

  const handleOpenEdit = (c: Customer) => {
    setEditingCustomer(c)
    reset({
      name: c.name,
      phone: c.phone,
      address: c.address || '',
      email: c.email || '',
      preferred_delivery_company: c.preferred_delivery_company || '',
    })
    setCustomerModalOpen(true)
  }

  const onSubmit = (data: CustomerFormValues) => {
    if (editingCustomer) {
      const updated: Customer = {
        ...editingCustomer,
        name: data.name,
        phone: data.phone,
        address: data.address,
        email: data.email,
        preferred_delivery_company: data.preferred_delivery_company,
      }
      setCustomers(customers.map((c) => (c.id === editingCustomer.id ? updated : c)))
      if (selectedCustomer?.id === editingCustomer.id) {
        setSelectedCustomer(updated)
      }
      Alert.alert('Success', `Customer "${data.name}" updated.`)
    } else {
      const newCust: Customer = {
        id: `cust-${Date.now()}`,
        name: data.name,
        phone: data.phone,
        address: data.address,
        email: data.email,
        preferred_delivery_company: data.preferred_delivery_company,
        total_purchased: 0,
        total_spent: 0,
        created_at: new Date().toISOString(),
      }
      setCustomers([newCust, ...customers])
      Alert.alert('Success', `New customer "${data.name}" added.`)
    }

    setCustomerModalOpen(false)
  }

  const getLoyaltyBadge = (spent: number) => {
    if (spent >= 2000) return { label: 'Platinum VIP', bg: '#EDE9FE', text: '#5B21B6' }
    if (spent >= 1000) return { label: 'Gold Member', bg: '#FEF9C3', text: '#B45309' }
    if (spent >= 300) return { label: 'Silver Member', bg: '#F3F4F6', text: '#4B5563' }
    return { label: 'Bronze', bg: '#FEF3C7', text: '#92400E' }
  }

  return (
    <View style={styles.container}>
      {/* Compact toolbar: search + add icon */}
      <View style={styles.compactToolbar}>
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Search name, phone, email, address..."
          containerStyle={styles.searchBarContainer}
        />
        {Boolean(can('customers:manage')) && (
          <TouchableOpacity style={styles.addIconBtn} onPress={handleOpenCreate} accessibilityLabel="Add Customer">
            <Ionicons name="person-add" size={18} color={tokens.colors.onPrimary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Customer Cards List */}
      <FlatList
        style={styles.list}
        data={filteredCustomers}
        keyExtractor={(item: Customer) => item.id}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={Platform.OS === 'android'}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[tokens.colors.primaryContainer]}
            tintColor={tokens.colors.primaryContainer}
          />
        }
        renderItem={({ item: cust }: { item: Customer }) => {
          const spent = Number(cust.total_spent || 0)
          const badge = getLoyaltyBadge(spent)

          return (
            <TouchableOpacity
              style={styles.customerCard}
              onPress={() => setSelectedCustomer(cust)}
              activeOpacity={0.8}
            >
              <View style={styles.cardTop}>
                <View style={styles.avatarBox}>
                  <Ionicons name="person" size={20} color={tokens.colors.primaryContainer} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.customerName}>{cust.name}</Text>
                  <Text style={styles.customerPhone}>{cust.phone}</Text>
                </View>
                <View style={[styles.loyaltyBadge, { backgroundColor: badge.bg }]}>
                  <Text style={[styles.loyaltyText, { color: badge.text }]}>{badge.label}</Text>
                </View>
              </View>

              <View style={styles.cardDivider} />

              <View style={styles.cardBottom}>
                <View>
                  <Text style={styles.metaLabel}>Total Spend</Text>
                  <Text style={styles.spendVal}>${spent.toFixed(2)}</Text>
                </View>
                <View>
                  <Text style={styles.metaLabel}>Orders</Text>
                  <Text style={styles.ordersVal}>{cust.total_purchased || 0} completed</Text>
                </View>
                <TouchableOpacity
                  style={styles.posActionBtn}
                  onPress={() => {
                    if (onSelectCustomerForPOS) onSelectCustomerForPOS(cust)
                    onNavigate('pos')
                  }}
                >
                  <Ionicons name="cart" size={14} color={tokens.colors.onPrimary} />
                  <Text style={styles.posActionText}>Start Sale</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          )
        }}
        ListEmptyComponent={
          loading && !refreshing && customers.length === 0 ? (
            <View style={{ paddingVertical: 40, alignItems: 'center' }}>
              <ActivityIndicator size="large" color={tokens.colors.primaryContainer} />
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={48} color={tokens.colors.secondary} />
              <Text style={styles.emptyTitle}>No Customers Found</Text>
              <Text style={styles.emptyText}>Add a new customer to keep track of loyalty & purchases.</Text>
            </View>
          )
        }
      />

      {/* Customer Detail Sheet */}
      {selectedCustomer ? (
        <Modal visible={true} transparent animationType="slide" onRequestClose={() => setSelectedCustomer(null)}>
          <View style={styles.modalOverlay}>
            <View style={styles.detailSheet}>
              <View style={styles.sheetHeader}>
                <View>
                  <Text style={styles.detailTitle}>{selectedCustomer.name}</Text>
                  <Text style={styles.detailSubtitle}>{selectedCustomer.phone}</Text>
                </View>
                <TouchableOpacity onPress={() => setSelectedCustomer(null)}>
                  <Ionicons name="close" size={24} color={tokens.colors.secondary} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.detailBody}>
                {/* Stats Bento */}
                <View style={styles.statsBento}>
                  <View style={styles.bentoBox}>
                    <Text style={styles.bentoLabel}>Lifetime Spend</Text>
                    <Text style={styles.bentoVal}>${Number(selectedCustomer.total_spent || 0).toFixed(2)}</Text>
                  </View>
                  <View style={styles.bentoBox}>
                    <Text style={styles.bentoLabel}>Total Orders</Text>
                    <Text style={styles.bentoVal}>{selectedCustomer.total_purchased || 0}</Text>
                  </View>
                </View>

                {/* Contact Information */}
                <Text style={styles.sectionHeader}>Contact Information</Text>
                <View style={styles.infoCard}>
                  <View style={styles.infoRow}>
                    <Ionicons name="call-outline" size={16} color={tokens.colors.secondary} />
                    <Text style={styles.infoText}>{selectedCustomer.phone}</Text>
                  </View>
                  {selectedCustomer.address ? (
                    <View style={styles.infoRow}>
                      <Ionicons name="location-outline" size={16} color={tokens.colors.secondary} />
                      <Text style={styles.infoText}>{selectedCustomer.address}</Text>
                    </View>
                  ) : null}
                </View>

                {/* Purchase Activity Summary */}
                <Text style={[styles.sectionHeader, { marginTop: 16 }]}>Purchase Activity</Text>
                {(selectedCustomer.total_purchased || 0) > 0 ? (
                  <>
                    <View style={styles.purchaseRow}>
                      <View>
                        <Text style={styles.purchaseNum}>Lifetime Orders</Text>
                        <Text style={styles.purchaseDate}>Total Completed Transactions</Text>
                      </View>
                      <Text style={styles.purchaseAmount}>{selectedCustomer.total_purchased || 0} Orders</Text>
                    </View>
                    {Boolean(selectedCustomer.last_purchase_at) && (
                      <View style={styles.purchaseRow}>
                        <View>
                          <Text style={styles.purchaseNum}>Last Order Date</Text>
                          <Text style={styles.purchaseDate}>Most Recent POS Checkout</Text>
                        </View>
                        <Text style={styles.purchaseAmount}>
                          {selectedCustomer.last_purchase_at ? new Date(selectedCustomer.last_purchase_at).toLocaleDateString() : 'N/A'}
                        </Text>
                      </View>
                    )}
                  </>
                ) : (
                  <Text style={[styles.infoText, { color: tokens.colors.secondary, marginTop: 4 }]}>
                    No previous orders recorded for this customer.
                  </Text>
                )}

                {/* Action Buttons */}
                <View style={styles.detailActions}>
                  {Boolean(can('customers:manage')) && (
                    <TouchableOpacity
                      style={styles.editBtn}
                      onPress={() => {
                        handleOpenEdit(selectedCustomer)
                      }}
                    >
                      <Ionicons name="create-outline" size={16} color={tokens.colors.onBackground} />
                      <Text style={styles.editBtnText}>Edit Profile</Text>
                    </TouchableOpacity>
                  )}

                  {Boolean(can('pos:checkout')) && (
                    <TouchableOpacity
                      style={styles.startSaleBtn}
                      onPress={() => {
                        if (onSelectCustomerForPOS) onSelectCustomerForPOS(selectedCustomer)
                        setSelectedCustomer(null)
                        onNavigate('pos')
                      }}
                    >
                      <Ionicons name="cart" size={16} color={tokens.colors.onPrimary} />
                      <Text style={styles.startSaleText}>New POS Sale</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      ) : null}

      {/* Create / Edit Customer Modal */}
      <Modal visible={customerModalOpen} transparent animationType="slide" onRequestClose={() => setCustomerModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.modalTitle}>{editingCustomer ? 'Edit Customer' : 'Add New Customer'}</Text>
              <TouchableOpacity onPress={() => setCustomerModalOpen(false)}>
                <Ionicons name="close" size={24} color={tokens.colors.secondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.formScroll}>
              <ControlledInput
                name="name"
                control={control}
                label="Full Name *"
                placeholder="e.g. John Doe"
              />

              <ControlledInput
                name="phone"
                control={control}
                label="Phone Number *"
                placeholder="+855 ..."
                inputProps={{ keyboardType: 'phone-pad' }}
              />

              <ControlledInput
                name="address"
                control={control}
                label="Delivery Address"
                placeholder="Street address, city..."
                inputProps={{ multiline: true, style: { height: 60 } }}
              />

              <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit(onSubmit)}>
                <Text style={styles.submitBtnText}>{editingCustomer ? 'Save Customer' : 'Add Customer'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  compactToolbar: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderSubtle,
  },
  compactHeaderRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingRight: tokens.spacing.sm,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderSubtle,
    gap: 6,
  },
  addIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: tokens.colors.primaryContainer,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    flexShrink: 0,
    marginRight: 2,
  },
  exportIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: tokens.colors.primaryContainer,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    flexShrink: 0,
    marginRight: tokens.spacing.sm,
  },
  filterRowContent: {
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 6,
    gap: 8,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  dateSelectorContent: {
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: 6,
    gap: 6,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
  },
  title: {
    fontSize: tokens.typography.headlineLargeMobile.fontSize,
    fontWeight: '700',
    color: tokens.colors.onBackground,
  },
  subtitle: {
    fontSize: tokens.typography.caption.fontSize,
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
    gap: 4,
    ...tokens.shadows.card,
  },
  addBtnText: {
    color: tokens.colors.onPrimary,
    fontWeight: '700',
    fontSize: 12,
  },
  searchBarContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.surfaceCard,
    paddingHorizontal: 10,
    borderRadius: tokens.borderRadius.pill,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    height: 36,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: tokens.colors.onBackground,
  },
  list: {
    flex: 1,
    paddingHorizontal: tokens.spacing.md,
    paddingTop: tokens.spacing.sm,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: tokens.colors.onBackground,
    marginTop: 12,
  },
  emptyText: {
    fontSize: 12,
    color: tokens.colors.secondary,
    marginTop: 4,
  },
  customerCard: {
    backgroundColor: tokens.colors.surfaceCard,
    borderRadius: tokens.borderRadius.card,
    padding: tokens.spacing.md,
    marginBottom: tokens.spacing.sm,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    ...tokens.shadows.card,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: tokens.colors.actionPrimaryBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customerName: {
    fontSize: 15,
    fontWeight: '700',
    color: tokens.colors.onBackground,
  },
  customerPhone: {
    fontSize: 12,
    color: tokens.colors.secondary,
    marginTop: 2,
  },
  loyaltyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  loyaltyText: {
    fontSize: 10,
    fontWeight: '700',
  },
  cardDivider: {
    height: 1,
    backgroundColor: tokens.colors.borderSubtle,
    marginVertical: 10,
  },
  cardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaLabel: {
    fontSize: 10,
    color: tokens.colors.secondary,
  },
  spendVal: {
    fontSize: 14,
    fontWeight: '700',
    color: tokens.colors.onBackground,
  },
  ordersVal: {
    fontSize: 12,
    fontWeight: '600',
    color: tokens.colors.secondary,
  },
  posActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.primaryContainer,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: tokens.borderRadius.pill,
    gap: 4,
  },
  posActionText: {
    color: tokens.colors.onPrimary,
    fontSize: 11,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: tokens.colors.surfaceOverlay,
    justifyContent: 'flex-end',
  },
  detailSheet: {
    backgroundColor: tokens.colors.background,
    borderTopLeftRadius: tokens.borderRadius.card,
    borderTopRightRadius: tokens.borderRadius.card,
    maxHeight: '90%',
    paddingBottom: tokens.spacing.xl,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: tokens.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderSubtle,
  },
  detailTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: tokens.colors.onBackground,
  },
  detailSubtitle: {
    fontSize: 12,
    color: tokens.colors.secondary,
    marginTop: 2,
  },
  detailBody: {
    padding: tokens.spacing.md,
  },
  statsBento: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  bentoBox: {
    flex: 1,
    backgroundColor: tokens.colors.surfaceCard,
    padding: 14,
    borderRadius: tokens.borderRadius.md,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
  },
  bentoLabel: {
    fontSize: 11,
    color: tokens.colors.secondary,
  },
  bentoVal: {
    fontSize: 18,
    fontWeight: '800',
    color: tokens.colors.primaryContainer,
    marginTop: 4,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.onBackground,
    marginBottom: 8,
  },
  infoCard: {
    backgroundColor: tokens.colors.surfaceCard,
    borderRadius: tokens.borderRadius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    gap: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    fontSize: 13,
    color: tokens.colors.onBackground,
  },
  purchaseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: tokens.colors.surfaceCard,
    padding: 12,
    borderRadius: tokens.borderRadius.md,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    marginBottom: 8,
  },
  purchaseNum: {
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.onBackground,
  },
  purchaseDate: {
    fontSize: 11,
    color: tokens.colors.secondary,
    marginTop: 2,
  },
  purchaseAmount: {
    fontSize: 14,
    fontWeight: '800',
    color: tokens.colors.onBackground,
  },
  detailActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
    marginBottom: 20,
  },
  editBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.surfaceCard,
    paddingVertical: 12,
    borderRadius: tokens.borderRadius.pill,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    gap: 6,
  },
  editBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: tokens.colors.onBackground,
  },
  startSaleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.primaryContainer,
    paddingVertical: 12,
    borderRadius: tokens.borderRadius.pill,
    gap: 6,
    ...tokens.shadows.card,
  },
  startSaleText: {
    color: tokens.colors.onPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  modalSheet: {
    backgroundColor: tokens.colors.background,
    borderTopLeftRadius: tokens.borderRadius.card,
    borderTopRightRadius: tokens.borderRadius.card,
    maxHeight: '90%',
    paddingBottom: tokens.spacing.xl,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: tokens.colors.onBackground,
  },
  formScroll: {
    padding: tokens.spacing.md,
  },
  formLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: tokens.colors.onBackground,
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    backgroundColor: tokens.colors.surfaceCard,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    borderRadius: tokens.borderRadius.input,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: tokens.colors.onBackground,
  },
  submitBtn: {
    backgroundColor: tokens.colors.primaryContainer,
    borderRadius: tokens.borderRadius.pill,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 30,
    ...tokens.shadows.card,
  },
  submitBtnText: {
    color: tokens.colors.onPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
})

export default CustomersScreen
