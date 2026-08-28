import React, { useState, useMemo, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  Animated,
  Platform,
  RefreshControl,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Calendar } from 'react-native-calendars'
import { tokens } from '../theme/tokens'
import { getStaffPerformance, fetchAnalyticsReport, AnalyticsReportData } from '../api/endpoints'
import { usePermissions } from '../hooks/usePermissions'
import type { TabType, UserRole, StaffPerformanceSummary } from '../types'

export interface ReportsScreenProps {
  onNavigate: (tab: TabType) => void
  userRole?: UserRole
}

type DateRangeMode = 'today' | '7d' | '30d' | 'year' | 'single' | 'custom'

const DEFAULT_REPORT_DATA: AnalyticsReportData = {
  period: '30d',
  date_from: new Date(Date.now() - 29 * 86400000).toISOString(),
  date_to: new Date().toISOString(),
  revenue: 0,
  ordersCount: 0,
  avgTicket: 0,
  profit: 0,
  expenses: 0,
  netProfit: 0,
  topProducts: [],
  chartBars: [],
}

export const ReportsScreen: React.FC<ReportsScreenProps> = ({
  onNavigate,
  userRole = 'ADMIN',
}) => {
  const { can } = usePermissions()
  const [dateRange, setDateRange] = useState<DateRangeMode>('30d')
  const [singleDate, setSingleDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [customFrom, setCustomFrom] = useState<string>(
    new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
  )
  const [customTo, setCustomTo] = useState<string>(new Date().toISOString().split('T')[0])

  // Modals
  const [customRangeModalOpen, setCustomRangeModalOpen] = useState(false)
  const [tempMode, setTempMode] = useState<'single' | 'custom'>('custom')
  const [tempSingleDate, setTempSingleDate] = useState(singleDate)
  const [tempCustomFrom, setTempCustomFrom] = useState(customFrom)
  const [tempCustomTo, setTempCustomTo] = useState(customTo)

  // Live Data State
  const [reportData, setReportData] = useState<AnalyticsReportData>(DEFAULT_REPORT_DATA)
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  // Staff Performance State
  const [staffPeriod, setStaffPeriod] = useState<'today' | 'week' | 'month'>('today')
  const [staffData, setStaffData] = useState<StaffPerformanceSummary | null>(null)
  const [staffLoading, setStaffLoading] = useState(false)

  // Fetch Live Analytics Report
  const loadAnalytics = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchAnalyticsReport({
        period: dateRange,
        date: dateRange === 'single' ? singleDate : undefined,
        date_from: dateRange === 'custom' ? customFrom : undefined,
        date_to: dateRange === 'custom' ? customTo : undefined,
      })
      if (res && res.data) {
        setReportData(res.data)
      }
    } catch {
      // Fallback baseline reportData retained
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [dateRange, singleDate, customFrom, customTo])

  useEffect(() => {
    loadAnalytics()
  }, [loadAnalytics])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    loadAnalytics()
    fetchStaffPerformance(staffPeriod)
  }, [loadAnalytics, staffPeriod])

  const fetchStaffPerformance = useCallback(async (period: 'today' | 'week' | 'month') => {
    setStaffLoading(true)
    try {
      const res = await getStaffPerformance(period)
      if (res?.data) setStaffData(res.data)
    } catch {
      // silently fail
    } finally {
      setStaffLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStaffPerformance(staffPeriod)
  }, [staffPeriod, fetchStaffPerformance])

  const maxChartVal = useMemo(() => {
    if (!reportData?.chartBars?.length) return 1
    return Math.max(...reportData.chartBars.map((b) => b.val)) || 1
  }, [reportData])

  const handleExport = (format: 'PDF' | 'Excel') => {
    const label =
      dateRange === 'single'
        ? `Single Date (${singleDate})`
        : dateRange === 'custom'
        ? `Custom Range (${customFrom} to ${customTo})`
        : dateRange.toUpperCase()

    Alert.alert(
      `Export ${format}`,
      `Generated full analytics report for ${label} in ${format} format.`,
      [{ text: 'Download & Share' }, { text: 'OK' }]
    )
  }

  // Custom Filter Modal Handler
  const handleOpenCustomModal = () => {
    setTempMode(dateRange === 'single' ? 'single' : 'custom')
    setTempSingleDate(singleDate)
    setTempCustomFrom(customFrom)
    setTempCustomTo(customTo)
    setCustomRangeModalOpen(true)
  }

  const handleApplySingleDate = () => {
    if (!tempSingleDate.trim()) {
      Alert.alert('Required', 'Please enter a valid date (YYYY-MM-DD).')
      return
    }
    setSingleDate(tempSingleDate.trim())
    setDateRange('single')
    setCustomRangeModalOpen(false)
  }

  const handleApplyCustomRange = () => {
    if (!tempCustomFrom.trim() || !tempCustomTo.trim()) {
      Alert.alert('Required', 'Please enter both start date and end date (YYYY-MM-DD).')
      return
    }
    setCustomFrom(tempCustomFrom.trim())
    setCustomTo(tempCustomTo.trim())
    setDateRange('custom')
    setCustomRangeModalOpen(false)
  }

  // Calendar Range Logic
  const handleRangeDayPress = (day: any) => {
    if (!tempCustomFrom || (tempCustomFrom && tempCustomTo)) {
      setTempCustomFrom(day.dateString)
      setTempCustomTo('')
    } else {
      if (day.dateString < tempCustomFrom) {
        setTempCustomTo(tempCustomFrom)
        setTempCustomFrom(day.dateString)
      } else {
        setTempCustomTo(day.dateString)
      }
    }
  }

  const getRangeMarkedDates = () => {
    const marks: any = {}
    if (tempCustomFrom) {
      marks[tempCustomFrom] = { startingDay: true, color: tokens.colors.primaryContainer, textColor: 'white', selected: true, selectedColor: tokens.colors.primaryContainer }
    }
    if (tempCustomTo) {
      marks[tempCustomTo] = { endingDay: true, color: tokens.colors.primaryContainer, textColor: 'white', selected: true, selectedColor: tokens.colors.primaryContainer }
      
      let curr = new Date(tempCustomFrom)
      curr.setDate(curr.getDate() + 1)
      const end = new Date(tempCustomTo)
      while (curr < end) {
        const dateStr = curr.toISOString().split('T')[0]
        marks[dateStr] = { color: tokens.colors.primaryContainer + '40', textColor: tokens.colors.onBackground, selected: true, selectedColor: tokens.colors.primaryContainer + '40' }
        curr.setDate(curr.getDate() + 1)
      }
    }
    return marks
  }

  // Helper date offset
  const getPastDateStr = (daysAgo: number) => {
    const d = new Date(Date.now() - daysAgo * 86400000)
    return d.toISOString().split('T')[0]
  }

  const getFilterDisplayLabel = () => {
    if (dateRange === 'single') return `Date: ${singleDate}`
    if (dateRange === 'custom') return `${customFrom} → ${customTo}`
    if (dateRange === 'today') return 'Today'
    if (dateRange === '7d') return '7 Days'
    if (dateRange === '30d') return '30 Days'
    return 'This Year'
  }

  return (
    <View style={styles.container}>
      {/* Compact row: date range chips + export icon */}
      <View style={styles.compactHeaderRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dateSelectorContent}
          style={{ flex: 1 }}
        >
          <TouchableOpacity
            style={[styles.dateBtn, dateRange === 'today' && styles.dateBtnActive]}
            onPress={() => setDateRange('today')}
          >
            <Text style={[styles.dateBtnText, dateRange === 'today' && styles.dateBtnTextActive]} numberOfLines={1}>
              Today
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.dateBtn, dateRange === '7d' && styles.dateBtnActive]}
            onPress={() => setDateRange('7d')}
          >
            <Text style={[styles.dateBtnText, dateRange === '7d' && styles.dateBtnTextActive]} numberOfLines={1}>
              7 Days
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.dateBtn, dateRange === '30d' && styles.dateBtnActive]}
            onPress={() => setDateRange('30d')}
          >
            <Text style={[styles.dateBtnText, dateRange === '30d' && styles.dateBtnTextActive]} numberOfLines={1}>
              30 Days
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.dateBtn, dateRange === 'year' && styles.dateBtnActive]}
            onPress={() => setDateRange('year')}
          >
            <Text style={[styles.dateBtnText, dateRange === 'year' && styles.dateBtnTextActive]} numberOfLines={1}>
              Year
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.dateBtn, (dateRange === 'single' || dateRange === 'custom') && styles.dateBtnActive, { flexDirection: 'row', gap: 4 }]}
            onPress={handleOpenCustomModal}
          >
            <Ionicons
              name="calendar"
              size={12}
              color={(dateRange === 'single' || dateRange === 'custom') ? tokens.colors.onPrimary : tokens.colors.secondary}
            />
            <Text style={[styles.dateBtnText, (dateRange === 'single' || dateRange === 'custom') && styles.dateBtnTextActive]} numberOfLines={1}>
              {dateRange === 'single' 
                ? singleDate 
                : dateRange === 'custom' 
                ? `${new Date(customFrom).toLocaleDateString('en-US', {month: 'short', day: 'numeric'})} - ${new Date(customTo).toLocaleDateString('en-US', {month: 'short', day: 'numeric'})}`
                : 'Custom'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[tokens.colors.primaryContainer]}
            tintColor={tokens.colors.primaryContainer}
          />
        }
      >
        {/* Loading Indicator */}
        {Boolean(loading && !refreshing) && (
          <View style={{ paddingVertical: 12, alignItems: 'center' }}>
            <ActivityIndicator size="small" color={tokens.colors.primaryContainer} />
          </View>
        )}

        {/* Active Filter Context Banner */}
        <View style={styles.activeFilterBanner}>
          <Ionicons name="time-outline" size={14} color={tokens.colors.primaryContainer} />
          <Text style={styles.activeFilterBannerText}>Reporting Period: {getFilterDisplayLabel()}</Text>
        </View>

        {/* KPI Hero Bento */}
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View>
              <Text style={styles.heroSubtitle}>TOTAL NET REVENUE</Text>
              <Text style={styles.heroAmount}>
                ${Number(reportData.revenue || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
            </View>
            <View style={styles.heroTrendBadge}>
              <Ionicons name="trending-up" size={13} color="#22C55E" />
              <Text style={styles.heroTrendText}>Live</Text>
            </View>
          </View>
          
          <View style={styles.heroBreakdownRow}>
            <View style={styles.heroPillItem}>
              <Ionicons name="receipt-outline" size={12} color="#38BDF8" />
              <Text style={styles.heroPillText}>
                {reportData.ordersCount || 0} {(reportData.ordersCount || 0) === 1 ? 'Order' : 'Orders'}
              </Text>
            </View>
            <View style={styles.heroPillItem}>
              <Ionicons name="analytics-outline" size={12} color="#FB923C" />
              <Text style={styles.heroPillText}>
                ${Number(reportData.avgTicket || 0).toFixed(2)} Basket
              </Text>
            </View>
          </View>
        </View>

        {/* 4-Grid Metrics */}
        <View style={styles.grid}>
          <View style={styles.gridCard}>
            <Text style={styles.gridLabel}>Gross Profit</Text>
            <Text style={[styles.gridVal, { color: tokens.colors.statusSuccess }]}>
              ${Number(reportData.profit || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
          </View>
          <View style={styles.gridCard}>
            <Text style={styles.gridLabel}>Net Profit</Text>
            <Text style={[styles.gridVal, { color: tokens.colors.primaryContainer }]}>
              ${Number(reportData.netProfit || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
          </View>
          <View style={styles.gridCard}>
            <Text style={styles.gridLabel}>Operational Expenses</Text>
            <Text style={[styles.gridVal, { color: tokens.colors.statusError }]}>
              ${Number(reportData.expenses || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
          </View>
          <View style={styles.gridCard}>
            <Text style={styles.gridLabel}>Avg Ticket Size</Text>
            <Text style={styles.gridVal}>${Number(reportData.avgTicket || 0).toFixed(2)}</Text>
          </View>
        </View>

        {/* Visual Bar Chart */}
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Revenue Trend ({getFilterDisplayLabel()})</Text>
          {(!reportData.chartBars || reportData.chartBars.length === 0) ? (
            <View style={{ paddingVertical: 20, alignItems: 'center' }}>
              <Text style={{ fontSize: 12, color: tokens.colors.secondary }}>No revenue points recorded for this period</Text>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={[styles.chartBarsContainer, { minWidth: reportData.chartBars.length * 53 }]}>
                {reportData.chartBars.map((bar, idx) => {
                  const heightPercent = Math.max(12, Math.round(((bar.val || 0) / maxChartVal) * 100))

                  return (
                    <View key={idx} style={styles.barColumn}>
                      <Text style={styles.barValText} numberOfLines={1}>
                        ${bar.val > 1000 ? `${(bar.val / 1000).toFixed(1)}k` : bar.val.toFixed(0)}
                      </Text>
                      <View style={styles.barTrack}>
                        <View style={[styles.barFill, { height: `${heightPercent}%` }]} />
                      </View>
                      <Text style={styles.barLabel} numberOfLines={1}>{bar.label}</Text>
                    </View>
                  )
                })}
              </View>
            </ScrollView>
          )}
        </View>

        {/* Top Selling Products */}
        <View style={styles.topProductsCard}>
          <Text style={styles.sectionTitle}>Top Performing Products</Text>
          {(!reportData.topProducts || reportData.topProducts.length === 0) ? (
            <View style={{ paddingVertical: 14, alignItems: 'center' }}>
              <Text style={{ fontSize: 12, color: tokens.colors.secondary }}>No product sales recorded in this period</Text>
            </View>
          ) : (
            reportData.topProducts.map((tp, idx) => (
              <View key={idx} style={styles.productRankRow}>
                <View style={styles.rankBadge}>
                  <Text style={styles.rankNum}>#{idx + 1}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.rankName}>{tp.name}</Text>
                  <Text style={styles.rankSales}>{tp.sales} units sold</Text>
                </View>
                <Text style={styles.rankRevenue}>${Number(tp.revenue || 0).toFixed(2)}</Text>
              </View>
            ))
          )}
        </View>

        {/* Staff Performance Section */}
        <View style={styles.staffSection}>
          <View style={styles.staffHeaderRow}>
            <View>
              <Text style={styles.staffSectionTitle}>Staff Leaderboard</Text>
              <Text style={styles.staffSectionSub}>Team member sales performance</Text>
            </View>
            <View style={styles.staffPeriodRow}>
              {(['today', 'week', 'month'] as const).map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[styles.staffPeriodBtn, staffPeriod === p && styles.staffPeriodBtnActive]}
                  onPress={() => setStaffPeriod(p)}
                >
                  <Text style={[styles.staffPeriodText, staffPeriod === p && styles.staffPeriodTextActive]}>
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {staffLoading ? (
            <ActivityIndicator size="small" color={tokens.colors.primaryContainer} style={{ marginTop: 16 }} />
          ) : !staffData?.leaderboard?.length ? (
            <View style={styles.staffEmpty}>
              <Ionicons name="people-outline" size={28} color={tokens.colors.secondaryFixedDim} />
              <Text style={styles.staffEmptyText}>No staff sales data for this period</Text>
            </View>
          ) : (
            <View>
              {staffData.leaderboard.map((entry) => {
                const isFirst = entry.rank === 1
                return (
                  <View key={entry.user_id} style={[styles.staffCard, isFirst && styles.staffCardTop]}>
                    <View style={[styles.staffRankBadge, isFirst && styles.staffRankBadgeTop]}>
                      {isFirst ? (
                        <Ionicons name="trophy" size={14} color="#F59E0B" />
                      ) : (
                        <Text style={styles.staffRankText}>#{entry.rank}</Text>
                      )}
                    </View>
                    <View style={styles.staffInfo}>
                      <Text style={styles.staffName}>{entry.staff_name}</Text>
                      <Text style={styles.staffRole}>{entry.staff_role.replace('_', ' ')}</Text>
                    </View>
                    <View style={styles.staffStats}>
                      <Text style={styles.staffRevenue}>
                        ${Number(entry.total_revenue || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </Text>
                      <Text style={styles.staffMeta}>{entry.orders_count} orders · {entry.units_sold} units</Text>
                    </View>
                  </View>
                )
              })}
            </View>
          )}
        </View>

        {/* Export Formats */}
        {Boolean(can('reports:export')) && (
          <View style={styles.exportSection}>
            <TouchableOpacity style={styles.exportBtn} onPress={() => handleExport('PDF')}>
              <Ionicons name="document-text" size={18} color={tokens.colors.onBackground} />
              <Text style={styles.exportBtnText}>Download PDF Report</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.exportBtn} onPress={() => handleExport('Excel')}>
              <Ionicons name="grid" size={18} color={tokens.colors.onBackground} />
              <Text style={styles.exportBtnText}>Export Excel (XLSX)</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* ========================================================================= */}
      {/* MODAL: CUSTOM DATE PICKER (SINGLE OR RANGE)                              */}
      {/* ========================================================================= */}
      <Modal visible={customRangeModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Custom Filter</Text>
              <TouchableOpacity onPress={() => setCustomRangeModalOpen(false)}>
                <Ionicons name="close" size={22} color={tokens.colors.onBackground} />
              </TouchableOpacity>
            </View>

            {/* Segmented Control for Single vs Range */}
            <View style={{ flexDirection: 'row', backgroundColor: tokens.colors.surfaceMuted, borderRadius: tokens.borderRadius.sm, padding: 4, marginBottom: 16 }}>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 6, alignItems: 'center', borderRadius: tokens.borderRadius.sm, backgroundColor: tempMode === 'single' ? tokens.colors.surfaceCard : 'transparent', ...(tempMode === 'single' ? tokens.shadows.card : {}) }}
                onPress={() => setTempMode('single')}
              >
                <Text style={{ fontSize: 12, fontWeight: tempMode === 'single' ? '700' : '500', color: tempMode === 'single' ? tokens.colors.primaryContainer : tokens.colors.secondary }}>Single Date</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 6, alignItems: 'center', borderRadius: tokens.borderRadius.sm, backgroundColor: tempMode === 'custom' ? tokens.colors.surfaceCard : 'transparent', ...(tempMode === 'custom' ? tokens.shadows.card : {}) }}
                onPress={() => setTempMode('custom')}
              >
                <Text style={{ fontSize: 12, fontWeight: tempMode === 'custom' ? '700' : '500', color: tempMode === 'custom' ? tokens.colors.primaryContainer : tokens.colors.secondary }}>Date Range</Text>
              </TouchableOpacity>
            </View>

            {tempMode === 'single' ? (
              <View>
                <Text style={styles.modalSubtitle}>Choose a preset or tap a date:</Text>
                <View style={styles.quickPresetsGrid}>
                  <TouchableOpacity style={[styles.presetChip, tempSingleDate === getPastDateStr(0) && styles.presetChipActive]} onPress={() => setTempSingleDate(getPastDateStr(0))}>
                    <Text style={[styles.presetChipText, tempSingleDate === getPastDateStr(0) && styles.presetChipTextActive]}>Today</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.presetChip, tempSingleDate === getPastDateStr(1) && styles.presetChipActive]} onPress={() => setTempSingleDate(getPastDateStr(1))}>
                    <Text style={[styles.presetChipText, tempSingleDate === getPastDateStr(1) && styles.presetChipTextActive]}>Yesterday</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.presetChip, tempSingleDate === getPastDateStr(2) && styles.presetChipActive]} onPress={() => setTempSingleDate(getPastDateStr(2))}>
                    <Text style={[styles.presetChipText, tempSingleDate === getPastDateStr(2) && styles.presetChipTextActive]}>2 Days Ago</Text>
                  </TouchableOpacity>
                </View>
                <View style={{ marginTop: 12, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: tokens.colors.borderSubtle }}>
                  <Calendar
                    current={tempSingleDate}
                    onDayPress={(day: any) => setTempSingleDate(day.dateString)}
                    markedDates={{
                      [tempSingleDate]: {selected: true, disableTouchEvent: true, selectedColor: tokens.colors.primaryContainer}
                    }}
                    theme={{
                      todayTextColor: tokens.colors.primaryContainer,
                      arrowColor: tokens.colors.primaryContainer,
                      textDayFontSize: 13,
                      textMonthFontSize: 13,
                      textDayHeaderFontSize: 12,
                    }}
                  />
                </View>
              </View>
            ) : (
              <View>
                <Text style={styles.modalSubtitle}>Tap start date and end date:</Text>
                <View style={styles.quickPresetsGrid}>
                  <TouchableOpacity style={styles.presetChip} onPress={() => { setTempCustomFrom(getPastDateStr(7)); setTempCustomTo(getPastDateStr(0)); }}>
                    <Text style={styles.presetChipText}>Last 7 Days</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.presetChip} onPress={() => { setTempCustomFrom(getPastDateStr(14)); setTempCustomTo(getPastDateStr(0)); }}>
                    <Text style={styles.presetChipText}>Last 14 Days</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.presetChip} onPress={() => { setTempCustomFrom(getPastDateStr(30)); setTempCustomTo(getPastDateStr(0)); }}>
                    <Text style={styles.presetChipText}>Last 30 Days</Text>
                  </TouchableOpacity>
                </View>
                <View style={{ marginTop: 12, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: tokens.colors.borderSubtle }}>
                  <Calendar
                    current={tempCustomTo || tempCustomFrom || undefined}
                    onDayPress={handleRangeDayPress}
                    markingType={'period'}
                    markedDates={getRangeMarkedDates()}
                    theme={{
                      todayTextColor: tokens.colors.primaryContainer,
                      arrowColor: tokens.colors.primaryContainer,
                      textDayFontSize: 13,
                      textMonthFontSize: 13,
                      textDayHeaderFontSize: 12,
                    }}
                  />
                </View>
              </View>
            )}

            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setCustomRangeModalOpen(false)}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalApplyBtn}
                onPress={() => {
                  if (tempMode === 'single') handleApplySingleDate();
                  else handleApplyCustomRange();
                }}
              >
                <Text style={styles.modalApplyBtnText}>Apply Filter</Text>
              </TouchableOpacity>
            </View>
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
  exportTopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.primaryContainer,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: tokens.borderRadius.pill,
    gap: 4,
    ...tokens.shadows.card,
  },
  exportTopText: {
    color: tokens.colors.onPrimary,
    fontWeight: '700',
    fontSize: 12,
  },
  dateSelector: {
    flexDirection: 'row',
    paddingHorizontal: tokens.spacing.md,
    marginVertical: tokens.spacing.xs,
    gap: 6,
  },
  dateBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignItems: 'center',
    borderRadius: tokens.borderRadius.pill,
    backgroundColor: tokens.colors.surfaceCard,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
  },
  dateBtnActive: {
    backgroundColor: tokens.colors.primaryContainer,
    borderColor: tokens.colors.primaryContainer,
  },
  dateBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: tokens.colors.secondary,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  dateBtnTextActive: {
    color: tokens.colors.onPrimary,
  },
  content: {
    flex: 1,
    paddingHorizontal: tokens.spacing.md,
    paddingTop: tokens.spacing.xs,
  },
  // Hero Financial Performance Card (Matching HomeScreen theme)
  heroCard: {
    backgroundColor: '#1E293B',
    borderRadius: tokens.borderRadius.card,
    padding: tokens.spacing.md,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  heroSubtitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  heroAmount: {
    fontSize: 28,
    fontWeight: '900',
    color: '#F8FAFC',
    letterSpacing: -0.8,
  },
  heroTrendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: tokens.borderRadius.pill,
    gap: 3,
  },
  heroTrendText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#22C55E',
  },
  heroBreakdownRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 2,
  },
  heroPillItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: tokens.borderRadius.pill,
    gap: 4,
  },
  heroPillText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#E2E8F0',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: tokens.spacing.sm,
  },
  gridCard: {
    flex: 1,
    minWidth: '47%',
    backgroundColor: tokens.colors.surfaceCard,
    padding: 12,
    borderRadius: tokens.borderRadius.md,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
  },
  gridLabel: {
    fontSize: 11,
    color: tokens.colors.secondary,
  },
  gridVal: {
    fontSize: 16,
    fontWeight: '800',
    color: tokens.colors.onBackground,
    marginTop: 4,
  },
  chartCard: {
    backgroundColor: tokens.colors.surfaceCard,
    borderRadius: tokens.borderRadius.card,
    padding: tokens.spacing.md,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    marginBottom: tokens.spacing.sm,
    ...tokens.shadows.card,
  },
  chartTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.onBackground,
    marginBottom: 16,
  },
  chartBarsContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    height: 120,
  },
  barColumn: {
    alignItems: 'center',
    width: 45,
    marginHorizontal: 4,
  },
  barValText: {
    fontSize: 9,
    color: tokens.colors.secondary,
    marginBottom: 4,
  },
  barTrack: {
    width: 24,
    height: 80,
    backgroundColor: tokens.colors.surfaceMuted,
    borderRadius: 6,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    backgroundColor: tokens.colors.primaryContainer,
    borderRadius: 6,
  },
  barLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: tokens.colors.secondary,
    marginTop: 6,
  },
  topProductsCard: {
    backgroundColor: tokens.colors.surfaceCard,
    borderRadius: tokens.borderRadius.card,
    padding: tokens.spacing.md,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    marginBottom: tokens.spacing.sm,
    ...tokens.shadows.card,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.onBackground,
    marginBottom: 10,
  },
  productRankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderSubtle,
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: tokens.colors.actionPrimaryBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankNum: {
    fontSize: 11,
    fontWeight: '800',
    color: tokens.colors.primaryContainer,
  },
  rankName: {
    fontSize: 13,
    fontWeight: '600',
    color: tokens.colors.onBackground,
  },
  rankSales: {
    fontSize: 11,
    color: tokens.colors.secondary,
  },
  rankRevenue: {
    fontSize: 13,
    fontWeight: '800',
    color: tokens.colors.onBackground,
  },
  exportSection: {
    gap: 8,
    marginBottom: 40,
    marginTop: 6,
  },
  exportBtn: {
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
  exportBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: tokens.colors.onBackground,
  },
  // Staff Performance Section
  staffSection: {
    marginTop: 8,
    marginBottom: 8,
    backgroundColor: tokens.colors.surfaceCard,
    borderRadius: tokens.borderRadius.card,
    padding: tokens.spacing.md,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    ...tokens.shadows.card,
  },
  staffHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  staffSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: tokens.colors.onBackground,
    marginBottom: 2,
  },
  staffSectionSub: {
    fontSize: 11,
    color: tokens.colors.secondary,
  },
  staffPeriodRow: {
    flexDirection: 'row',
    gap: 4,
  },
  staffPeriodBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: tokens.borderRadius.pill,
    backgroundColor: tokens.colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
  },
  staffPeriodBtnActive: {
    backgroundColor: tokens.colors.primaryContainer,
    borderColor: tokens.colors.primaryContainer,
  },
  staffPeriodText: {
    fontSize: 10,
    fontWeight: '600',
    color: tokens.colors.secondary,
  },
  staffPeriodTextActive: {
    color: tokens.colors.onPrimary,
  },
  staffCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: tokens.borderRadius.md,
    marginBottom: 6,
    backgroundColor: tokens.colors.background,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    gap: 10,
  },
  staffCardTop: {
    borderColor: '#F59E0B',
    backgroundColor: '#FFFBEB',
  },
  staffRankBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: tokens.colors.surfaceContainerLowest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  staffRankBadgeTop: {
    backgroundColor: '#FEF3C7',
  },
  staffRankText: {
    fontSize: 10,
    fontWeight: '800',
    color: tokens.colors.secondary,
  },
  staffInfo: {
    flex: 1,
  },
  staffName: {
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.onBackground,
  },
  staffRole: {
    fontSize: 10,
    fontWeight: '500',
    color: tokens.colors.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  staffStats: {
    alignItems: 'flex-end',
  },
  staffRevenue: {
    fontSize: 13,
    fontWeight: '800',
    color: tokens.colors.onBackground,
  },
  staffMeta: {
    fontSize: 10,
    color: tokens.colors.secondary,
    marginTop: 1,
  },
  staffEmpty: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  staffEmptyText: {
    fontSize: 12,
    color: tokens.colors.secondary,
  },
  // Filter Banner
  activeFilterBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.surfaceContainerLowest,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: tokens.borderRadius.pill,
    marginBottom: tokens.spacing.sm,
    gap: 6,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
  },
  activeFilterBannerText: {
    fontSize: 11,
    fontWeight: '700',
    color: tokens.colors.primaryContainer,
  },
  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    padding: tokens.spacing.md,
  },
  modalCard: {
    backgroundColor: tokens.colors.surfaceCard,
    borderRadius: tokens.borderRadius.card,
    padding: tokens.spacing.md,
    ...tokens.shadows.card,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: tokens.colors.onBackground,
  },
  modalSubtitle: {
    fontSize: 12,
    color: tokens.colors.secondary,
    marginBottom: 12,
  },
  quickPresetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  presetChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: tokens.borderRadius.pill,
    backgroundColor: tokens.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
  },
  presetChipActive: {
    backgroundColor: tokens.colors.primaryContainer,
    borderColor: tokens.colors.primaryContainer,
  },
  presetChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: tokens.colors.onBackground,
  },
  presetChipTextActive: {
    color: tokens.colors.onPrimary,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: tokens.colors.secondary,
    marginBottom: 4,
  },
  textInput: {
    backgroundColor: tokens.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    borderRadius: tokens.borderRadius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: tokens.colors.onBackground,
  },
  modalActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 16,
  },
  modalCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: tokens.borderRadius.pill,
  },
  modalCancelBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: tokens.colors.secondary,
  },
  modalApplyBtn: {
    backgroundColor: tokens.colors.primaryContainer,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: tokens.borderRadius.pill,
  },
  modalApplyBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: tokens.colors.onPrimary,
  },
})

export default ReportsScreen
