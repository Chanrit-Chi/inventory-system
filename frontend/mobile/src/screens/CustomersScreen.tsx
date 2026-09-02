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
import { fetchCustomers, getCustomerDetails } from '../api/endpoints'
import { usePermissions } from '../hooks/usePermissions'
import { useToast } from '../context/ToastContext'
import { SearchBar } from '../components/SearchBar'
import { matchSearch } from '../utils/searchHelper'
import { getChannelPlatformMeta } from '../components/TransactionCard'

export interface CustomersScreenProps {
  onNavigate: (tab: TabType) => void
  onSelectCustomerForPOS?: (customer: Customer) => void
}

function getLoyaltyBadge(spent: number) {
  if (spent >= 2000) return { label: 'Platinum VIP', bg: '#EDE9FE', text: '#5B21B6' }
  if (spent >= 1000) return { label: 'Gold Member', bg: '#FEF9C3', text: '#B45309' }
  if (spent >= 300) return { label: 'Silver Member', bg: '#F3F4F6', text: '#4B5563' }
  return { label: 'Bronze', bg: '#FEF3C7', text: '#92400E' }
}

interface CustomerCardProps {
  customer: Customer
  onSelect: (cust: Customer) => void
  onStartSale?: (cust: Customer) => void
}

const CustomerCard: React.FC<CustomerCardProps> = React.memo(({ customer, onSelect, onStartSale }) => {
  const spent = Number(customer.total_spent || 0)
  const badge = getLoyaltyBadge(spent)

  return (
    <TouchableOpacity
      style={styles.customerCard}
      onPress={() => onSelect(customer)}
      activeOpacity={0.8}
    >
      <View style={styles.cardTop}>
        <View style={styles.avatarBox}>
          <Ionicons name="person" size={20} color={tokens.colors.primaryContainer} />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.customerName}>{customer.name}</Text>
          <Text style={styles.customerPhone}>{customer.phone}</Text>
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
          <Text style={styles.ordersVal}>{customer.total_purchased || 0} completed</Text>
        </View>
        <TouchableOpacity
          style={styles.posActionBtn}
          onPress={() => onStartSale?.(customer)}
        >
          <Ionicons name="cart" size={14} color={tokens.colors.onPrimary} />
          <Text style={styles.posActionText}>Start Sale</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  )
})

