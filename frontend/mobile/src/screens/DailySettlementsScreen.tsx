import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../theme/tokens'
import { fetchTeamDailySettlementSummary } from '../api/endpoints'
import { SellerDailySummaryModal } from '../components/seller/SellerDailySummaryModal'
import type {
  TabType,
  UserAccount,
  TeamDailySettlementSummary,
  TeamSellerStatusItem,
} from '../types'
import { styles } from './daily_settlements/DailySettlementsScreen.styles'

export interface DailySettlementsScreenProps {
  onNavigate: (tab: TabType) => void
  currentUser?: UserAccount | null
}

export const DailySettlementsScreen: React.FC<DailySettlementsScreenProps> = ({
  onNavigate,
  currentUser,
}) => {
  const formatLocalDate = (d: Date): string => {
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const todayStr = useMemo(() => formatLocalDate(new Date()), [])
  const [selectedDate, setSelectedDate] = useState<string>(todayStr)
  const [data, setData] = useState<TeamDailySettlementSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'CONFIRMED' | 'PENDING' | 'REVISED'>('ALL')

  // Detail Modal
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [selectedSeller, setSelectedSeller] = useState<UserAccount | null>(null)

  const loadData = useCallback(async (date: string) => {
    setLoading(true)
    try {
      const res = await fetchTeamDailySettlementSummary(date)
      if (res && res.data) {
        setData(res.data)
      }
    } catch (err) {
      console.warn('Failed to load daily settlements:', err)
      Alert.alert('Error', 'Could not load daily settlements data. Please try again.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    loadData(selectedDate)
  }, [selectedDate, loadData])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await loadData(selectedDate)
  }, [selectedDate, loadData])

  const handleChangeDate = (offsetDays: number) => {
    const parts = selectedDate.split('-').map(Number)
    const current = new Date(parts[0], parts[1] - 1, parts[2])
    current.setDate(current.getDate() + offsetDays)
    setSelectedDate(formatLocalDate(current))
  }

  const handleResetToToday = () => {
    setSelectedDate(todayStr)
  }

  const isToday = selectedDate === todayStr

  // Filtered sellers
  const filteredSellers = useMemo(() => {
    if (!data?.sellers) return []
    return data.sellers.filter((item) => {
      // Search filter
      if (search.trim()) {
        const q = search.toLowerCase().trim()
        const matchName = item.seller.name?.toLowerCase().includes(q)
        const matchRole = item.seller.role?.toLowerCase().includes(q)
        if (!matchName && !matchRole) return false
      }

      // Status tab filter
      if (statusFilter === 'CONFIRMED') return item.is_confirmed
      if (statusFilter === 'PENDING') return item.status === 'PENDING'
      if (statusFilter === 'REVISED') return item.status === 'REVISED'
      return true
    })
  }, [data?.sellers, search, statusFilter])

  const activeSellersCount = data?.active_sellers_with_sales || 0
  const confirmedCount = data?.confirmed_sellers_count || 0
  const allConfirmed = activeSellersCount > 0 && confirmedCount >= activeSellersCount
  const progressPercent =
    activeSellersCount > 0 ? Math.min(100, Math.round((confirmedCount / activeSellersCount) * 100)) : 0

  return (
    <View style={styles.container}>
      {/* Screen Top Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => onNavigate('hub')}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={20} color={tokens.colors.onBackground} />
          </TouchableOpacity>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>Daily Sales Settlements</Text>
            <Text style={styles.headerSubtitle}>Manager Reconciliation & Sign-Offs</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.refreshButton}
          onPress={onRefresh}
          disabled={loading || refreshing}
          activeOpacity={0.7}
        >
          <Ionicons
            name="sync"
            size={18}
            color={refreshing ? tokens.colors.primary : tokens.colors.onBackground}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={tokens.colors.primary}
            colors={[tokens.colors.primary]}
          />
        }
      >
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
            style={styles.dateCenterBadge}
            onPress={handleResetToToday}
            activeOpacity={0.8}
          >
            <Ionicons name="calendar" size={15} color={tokens.colors.primary} />
            <Text style={styles.dateCenterText}>
              {isToday ? `Today (${selectedDate})` : selectedDate}
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

        {/* High-Level Team Reconciliation Card */}
        <View style={styles.kpiOverviewCard}>
          <View style={styles.kpiTopRow}>
            <Text style={styles.kpiCardTitle} numberOfLines={1}>
              Team Overview
            </Text>
            <View
              style={[
                styles.kpiProgressPill,
                { backgroundColor: allConfirmed ? '#DCFCE7' : '#FEF3C7' },
              ]}
            >
              <Ionicons
                name={allConfirmed ? 'checkmark-circle' : 'time-outline'}
                size={13}
                color={allConfirmed ? '#15803D' : '#B45309'}
              />
              <Text
                style={[
                  styles.kpiProgressText,
                  { color: allConfirmed ? '#15803D' : '#B45309' },
                ]}
                numberOfLines={1}
              >
                {activeSellersCount === 0
                  ? 'No Sales'
                  : allConfirmed
                  ? `All Confirmed (${confirmedCount}/${activeSellersCount})`
                  : `${confirmedCount}/${activeSellersCount} Confirmed`}
              </Text>
            </View>
          </View>

          {/* Visual Progress Bar */}
          <View style={styles.progressBarTrack}>
            <View
              style={[
                styles.progressBarFill,
                {
                  width: `${progressPercent}%`,
                  backgroundColor: allConfirmed ? '#10B981' : tokens.colors.primaryContainer,
                },
              ]}
            />
          </View>

          {/* 3-Column Metrics Grid */}
          <View style={styles.kpiGrid}>
            <View style={styles.kpiGridItem}>
              <Text style={styles.kpiGridLabel}>TOTAL TEAM SALES</Text>
              <Text style={styles.kpiGridValue}>
                ${(data?.total_team_sales_amount || 0).toFixed(2)}
              </Text>
            </View>
            <View style={styles.kpiGridDivider} />
            <View style={styles.kpiGridItem}>
              <Text style={styles.kpiGridLabel}>TOTAL ORDERS</Text>
              <Text style={styles.kpiGridValue}>
                {data?.total_team_orders_count || 0}
              </Text>
            </View>
            <View style={styles.kpiGridDivider} />
            <View style={styles.kpiGridItem}>
              <Text style={[styles.kpiGridLabel, { color: tokens.colors.primary }]}>
                EST. INCENTIVE
              </Text>
              <Text style={[styles.kpiGridValue, { color: tokens.colors.primary }]}>
                +${(data?.total_team_incentive_amount || 0).toFixed(2)}
              </Text>
            </View>
          </View>
        </View>

        {/* Filter Section: Search & Status Tabs */}
        <View style={styles.filterSection}>
          {/* Search Box */}
          <View style={styles.searchBox}>
            <Ionicons name="search" size={16} color={tokens.colors.secondary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search staff by name or role..."
              placeholderTextColor={tokens.colors.secondary}
              value={search}
              onChangeText={setSearch}
              autoCapitalize="none"
            />
            {Boolean(search) && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={16} color={tokens.colors.secondary} />
              </TouchableOpacity>
            )}
          </View>

          {/* Filter Pills */}
          <View style={styles.filterTabsRow}>
            {(['ALL', 'CONFIRMED', 'PENDING', 'REVISED'] as const).map((tab) => {
              const isActive = statusFilter === tab
              let label = 'All'
              if (tab === 'CONFIRMED') label = 'Signed Off'
              if (tab === 'PENDING') label = 'Pending'
              if (tab === 'REVISED') label = 'Needs Re-Confirm'

              return (
                <TouchableOpacity
                  key={tab}
                  style={[styles.filterTab, isActive && styles.filterTabActive]}
                  onPress={() => setStatusFilter(tab)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.filterTabText, isActive && styles.filterTabTextActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>
        </View>

        {/* Loading Spinner */}
        {loading && !refreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={tokens.colors.primary} />
            <Text style={styles.loadingText}>Fetching team settlement records...</Text>
          </View>
        ) : filteredSellers.length > 0 ? (
          /* List of Detailed Seller Settlement Cards */
          <View style={styles.sellerCardsList}>
            {filteredSellers.map((item) => (
              <SellerSettlementCard
                key={item.seller.id}
                item={item}
                onOpenDetail={() => {
                  const userAccount: UserAccount = {
                    id: item.seller.id,
                    name: item.seller.name,
                    email: item.seller.email || '',
                    role: (item.seller.role || 'SELLER') as any,
                    isActive: true,
                  }
                  setSelectedSeller(userAccount)
                  setDetailModalOpen(true)
                }}
              />
            ))}
          </View>
        ) : (
          /* Empty State */
          <View style={styles.emptyContainer}>
            <Ionicons name="documents-outline" size={40} color={tokens.colors.secondary} />
            <Text style={styles.emptyTitle}>No settlements found</Text>
            <Text style={styles.emptySub}>
              {search
                ? `No staff matching "${search}"`
                : 'No sales or settlement records found for this date.'}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Itemized Order Breakdown & Confirmation Modal */}
      <SellerDailySummaryModal
        visible={detailModalOpen}
        onClose={() => {
          setDetailModalOpen(false)
          setSelectedSeller(null)
          loadData(selectedDate)
        }}
        currentUser={currentUser || null}
        targetSeller={selectedSeller}
        initialDate={selectedDate}
      />
    </View>
  )
}

interface SellerSettlementCardProps {
  item: TeamSellerStatusItem
  onOpenDetail: () => void
}

const SellerSettlementCard: React.FC<SellerSettlementCardProps> = ({ item, onOpenDetail }) => {
  const isConfirmed = item.is_confirmed
  const isRevised = item.status === 'REVISED'
  const hasSales = item.total_orders_count > 0

  const statusBadge = useMemo(() => {
    if (isConfirmed) {
      const timeStr = item.settlement?.confirmed_at?.split(' ')[1] || ''
      return {
        label: timeStr ? `Signed (${timeStr.substring(0, 5)})` : 'Signed Off',
        bg: '#DCFCE7',
        text: '#15803D',
        icon: 'checkmark-circle' as const,
      }
    }
    if (isRevised) {
      return {
        label: 'Needs Re-Confirm',
        bg: '#EDE9FE',
        text: '#6D28D9',
        icon: 'sync-circle' as const,
      }
    }
    if (hasSales) {
      return {
        label: 'Pending',
        bg: '#FEF3C7',
        text: '#B45309',
        icon: 'time' as const,
      }
    }
    return {
      label: 'No Sales',
      bg: tokens.colors.surfaceMuted,
      text: tokens.colors.secondary,
      icon: 'remove-circle-outline' as const,
    }
  }, [isConfirmed, isRevised, hasSales, item.settlement])

  return (
    <View style={styles.sellerCard}>
      {/* Card Header: Avatar, Name, Role, and Status Pill */}
      <View style={styles.sellerCardHeader}>
        <View style={styles.sellerProfileLeft}>
          <View style={[styles.avatarWrap, isConfirmed && styles.avatarWrapConfirmed]}>
            <Text style={[styles.avatarLetter, isConfirmed && styles.avatarLetterConfirmed]}>
              {(item.seller.name || 'S').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.sellerNameWrap}>
            <View style={styles.sellerNameRow}>
              <Text style={styles.sellerNameText} numberOfLines={1}>
                {item.seller.name}
              </Text>
              <View style={styles.rolePill}>
                <Text style={styles.rolePillText}>{item.seller.role || 'Staff'}</Text>
              </View>
            </View>
            {Boolean(item.seller.department) && (
              <Text style={styles.departmentText} numberOfLines={1}>
                {item.seller.department}
              </Text>
            )}
          </View>
        </View>

        <View style={[styles.statusBadgeWrap, { backgroundColor: statusBadge.bg }]}>
          <Ionicons name={statusBadge.icon} size={12} color={statusBadge.text} />
          <Text style={[styles.statusBadgeText, { color: statusBadge.text }]} numberOfLines={1}>
            {statusBadge.label}
          </Text>
        </View>
      </View>

      {/* Metrics Row: Total Sales, Direct Orders, Team Assisted, Incentive */}
      <View style={styles.sellerMetricsRow}>
        <View style={styles.sellerMetricCol}>
          <Text style={styles.sellerMetricLabel}>TOTAL SALES</Text>
          <Text style={styles.sellerMetricVal}>${item.total_sales_amount.toFixed(2)}</Text>
        </View>
        <View style={styles.sellerMetricCol}>
          <Text style={styles.sellerMetricLabel}>DIRECT ORDERS</Text>
          <Text style={styles.sellerMetricVal}>{item.direct_orders_count}</Text>
        </View>
        <View style={styles.sellerMetricCol}>
          <Text style={styles.sellerMetricLabel}>TEAM ASSISTED</Text>
          <Text style={styles.sellerMetricVal}>{item.assisted_orders_count}</Text>
        </View>
        <View style={styles.sellerMetricCol}>
          <Text style={[styles.sellerMetricLabel, { color: tokens.colors.primary }]}>
            INCENTIVE
          </Text>
          <Text style={[styles.sellerMetricVal, { color: tokens.colors.primary }]}>
            +${item.total_incentive_amount.toFixed(2)}
          </Text>
        </View>
      </View>

      {/* Footer Proof / Action Row */}
      <View style={styles.proofFooterRow}>
        <View style={styles.proofMetaLeft}>
          <Ionicons
            name={isConfirmed ? 'shield-checkmark' : 'information-circle-outline'}
            size={14}
            color={isConfirmed ? '#15803D' : tokens.colors.secondary}
          />
          <Text style={styles.proofMetaText} numberOfLines={1}>
            {isConfirmed
              ? `Confirmed by ${item.settlement?.confirmed_by?.name || 'Staff'}`
              : hasSales
              ? 'Awaiting staff end-of-day sign-off'
              : 'No orders logged on this date'}
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.viewSlipBtn,
            !hasSales && styles.viewSlipBtnDisabled,
          ]}
          onPress={onOpenDetail}
          disabled={!hasSales && !isConfirmed}
          activeOpacity={0.75}
        >
          <Text
            style={[
              styles.viewSlipBtnText,
              !hasSales && styles.viewSlipBtnTextDisabled,
            ]}
          >
            {isConfirmed ? 'View Slip' : hasSales ? 'Sign Off Sales' : 'No Sales'}
          </Text>
          {(isConfirmed || hasSales) && (
            <Ionicons name="chevron-forward" size={13} color={tokens.colors.primary} />
          )}
        </TouchableOpacity>
      </View>
    </View>
  )
}

export default DailySettlementsScreen
