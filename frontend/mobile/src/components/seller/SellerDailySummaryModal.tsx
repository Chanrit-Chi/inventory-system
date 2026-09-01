import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
  Share,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../../theme/tokens'
import {
  fetchSellerSettlementSummary,
  confirmSellerSettlement,
  fetchStaffMembers,
} from '../../api/endpoints'
import { getPrinterDevices, printSellerDailySlip, type PrinterDevice } from '../../utils/thermalPrinter'
import { PrinterPickerModal } from '../PrinterPickerModal'
import { SellerPickerModal } from '../pos/SellerPickerModal'
import { RefreshControl } from 'react-native'
import type {
  UserAccount,
  SellerDailySettlementSummary,
  SellerSettlementOrderItem,
} from '../../types'

export interface SellerDailySummaryModalProps {
  visible: boolean
  onClose: () => void
  currentUser: UserAccount | null
  targetSeller?: UserAccount | null
  initialDate?: string
}

export const SellerDailySummaryModal: React.FC<SellerDailySummaryModalProps> = ({
  visible,
  onClose,
  currentUser,
  targetSeller,
  initialDate,
}) => {
  const [viewingSeller, setViewingSeller] = useState<UserAccount | null>(targetSeller || currentUser)
  const [staffUsers, setStaffUsers] = useState<UserAccount[]>([])
  const [staffPickerOpen, setStaffPickerOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string>(
    initialDate || new Date().toISOString().split('T')[0]
  )
  const [summaryData, setSummaryData] = useState<SellerDailySettlementSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [notes, setNotes] = useState('')
  const [activeTab, setActiveTab] = useState<'all' | 'direct' | 'assisted'>('all')

  // Printer State
  const isManager = useMemo(() => {
    if (!currentUser?.role) return false
    const r = currentUser.role.toUpperCase().trim()
    return r === 'SUPER_ADMIN' || r === 'SUPERADMIN' || r === 'ADMIN' || r === 'MANAGER'
  }, [currentUser?.role])

  const seller = isManager ? (viewingSeller || targetSeller || currentUser) : currentUser

  useEffect(() => {
    if (visible) {
      getPrinterDevices().then(setPrinterDevices).catch(() => null)
      if (isManager) {
        fetchStaffMembers().then((res) => {
          if (Array.isArray(res)) setStaffUsers(res)
        }).catch(() => null)
        if (targetSeller) {
          setViewingSeller(targetSeller)
        } else if (currentUser && !viewingSeller) {
          setViewingSeller(currentUser)
        }
      } else {
        setViewingSeller(currentUser)
      }
    }
  }, [visible, isManager, targetSeller, currentUser])

  const loadSummary = useCallback(async (isPullRefresh = false) => {
    if (!seller?.id) return
    if (isPullRefresh) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }
    try {
      const res = await fetchSellerSettlementSummary(selectedDate, seller.id)
      if (res.data) {
        setSummaryData(res.data)
      }
    } catch (err: unknown) {
      console.warn('Failed to fetch seller daily settlement:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [seller?.id, selectedDate])

  useEffect(() => {
    if (visible && seller?.id) {
      loadSummary()
    }
  }, [visible, seller?.id, selectedDate, loadSummary])

  const formatLocalDate = (d: Date): string => {
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const todayStr = useMemo(() => formatLocalDate(new Date()), [])

  const handleChangeDate = (offsetDays: number) => {
    const parts = selectedDate.split('-').map(Number)
    const current = new Date(parts[0], parts[1] - 1, parts[2])
    current.setDate(current.getDate() + offsetDays)
    setSelectedDate(formatLocalDate(current))
  }

  const handleResetToToday = () => {
    setSelectedDate(todayStr)
  }

  const hasNoSales = (summaryData?.total_orders_count || 0) === 0

  const handleConfirmSettlement = async () => {
    if (!seller?.id) return
    if (hasNoSales) {
      Alert.alert('No Sales Recorded', 'This staff member has no sales recorded on this date. Sign-off is disabled.')
      return
    }
    Alert.alert(
      "Confirm Today's Sales & Incentive",
      `Are you sure you want to confirm ${summaryData?.total_orders_count || 0} orders totaling $${(summaryData?.total_sales_amount || 0).toFixed(2)} with estimated incentive of +$${(summaryData?.total_incentive_amount || 0).toFixed(2)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm & Sign Off',
          style: 'default',
          onPress: async () => {
            setConfirming(true)
            try {
              await confirmSellerSettlement({
                seller_id: seller.id,
                confirmed_date: selectedDate,
                notes: notes.trim() || undefined,
              })
              Alert.alert('Signed Off!', 'Daily sales settlement has been confirmed and saved.')
              loadSummary()
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : 'Confirmation failed.'
              Alert.alert('Error', msg)
            } finally {
              setConfirming(false)
            }
          },
        },
      ]
    )
  }

  // Print Slip
  const handlePrintDailySlip = async () => {
    if (!summaryData) return
    const devices = await getPrinterDevices()
    const defaultPrinter = devices.find((d) => d.isDefault) || devices[0]
    if (!defaultPrinter) {
      setPrinterPickerOpen(true)
      return
    }

    setPrinting(true)
    try {
      await printSellerDailySlip(defaultPrinter, summaryData)
    } catch (err: unknown) {
      Alert.alert('Printer Error', err instanceof Error ? err.message : 'Failed to print daily slip.')
    } finally {
      setPrinting(false)
    }
  }

  // Share summary text
  const handleShareSummary = async () => {
    if (!summaryData) return
    const lines = [
      `📊 DAILY SALES CONFIRMATION - ${summaryData.date}`,
      `👤 Seller: ${summaryData.seller?.name}`,
      `💰 Total Sales: $${summaryData.total_sales_amount.toFixed(2)} (${summaryData.total_orders_count} orders)`,
      `🎁 Estimated Incentive: +$${summaryData.total_incentive_amount.toFixed(2)}`,
      `🔹 Direct Sales: ${summaryData.direct_orders_count} orders`,
      `🔹 Assisted by Team: ${summaryData.assisted_orders_count} orders`,
      `Status: ${summaryData.is_confirmed ? '✅ CONFIRMED' : '⏳ PENDING SIGN-OFF'}`,
      summaryData.settlement?.confirmed_at ? `Signed at: ${summaryData.settlement.confirmed_at}` : '',
    ].filter(Boolean).join('\n')

    try {
      await Share.share({ message: lines, title: `Daily Sales - ${summaryData.seller?.name}` })
    } catch (err) {
      console.warn('Share error:', err)
    }
  }

  const displayedOrders = useMemo(() => {
    if (!summaryData) return []
    if (activeTab === 'direct') return summaryData.direct_orders || []
    if (activeTab === 'assisted') return summaryData.assisted_orders || []
    return [...(summaryData.direct_orders || []), ...(summaryData.assisted_orders || [])]
  }, [summaryData, activeTab])

  if (!visible) return null

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>Daily Sales Sign-Off</Text>
              {isManager ? (
                <TouchableOpacity
                  style={styles.sellerSwitchBtn}
                  onPress={() => setStaffPickerOpen(true)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="person" size={13} color={tokens.colors.primary} />
                  <Text style={styles.sellerSwitchText}>
                    {seller?.name || 'Select Staff'}
                  </Text>
                  <Ionicons name="chevron-down" size={13} color={tokens.colors.primary} />
                </TouchableOpacity>
              ) : (
                <View style={styles.sellerStaticPill}>
                  <Ionicons name="person" size={13} color={tokens.colors.primary} />
                  <Text style={styles.sellerSwitchText}>
                    {seller?.name || 'My Daily Sales'}
                  </Text>
                </View>
              )}
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={24} color={tokens.colors.secondary} />
            </TouchableOpacity>
          </View>

          {/* Date Selector Navigation Bar */}
          <View style={styles.dateNavBar}>
            <TouchableOpacity
              style={styles.dateNavBtn}
              onPress={() => handleChangeDate(-1)}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-back" size={16} color={tokens.colors.onBackground} />
              <Text style={styles.dateNavText}>Prev</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dateBadgeBtn}
              onPress={handleResetToToday}
              activeOpacity={0.8}
            >
              <Ionicons name="calendar-outline" size={14} color={tokens.colors.primary} />
              <Text style={styles.dateBadgeText}>
                {selectedDate === todayStr ? `Today (${selectedDate})` : selectedDate}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dateNavBtn}
              onPress={() => handleChangeDate(1)}
              activeOpacity={0.7}
            >
              <Text style={styles.dateNavText}>Next</Text>
              <Ionicons name="chevron-forward" size={16} color={tokens.colors.onBackground} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={tokens.colors.primary} />
              <Text style={styles.loadingText}>Loading daily reconciliation...</Text>
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => loadSummary(true)}
                  colors={[tokens.colors.primary]}
                />
              }
            >
              {/* Proof / Confirmation Status Banner */}
              {summaryData?.is_confirmed ? (
                <View style={styles.confirmedBanner}>
                  <Ionicons name="checkmark-circle" size={20} color={tokens.colors.statusSuccess} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.confirmedBannerTitle}>
                      Confirmed & Signed Off
                    </Text>
                    <Text style={styles.confirmedBannerSubtitle}>
                      Proof locked at {summaryData.settlement?.confirmed_at?.split(' ')[1] || 'Today'} by {summaryData.settlement?.confirmer?.name || seller?.name}
                    </Text>
                    {Boolean(summaryData.settlement?.notes) && (
                      <Text style={styles.confirmedBannerNotes}>
                        Note: "{summaryData.settlement?.notes}"
                      </Text>
                    )}
                  </View>
                </View>
              ) : summaryData?.settlement?.status === 'REVISED' ? (
                <View style={[styles.confirmedBanner, { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' }]}>
                  <Ionicons name="alert-circle" size={20} color="#D97706" />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.confirmedBannerTitle, { color: '#B45309' }]}>
                      Orders Revised - Re-confirmation Needed
                    </Text>
                    <Text style={[styles.confirmedBannerSubtitle, { color: '#78350F' }]}>
                      An order was modified or reassigned after your previous sign-off.
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={styles.pendingBanner}>
                  <Ionicons name="time-outline" size={20} color="#B45309" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pendingBannerTitle}>Pending Daily Confirmation</Text>
                    <Text style={styles.pendingBannerSubtitle}>
                      Please review all credited orders below and tap "Confirm Today's Sales" to lock in your incentive proof.
                    </Text>
                  </View>
                </View>
              )}

              {/* KPI Glance Cards */}
              <View style={styles.kpiRow}>
                <View style={styles.kpiCard}>
                  <Text style={styles.kpiLabel}>TOTAL SALES</Text>
                  <Text style={styles.kpiValue}>
                    ${(summaryData?.total_sales_amount || 0).toFixed(2)}
                  </Text>
                  <Text style={styles.kpiSub}>
                    {summaryData?.total_orders_count || 0} Total Orders
                  </Text>
                </View>

                <View style={[styles.kpiCard, styles.kpiCardIncentive]}>
                  <Text style={[styles.kpiLabel, { color: tokens.colors.primary }]}>EST. INCENTIVE</Text>
                  <Text style={[styles.kpiValue, { color: tokens.colors.primary }]}>
                    +${(summaryData?.total_incentive_amount || 0).toFixed(2)}
                  </Text>
                  <Text style={styles.kpiSub}>Commission Credit</Text>
                </View>
              </View>

              {/* Attribution Split Pill */}
              <View style={styles.attributionSplitRow}>
                <View style={styles.attributionPill}>
                  <Ionicons name="person" size={13} color={tokens.colors.primary} />
                  <Text style={styles.attributionPillText}>
                    Direct: <Text style={{ fontWeight: '800' }}>{summaryData?.direct_orders_count || 0}</Text> orders
                  </Text>
                </View>
                <View style={[styles.attributionPill, { backgroundColor: '#EDE9FE' }]}>
                  <Ionicons name="people" size={13} color="#6D28D9" />
                  <Text style={[styles.attributionPillText, { color: '#6D28D9' }]}>
                    Assisted: <Text style={{ fontWeight: '800' }}>{summaryData?.assisted_orders_count || 0}</Text> orders
                  </Text>
                </View>
              </View>

              {/* Action Toolbar: Print & Share */}
              <View style={styles.toolbarRow}>
                <TouchableOpacity
                  style={styles.printBtn}
                  onPress={handlePrintDailySlip}
                  disabled={printing}
                  activeOpacity={0.8}
                >
                  {printing ? (
                    <ActivityIndicator size="small" color={tokens.colors.onPrimary} />
                  ) : (
                    <>
                      <Ionicons name="print-outline" size={16} color={tokens.colors.onPrimary} />
                      <Text style={styles.printBtnText}>Print Daily Slip</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.shareBtn}
                  onPress={handleShareSummary}
                  activeOpacity={0.8}
                >
                  <Ionicons name="share-social-outline" size={16} color={tokens.colors.primary} />
                  <Text style={styles.shareBtnText}>Share Summary</Text>
                </TouchableOpacity>
              </View>

              {/* Orders Tab Filter */}
              <View style={styles.ordersSectionHeader}>
                <Text style={styles.ordersSectionTitle}>Credited Orders Breakdown</Text>
                <View style={styles.tabPillsGroup}>
                  <TouchableOpacity
                    style={[styles.tabPill, activeTab === 'all' && styles.tabPillActive]}
                    onPress={() => setActiveTab('all')}
                  >
                    <Text style={[styles.tabPillText, activeTab === 'all' && styles.tabPillTextActive]}>
                      All ({summaryData?.total_orders_count || 0})
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.tabPill, activeTab === 'direct' && styles.tabPillActive]}
                    onPress={() => setActiveTab('direct')}
                  >
                    <Text style={[styles.tabPillText, activeTab === 'direct' && styles.tabPillTextActive]}>
                      Direct ({summaryData?.direct_orders_count || 0})
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.tabPill, activeTab === 'assisted' && styles.tabPillActive]}
                    onPress={() => setActiveTab('assisted')}
                  >
                    <Text style={[styles.tabPillText, activeTab === 'assisted' && styles.tabPillTextActive]}>
                      Assisted ({summaryData?.assisted_orders_count || 0})
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Order List */}
              {displayedOrders.length === 0 ? (
                <View style={styles.emptyOrders}>
                  <Ionicons name="receipt-outline" size={36} color={tokens.colors.borderDark} />
                  <Text style={styles.emptyOrdersText}>No orders recorded in this category for today.</Text>
                </View>
              ) : (
                <View style={styles.ordersList}>
                  {displayedOrders.map((item: SellerSettlementOrderItem) => (
                    <View key={item.id} style={styles.orderCard}>
                      <View style={styles.orderCardHeader}>
                        <View>
                          <Text style={styles.orderNumber}>#{item.order_number || item.id.substring(0, 8)}</Text>
                          <Text style={styles.orderCustomer}>{item.customer_name} • {item.channel_name}</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={styles.orderAmount}>${item.total_amount.toFixed(2)}</Text>
                          <Text style={styles.orderIncentive}>+${item.incentive.toFixed(2)} inc.</Text>
                        </View>
                      </View>

                      {/* Operator badge if assisted */}
                      {item.is_assisted && item.input_by_user ? (
                        <View style={styles.assistedBadge}>
                          <Ionicons name="people-outline" size={12} color="#6D28D9" />
                          <Text style={styles.assistedBadgeText}>
                            Input by colleague: <Text style={{ fontWeight: '700' }}>{item.input_by_user.name}</Text> ({item.input_by_user.role || 'Staff'})
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  ))}
                </View>
              )}

              {/* Confirmation Sign-off Action Bar */}
              <View style={styles.confirmSection}>
                <TextInput
                  style={styles.notesInput}
                  placeholder="Optional note for manager / settlement audit..."
                  placeholderTextColor={tokens.colors.secondary}
                  value={notes}
                  onChangeText={setNotes}
                />

                <TouchableOpacity
                  style={[
                    styles.confirmButton,
                    (confirming || hasNoSales) && {
                      opacity: 0.6,
                      backgroundColor: hasNoSales ? tokens.colors.surfaceMuted : tokens.colors.primaryContainer,
                      borderWidth: hasNoSales ? 1 : 0,
                      borderColor: tokens.colors.borderSubtle,
                    },
                  ]}
                  onPress={handleConfirmSettlement}
                  disabled={confirming || hasNoSales}
                  activeOpacity={0.85}
                >
                  {confirming ? (
                    <ActivityIndicator size="small" color={tokens.colors.onPrimary} />
                  ) : (
                    <>
                      <Ionicons
                        name={hasNoSales ? 'ban-outline' : 'shield-checkmark'}
                        size={18}
                        color={hasNoSales ? tokens.colors.secondary : tokens.colors.onPrimary}
                      />
                      <Text
                        style={[
                          styles.confirmButtonText,
                          hasNoSales && { color: tokens.colors.secondary },
                        ]}
                      >
                        {hasNoSales
                          ? 'No Sales to Sign Off'
                          : summaryData?.is_confirmed
                          ? 'Re-Confirm & Update Sign-Off'
                          : "Confirm & Sign Off Today's Sales"}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </View>
      </View>

      {/* Printer Picker Modal */}
      <PrinterPickerModal
        visible={printerPickerOpen}
        devices={printerDevices}
        onSelectDevice={async (device) => {
          setPrinterPickerOpen(false)
          if (summaryData) {
            setPrinting(true)
            try {
              await printSellerDailySlip(device, summaryData)
            } catch (err: unknown) {
              Alert.alert('Printer Error', err instanceof Error ? err.message : 'Failed to print daily slip.')
            } finally {
              setPrinting(false)
            }
          }
        }}
        onClose={() => setPrinterPickerOpen(false)}
      />

      {/* Staff Picker Modal to switch viewing seller */}
      <SellerPickerModal
        visible={staffPickerOpen}
        onClose={() => setStaffPickerOpen(false)}
        users={staffUsers}
        selectedSellerId={seller?.id || null}
        currentUserId={currentUser?.id}
        onSelectSeller={(user) => {
          setViewingSeller(user)
          setStaffPickerOpen(false)
        }}
        onResetToMe={() => {
          if (currentUser) setViewingSeller(currentUser)
          setStaffPickerOpen(false)
        }}
      />
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: tokens.colors.surfaceContainerLowest,
    borderTopLeftRadius: tokens.borderRadius.xl,
    borderTopRightRadius: tokens.borderRadius.xl,
    height: '92%',
    paddingTop: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing.md,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderSubtle,
  },
  headerTitle: {
    ...tokens.typography.section,
    color: tokens.colors.onBackground,
    fontSize: 16,
  },
  sellerSwitchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.primaryFixed,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: tokens.borderRadius.pill,
    alignSelf: 'flex-start',
    marginTop: 4,
    gap: 4,
  },
  sellerStaticPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.surfaceMuted,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: tokens.borderRadius.pill,
    alignSelf: 'flex-start',
    marginTop: 4,
    gap: 4,
  },
  sellerSwitchText: {
    ...tokens.typography.bodySemibold,
    color: tokens.colors.primary,
    fontSize: 12,
  },
  dateNavBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 8,
    backgroundColor: tokens.colors.surfaceMuted,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderSubtle,
  },
  dateNavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: tokens.borderRadius.sm,
    gap: 2,
  },
  dateNavText: {
    ...tokens.typography.bodySemibold,
    color: tokens.colors.onBackground,
    fontSize: 12,
  },
  dateBadgeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.surfaceCard,
    borderWidth: 1,
    borderColor: tokens.colors.primaryContainer,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: tokens.borderRadius.pill,
    gap: 6,
  },
  dateBadgeText: {
    ...tokens.typography.bodySemibold,
    color: tokens.colors.primary,
    fontSize: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    ...tokens.typography.body,
    color: tokens.colors.secondary,
  },
  scrollContent: {
    padding: tokens.spacing.md,
    paddingBottom: tokens.spacing.xxl,
  },
  confirmedBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: tokens.colors.statusSuccess,
    borderRadius: tokens.borderRadius.md,
    padding: 12,
    gap: 10,
    marginBottom: 12,
  },
  confirmedBannerTitle: {
    ...tokens.typography.bodySemibold,
    color: '#065F46',
  },
  confirmedBannerSubtitle: {
    ...tokens.typography.caption,
    color: '#047857',
    marginTop: 2,
  },
  confirmedBannerNotes: {
    fontSize: 11,
    fontStyle: 'italic',
    color: '#065F46',
    marginTop: 4,
  },
  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: tokens.borderRadius.md,
    padding: 12,
    gap: 10,
    marginBottom: 12,
  },
  pendingBannerTitle: {
    ...tokens.typography.bodySemibold,
    color: '#92400E',
  },
  pendingBannerSubtitle: {
    ...tokens.typography.caption,
    color: '#78350F',
    marginTop: 2,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: tokens.colors.surfaceCard,
    borderRadius: tokens.borderRadius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
  },
  kpiCardIncentive: {
    backgroundColor: tokens.colors.primaryFixed,
    borderColor: tokens.colors.primaryContainer,
  },
  kpiLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: tokens.colors.secondary,
    letterSpacing: 0.5,
  },
  kpiValue: {
    fontSize: 20,
    fontWeight: '800',
    color: tokens.colors.onBackground,
    marginVertical: 2,
    fontVariant: ['tabular-nums'],
  },
  kpiSub: {
    fontSize: 11,
    color: tokens.colors.secondary,
  },
  attributionSplitRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  attributionPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.primaryFixed,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: tokens.borderRadius.pill,
    gap: 6,
  },
  attributionPillText: {
    fontSize: 12,
    color: tokens.colors.primary,
  },
  toolbarRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  printBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.primaryContainer,
    borderRadius: tokens.borderRadius.md,
    paddingVertical: 10,
    gap: 6,
  },
  printBtnText: {
    ...tokens.typography.bodySemibold,
    color: tokens.colors.onPrimary,
    fontSize: 13,
  },
  shareBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    borderRadius: tokens.borderRadius.md,
    paddingVertical: 10,
    gap: 6,
  },
  shareBtnText: {
    ...tokens.typography.bodySemibold,
    color: tokens.colors.primary,
    fontSize: 13,
  },
  ordersSectionHeader: {
    marginTop: 4,
    marginBottom: 10,
    gap: 8,
  },
  ordersSectionTitle: {
    ...tokens.typography.bodySemibold,
    color: tokens.colors.onBackground,
    fontSize: 14,
  },
  tabPillsGroup: {
    flexDirection: 'row',
    backgroundColor: tokens.colors.surfaceMuted,
    borderRadius: tokens.borderRadius.pill,
    padding: 3,
    gap: 4,
  },
  tabPill: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: tokens.borderRadius.pill,
  },
  tabPillActive: {
    backgroundColor: tokens.colors.surfaceContainerLowest,
    ...tokens.shadows.cardInnerDepth,
  },
  tabPillText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: tokens.colors.secondary,
  },
  tabPillTextActive: {
    color: tokens.colors.onBackground,
    fontWeight: '700',
  },
  emptyOrders: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  emptyOrdersText: {
    ...tokens.typography.caption,
    color: tokens.colors.secondary,
  },
  ordersList: {
    gap: 8,
    marginBottom: 14,
  },
  orderCard: {
    backgroundColor: tokens.colors.surfaceCard,
    borderRadius: tokens.borderRadius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
  },
  orderCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  orderNumber: {
    ...tokens.typography.bodySemibold,
    color: tokens.colors.onBackground,
  },
  orderCustomer: {
    ...tokens.typography.caption,
    color: tokens.colors.secondary,
    marginTop: 1,
  },
  orderAmount: {
    fontSize: 14,
    fontWeight: '800',
    color: tokens.colors.onBackground,
    fontVariant: ['tabular-nums'],
  },
  orderIncentive: {
    fontSize: 11,
    fontWeight: '700',
    color: tokens.colors.primary,
    fontVariant: ['tabular-nums'],
  },
  assistedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F3FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: tokens.borderRadius.sm,
    marginTop: 8,
    gap: 5,
  },
  assistedBadgeText: {
    fontSize: 11,
    color: '#6D28D9',
  },
  confirmSection: {
    marginTop: 10,
    gap: 10,
  },
  notesInput: {
    backgroundColor: tokens.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    borderRadius: tokens.borderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    ...tokens.typography.body,
    color: tokens.colors.onBackground,
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.primaryContainer,
    borderRadius: tokens.borderRadius.md,
    paddingVertical: 14,
    gap: 8,
  },
  confirmButtonText: {
    ...tokens.typography.bodySemibold,
    color: tokens.colors.onPrimary,
    fontSize: 15,
  },
})