export const CustomersScreen: React.FC<CustomersScreenProps> = ({
  onNavigate,
  onSelectCustomerForPOS,
}) => {
  const { showToast } = useToast()
  const { can } = usePermissions()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  // Details Modal
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({})

  const handleSelectCustomer = useCallback(async (cust: Customer) => {
    setSelectedCustomer(cust)
    setExpandedOrders({})
    setDetailsLoading(true)
    try {
      const res = await getCustomerDetails(cust.id)
      if (res && res.data) {
        setSelectedCustomer(res.data)
      }
    } catch {
      // Keep existing customer info if details fetch fails
    } finally {
      setDetailsLoading(false)
    }
  }, [])

  const toggleOrderExpand = useCallback((orderId: string) => {
    setExpandedOrders((prev) => ({
      ...prev,
      [orderId]: !prev[orderId],
    }))
  }, [])

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

  const [sortBy, setSortBy] = useState<'spent' | 'orders' | 'name'>('spent')

  const sortedCustomers = useMemo(() => {
    let list = customers
    if (search.trim()) {
      list = customers.filter((c) =>
        matchSearch(search, c.name, c.phone, c.email, c.address, c.preferred_delivery_company)
      )
    }
    return [...list].sort((a, b) => {
      if (sortBy === 'spent') {
        return Number(b.total_spent || 0) - Number(a.total_spent || 0)
      } else if (sortBy === 'orders') {
        return (b.total_purchased || 0) - (a.total_purchased || 0)
      } else {
        return a.name.localeCompare(b.name)
      }
    })
  }, [customers, search, sortBy])

  const sortedModalOrders = useMemo(() => {
    if (!selectedCustomer?.orders) return []
    return [...selectedCustomer.orders].sort(
      (a, b) => Number(b.total_amount || 0) - Number(a.total_amount || 0)
    )
  }, [selectedCustomer?.orders])

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
      showToast(`Customer "${data.name}" updated.`, 'success')
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
      showToast(`New customer "${data.name}" added.`, 'success')
    }

    setCustomerModalOpen(false)
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

      {/* Sort Filter Bar */}
      <View style={styles.sortBar}>
        <Text style={styles.sortLabel}>SORT BY:</Text>
        <TouchableOpacity
          style={[styles.sortPill, sortBy === 'spent' && styles.sortPillActive]}
          onPress={() => setSortBy('spent')}
        >
          <Text style={[styles.sortPillText, sortBy === 'spent' && styles.sortPillTextActive]}>
            💰 Most Amount
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.sortPill, sortBy === 'orders' && styles.sortPillActive]}
          onPress={() => setSortBy('orders')}
        >
          <Text style={[styles.sortPillText, sortBy === 'orders' && styles.sortPillTextActive]}>
            📦 Most Orders
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.sortPill, sortBy === 'name' && styles.sortPillActive]}
          onPress={() => setSortBy('name')}
        >
          <Text style={[styles.sortPillText, sortBy === 'name' && styles.sortPillTextActive]}>
            🔤 Name
          </Text>
        </TouchableOpacity>
      </View>

      {/* Customer Cards List */}
      <FlatList
        style={styles.list}
        data={sortedCustomers}
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
        renderItem={({ item: cust }: { item: Customer }) => (
          <CustomerCard
            customer={cust}
            onSelect={handleSelectCustomer}
            onStartSale={(c) => {
              if (onSelectCustomerForPOS) onSelectCustomerForPOS(c)
              onNavigate('pos')
            }}
          />
        )}
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

                {/* Order History & Ordered Products */}
                <View style={styles.orderSectionHeaderRow}>
                  <Text style={[styles.sectionHeader, { marginBottom: 0 }]}>Order History & Products</Text>
                  {Boolean(detailsLoading) && (
                    <ActivityIndicator size="small" color={tokens.colors.primaryContainer} />
                  )}
                </View>

                {sortedModalOrders.length > 0 ? (
                  sortedModalOrders.map((order) => {
                    const isExpanded = Boolean(expandedOrders[order.id])
                    const itemCount = order.items?.length || 0
                    const totalAmount = Number(order.total_amount || 0)
                    const orderDate = order.created_at ? new Date(order.created_at).toLocaleDateString() : 'N/A'
                    const channelName = order.channel?.name || order.salesChannel?.name || 'POS'
                    const channelMeta = getChannelPlatformMeta(order.channel, order.channel_id || channelName)

                    return (
                      <View key={order.id} style={styles.orderHistoryCard}>
                        <TouchableOpacity
                          style={styles.orderHeaderRow}
                          onPress={() => toggleOrderExpand(order.id)}
                          activeOpacity={0.7}
                        >
                          <View style={{ flex: 1 }}>
                            <View style={styles.orderMetaRow}>
                              <Text style={styles.orderNum}>{order.order_number}</Text>
                              <View style={[styles.channelBadge, channelMeta?.bg ? { backgroundColor: channelMeta.bg, borderColor: (channelMeta.color || '#2563EB') + '33' } : null]}>
                                <Ionicons
                                  name={channelMeta?.icon || 'storefront-outline'}
                                  size={11}
                                  color={channelMeta?.color || '#2563EB'}
                                  style={{ marginRight: 3 }}
                                />
                                <Text style={[styles.channelBadgeText, channelMeta?.color ? { color: channelMeta.color } : null]}>
                                  {channelName}
                                </Text>
                              </View>
                              <View style={[styles.statusBadge, { backgroundColor: order.status === 'completed' || order.status === 'paid' ? '#DCFCE7' : '#FEF3C7' }]}>
                                <Text style={[styles.statusBadgeText, { color: order.status === 'completed' || order.status === 'paid' ? '#15803D' : '#B45309' }]}>
                                  {{ completed: 'Completed', paid: 'Paid', pending: 'Pending', cancelled: 'Cancelled' }[order.status] || order.status}
                                </Text>
                              </View>
                            </View>
                            <Text style={styles.orderDate}>{orderDate} • {itemCount} {itemCount === 1 ? 'product' : 'products'}</Text>
                          </View>

                          <View style={{ alignItems: 'flex-end', marginLeft: 8 }}>
                            <Text style={styles.orderTotal}>${totalAmount.toFixed(2)}</Text>
                            <View style={styles.viewProductsToggle}>
                              <Text style={styles.viewProductsToggleText}>
                                {isExpanded ? 'Hide' : 'Products'}
                              </Text>
                              <Ionicons
                                name={isExpanded ? 'chevron-up' : 'chevron-down'}
                                size={13}
                                color={tokens.colors.primaryContainer}
                              />
                            </View>
                          </View>
                        </TouchableOpacity>

                        {/* Product Items Breakdown */}
                        {Boolean(isExpanded) && (
                          <View style={styles.orderItemsContainer}>
                            <View style={styles.orderItemsHeader}>
                              <Text style={styles.orderItemsHeaderText}>ORDERED PRODUCTS</Text>
                            </View>
                            {order.items && order.items.length > 0 ? (
                              order.items.map((item, idx) => {
                                const prodName = item.product?.name || item.product_name || item.productName || 'Product'
                                const variantInfo = (item.variant && typeof item.variant === 'object' && 'name' in item.variant && item.variant.name)
                                  ? item.variant.name
                                  : (item.sku || (item.variant && typeof item.variant === 'object' && 'sku' in item.variant ? item.variant.sku : '') || '')
                                const itemQty = item.quantity || 1
                                const itemPrice = Number(item.unit_price || 0)
                                const itemTotal = Number(item.total_price || (itemQty * itemPrice))

                                return (
                                  <View key={item.id || idx} style={[styles.orderItemRow, idx > 0 && styles.orderItemBorder]}>
                                    <View style={styles.productIconBox}>
                                      <Ionicons name="cube-outline" size={14} color={tokens.colors.primaryContainer} />
                                    </View>
                                    <View style={{ flex: 1, marginLeft: 8 }}>
                                      <Text style={styles.productNameText} numberOfLines={1}>{prodName}</Text>
                                      {Boolean(variantInfo) && (
                                        <Text style={styles.productVariantText} numberOfLines={1}>{variantInfo}</Text>
                                      )}
                                      <Text style={styles.productQtyPriceText}>
                                        {itemQty} × ${itemPrice.toFixed(2)}
                                      </Text>
                                    </View>
                                    <Text style={styles.productItemTotal}>${itemTotal.toFixed(2)}</Text>
                                  </View>
                                )
                              })
                            ) : (
                              <Text style={styles.noItemsText}>No product details available</Text>
                            )}
                          </View>
                        )}
                      </View>
                    )
                  })
                ) : (
                  <View style={styles.emptyOrdersBox}>
                    <Ionicons name="receipt-outline" size={24} color={tokens.colors.secondary} />
                    <Text style={styles.emptyOrdersText}>
                      {detailsLoading ? 'Loading order history...' : 'No orders recorded for this customer.'}
                    </Text>
                  </View>
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
  orderSectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 8,
  },
  orderHistoryCard: {
    backgroundColor: tokens.colors.surfaceCard,
    borderRadius: tokens.borderRadius.md,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    marginBottom: 10,
    overflow: 'hidden',
  },
  orderHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  orderMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  orderNum: {
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.onBackground,
  },
  channelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  channelBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#2563EB',
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  orderDate: {
    fontSize: 11,
    color: tokens.colors.secondary,
  },
  orderTotal: {
    fontSize: 14,
    fontWeight: '800',
    color: tokens.colors.onBackground,
  },
  viewProductsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 3,
  },
  viewProductsToggleText: {
    fontSize: 11,
    fontWeight: '600',
    color: tokens.colors.primaryContainer,
  },
  orderItemsContainer: {
    backgroundColor: tokens.colors.background,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.borderSubtle,
    padding: 12,
  },
  orderItemsHeader: {
    marginBottom: 8,
  },
  orderItemsHeaderText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: tokens.colors.secondary,
  },
  orderItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  orderItemBorder: {
    borderTopWidth: 1,
    borderTopColor: tokens.colors.borderSubtle,
  },
  productIconBox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: tokens.colors.actionPrimaryBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productNameText: {
    fontSize: 13,
    fontWeight: '600',
    color: tokens.colors.onBackground,
  },
  productVariantText: {
    fontSize: 11,
    color: tokens.colors.secondary,
    marginTop: 1,
  },
  productQtyPriceText: {
    fontSize: 11,
    color: tokens.colors.secondary,
    marginTop: 2,
  },
  productItemTotal: {
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.onBackground,
    marginLeft: 8,
  },
  noItemsText: {
    fontSize: 12,
    color: tokens.colors.secondary,
    fontStyle: 'italic',
    paddingVertical: 6,
  },
  emptyOrdersBox: {
    backgroundColor: tokens.colors.surfaceCard,
    borderRadius: tokens.borderRadius.md,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyOrdersText: {
    fontSize: 12,
    color: tokens.colors.secondary,
    textAlign: 'center',
  },
  sortBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 6,
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderSubtle,
    backgroundColor: tokens.colors.surfaceCard,
  },
  sortLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: tokens.colors.secondary,
    marginRight: 2,
  },
  sortPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: tokens.borderRadius.pill,
    backgroundColor: tokens.colors.background,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
  },
  sortPillActive: {
    backgroundColor: tokens.colors.primaryContainer,
    borderColor: tokens.colors.primaryContainer,
  },
  sortPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: tokens.colors.secondary,
  },
  sortPillTextActive: {
    color: tokens.colors.onPrimary,
    fontWeight: '700',
  },
})

export default CustomersScreen
