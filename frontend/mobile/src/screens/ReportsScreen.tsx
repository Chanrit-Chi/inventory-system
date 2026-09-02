import React, { useState, useMemo, useEffect, useCallback } from 'react'
import {
  View,
  ScrollView,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Text,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../theme/tokens'
import {
  getStaffPerformance,
  fetchAnalyticsReport,
  AnalyticsReportData,
} from '../api/endpoints'
import { usePermissions } from '../hooks/usePermissions'
import type { TabType, UserRole, StaffPerformanceSummary } from '../types'
import { styles } from './reports/ReportsScreen.styles'
import {
  DateRangeMode,
  DEFAULT_REPORT_DATA,
  getReportDateLabel,
} from './reports/reportUtils'
import { ReportDateFilterBar } from './reports/components/ReportDateFilterBar'
import { ReportRevenueKPICards } from './reports/components/ReportRevenueKPICards'
import { ReportSalesTrendsChart } from './reports/components/ReportSalesTrendsChart'
import { ReportTopSellingProducts } from './reports/components/ReportTopSellingProducts'
import { ReportStaffPerformanceSection } from './reports/components/ReportStaffPerformanceSection'
import { ReportDateRangeModal } from './reports/components/ReportDateRangeModal'

export interface ReportsScreenProps {
  onNavigate: (tab: TabType) => void
  userRole?: UserRole
}

export const ReportsScreen: React.FC<ReportsScreenProps> = ({
  userRole = 'ADMIN',
}) => {
  const { can } = usePermissions()
  const [dateRange, setDateRange] = useState<DateRangeMode>('30d')
  const [singleDate, setSingleDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  )
  const [customFrom, setCustomFrom] = useState<string>(
    new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
  )
  const [customTo, setCustomTo] = useState<string>(
    new Date().toISOString().split('T')[0]
  )

  // Modals
  const [customRangeModalOpen, setCustomRangeModalOpen] = useState(false)
  const [tempMode, setTempMode] = useState<'single' | 'custom'>('custom')
  const [tempSingleDate, setTempSingleDate] = useState(singleDate)
  const [tempCustomFrom, setTempCustomFrom] = useState(customFrom)
  const [tempCustomTo, setTempCustomTo] = useState(customTo)

  // Live Data State
  const [reportData, setReportData] = useState<AnalyticsReportData>(
    DEFAULT_REPORT_DATA
  )
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

  const fetchStaffPerformance = useCallback(
    async (period: 'today' | 'week' | 'month') => {
      setStaffLoading(true)
      try {
        const res = await getStaffPerformance(period)
        if (res?.data) setStaffData(res.data)
      } catch {
        // silently fail
      } finally {
        setStaffLoading(false)
      }
    },
    []
  )

  useEffect(() => {
    fetchStaffPerformance(staffPeriod)
  }, [staffPeriod, fetchStaffPerformance])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    loadAnalytics()
    fetchStaffPerformance(staffPeriod)
  }, [loadAnalytics, staffPeriod, fetchStaffPerformance])

  const maxChartVal = useMemo(() => {
    if (!reportData?.chartBars?.length) return 1
    return Math.max(...reportData.chartBars.map((b) => b.val)) || 1
  }, [reportData])

  const handleExport = (format: 'PDF' | 'Excel') => {
    const label = getReportDateLabel(dateRange, singleDate, customFrom, customTo)

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
      Alert.alert(
        'Required',
        'Please enter both start date and end date (YYYY-MM-DD).'
      )
      return
    }
    setCustomFrom(tempCustomFrom.trim())
    setCustomTo(tempCustomTo.trim())
    setDateRange('custom')
    setCustomRangeModalOpen(false)
  }

  const filterDisplayLabel = useMemo(() => {
    if (dateRange === 'single') return `Date: ${singleDate}`
    if (dateRange === 'custom') return `${customFrom} → ${customTo}`
    if (dateRange === 'today') return 'Today'
    if (dateRange === '7d') return '7 Days'
    if (dateRange === '30d') return '30 Days'
    return 'This Year'
  }, [dateRange, singleDate, customFrom, customTo])

  return (
    <View style={styles.container}>
      {/* Header & Date Filter Strip */}
      <ReportDateFilterBar
        dateRange={dateRange}
        setDateRange={setDateRange}
        singleDate={singleDate}
        customFrom={customFrom}
        customTo={customTo}
        onOpenCustomModal={handleOpenCustomModal}
        canExport={Boolean(can('reports:export'))}
        onExport={handleExport}
      />

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
          <Text style={styles.activeFilterBannerText}>
            Reporting Period: {filterDisplayLabel}
          </Text>
        </View>

        {/* Hero & 4-Grid Metrics */}
        <ReportRevenueKPICards reportData={reportData} />

        {/* Sales Trends Chart */}
        <ReportSalesTrendsChart
          reportData={reportData}
          filterDisplayLabel={filterDisplayLabel}
          maxChartVal={maxChartVal}
        />

        {/* Top Selling Products */}
        <ReportTopSellingProducts topProducts={reportData.topProducts} />

        {/* Staff Performance Leaderboard */}
        <ReportStaffPerformanceSection
          staffPeriod={staffPeriod}
          setStaffPeriod={setStaffPeriod}
          staffLoading={staffLoading}
          staffData={staffData}
        />

        {/* Bottom Spacer */}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Custom Date Range Picker Modal */}
      <ReportDateRangeModal
        visible={customRangeModalOpen}
        tempMode={tempMode}
        setTempMode={setTempMode}
        tempSingleDate={tempSingleDate}
        setTempSingleDate={setTempSingleDate}
        tempCustomFrom={tempCustomFrom}
        setTempCustomFrom={setTempCustomFrom}
        tempCustomTo={tempCustomTo}
        setTempCustomTo={setTempCustomTo}
        onClose={() => setCustomRangeModalOpen(false)}
        onApplySingleDate={handleApplySingleDate}
        onApplyCustomRange={handleApplyCustomRange}
      />
    </View>
  )
}

export default ReportsScreen
