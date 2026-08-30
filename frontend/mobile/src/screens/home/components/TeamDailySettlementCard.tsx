import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../../../theme/tokens'
import { fetchTeamDailySettlementSummary } from '../../../api/endpoints'
import type { TeamDailySettlementSummary, TeamSellerStatusItem, UserAccount } from '../../../types'

export interface TeamDailySettlementCardProps {
  currentUser: UserAccount | null
  onOpenSellerSettlement: (seller: UserAccount, date: string) => void
}

export const TeamDailySettlementCard: React.FC<TeamDailySettlementCardProps> = ({
  currentUser,
  onOpenSellerSettlement,
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

  const loadData = useCallback(async (date: string) => {
    setLoading(true)
    try {
      const res = await fetchTeamDailySettlementSummary(date)
      if (res && res.data) {
        setData(res.data)
      }
    } catch (err) {
      console.warn('Failed to load team daily settlements:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData(selectedDate)
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

  const activeSellersCount = data?.active_sellers_with_sales || 0
  const confirmedCount = data?.confirmed_sellers_count || 0
  const allConfirmed = activeSellersCount > 0 && confirmedCount >= activeSellersCount

  return (
    <View style={styles.cardContainer}>
      {/* Card Header */}
      <View style={styles.cardHeader}>
        <View style={styles.titleWrap}>
          <View style={styles.iconCircle}>
            <Ionicons name="shield-checkmark" size={16} color={tokens.colors.primary} />
          </View>
          <View>
            <Text style={styles.cardTitle}>Team Daily Settlements</Text>
            <Text style={styles.cardSubtitle}>Day-by-day sales & proof sign-offs</Text>
          </View>
        </View>

        {/* Progress Pill */}
        <View
          style={[
            styles.progressBadge,
            allConfirmed ? styles.progressBadgeSuccess : styles.progressBadgePending,
          ]}
        >
          <Ionicons
            name={allConfirmed ? 'checkmark-circle' : 'time-outline'}
            size={13}
            color={allConfirmed ? tokens.colors.statusSuccess : '#D97706'}
          />
          <Text
            style={[
              styles.progressBadgeText,
              allConfirmed ? { color: tokens.colors.statusSuccess } : { color: '#D97706' },
            ]}
          >
            {activeSellersCount === 0
              ? 'No Sales'
              : `${confirmedCount}/${activeSellersCount} Confirmed`}
          </Text>
        </View>
      </View>

      {/* Date Navigation Bar */}
      <View style={styles.dateBar}>
        <TouchableOpacity
          style={styles.dateNavBtn}
          onPress={() => handleChangeDate(-1)}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={14} color={tokens.colors.onBackground} />
          <Text style={styles.dateNavText}>Prev</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.dateBadgeBtn, isToday && styles.dateBadgeBtnToday]}
          onPress={handleResetToToday}
          activeOpacity={0.8}
        >
          <Ionicons
            name="calendar-outline"
            size={13}
            color={isToday ? tokens.colors.primary : tokens.colors.secondary}
          />
          <Text style={[styles.dateBadgeText, isToday && { color: tokens.colors.primary, fontWeight: '700' }]}>
            {isToday ? `Today (${selectedDate})` : selectedDate}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.dateNavBtn}
          onPress={() => handleChangeDate(1)}
          activeOpacity={0.7}
        >
          <Text style={styles.dateNavText}>Next</Text>
          <Ionicons name="chevron-forward" size={14} color={tokens.colors.onBackground} />
        </TouchableOpacity>
      </View>

      {/* Summary KPI Strip */}
      {Boolean(data) && (
        <View style={styles.kpiStrip}>
          <View style={styles.kpiItem}>
            <Text style={styles.kpiLabel}>TEAM SALES</Text>
            <Text style={styles.kpiValue}>
              ${(data?.total_team_sales_amount || 0).toFixed(2)}
            </Text>
          </View>
          <View style={styles.kpiDivider} />
          <View style={styles.kpiItem}>
            <Text style={styles.kpiLabel}>ORDERS</Text>
            <Text style={styles.kpiValue}>
              {data?.total_team_orders_count || 0}
            </Text>
          </View>
          <View style={styles.kpiDivider} />
          <View style={styles.kpiItem}>
            <Text style={[styles.kpiLabel, { color: tokens.colors.primary }]}>EST. INCENTIVE</Text>
            <Text style={[styles.kpiValue, { color: tokens.colors.primary }]}>
              +${(data?.total_team_incentive_amount || 0).toFixed(2)}
            </Text>
          </View>
        </View>
      )}

      {/* Loading State */}
      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color={tokens.colors.primary} />
          <Text style={styles.loadingText}>Loading team settlements...</Text>
        </View>
      ) : (
        /* Sellers List */
        <View style={styles.sellerList}>
          {data?.sellers && data.sellers.length > 0 ? (
            data.sellers.map((item: TeamSellerStatusItem) => (
              <SellerStatusRow
                key={item.seller.id}
                item={item}
                onPress={() => {
                  const userAccount: UserAccount = {
                    id: item.seller.id,
                    name: item.seller.name,
                    email: item.seller.email || '',
                    role: (item.seller.role || 'SELLER') as any,
                    isActive: true,
                  }
                  onOpenSellerSettlement(userAccount, selectedDate)
                }}
              />
            ))
          ) : (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>No active staff members found for reconciliation.</Text>
            </View>
          )}
        </View>
      )}
    </View>
  )
}

interface SellerStatusRowProps {
  item: TeamSellerStatusItem
  onPress: () => void
}

const SellerStatusRow: React.FC<SellerStatusRowProps> = ({ item, onPress }) => {
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
        label: 'Pending Sign-Off',
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
    <TouchableOpacity style={styles.sellerRow} onPress={onPress} activeOpacity={0.75}>
      {/* Avatar */}
      <View style={[styles.avatarCircle, isConfirmed && styles.avatarCircleConfirmed]}>
        <Text style={[styles.avatarText, isConfirmed && styles.avatarTextConfirmed]}>
          {(item.seller.name || 'S').charAt(0).toUpperCase()}
        </Text>
      </View>

      {/* Seller Meta */}
      <View style={styles.sellerInfo}>
        <View style={styles.sellerNameRow}>
          <Text style={styles.sellerNameText} numberOfLines={1}>
            {item.seller.name}
          </Text>
          <View style={styles.roleTag}>
            <Text style={styles.roleTagText}>{item.seller.role || 'Staff'}</Text>
          </View>
        </View>

        <Text style={styles.sellerSubText}>
          {hasSales
            ? `$${item.total_sales_amount.toFixed(2)} • ${item.total_orders_count} orders (+$${item.total_incentive_amount.toFixed(2)})`
            : '0 orders today'}
        </Text>
      </View>

      {/* Status Badge & Action */}
      <View style={styles.statusActionWrap}>
        <View style={[styles.rowStatusBadge, { backgroundColor: statusBadge.bg }]}>
          <Ionicons name={statusBadge.icon} size={11} color={statusBadge.text} />
          <Text style={[styles.rowStatusBadgeText, { color: statusBadge.text }]}>
            {statusBadge.label}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={14} color={tokens.colors.secondary} />
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: tokens.colors.surfaceCard,
    borderRadius: tokens.borderRadius.card,
    marginHorizontal: tokens.spacing.md,
    marginBottom: tokens.spacing.md,
    padding: 14,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    ...tokens.shadows.card,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 8,
  },
  titleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    flexShrink: 1,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: tokens.colors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    ...tokens.typography.bodySemibold,
    fontSize: 14,
    color: tokens.colors.onBackground,
  },
  cardSubtitle: {
    ...tokens.typography.caption,
    fontSize: 11,
    color: tokens.colors.secondary,
  },
  progressBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: tokens.borderRadius.pill,
    gap: 4,
    flexShrink: 0,
  },
  progressBadgeSuccess: {
    backgroundColor: '#DCFCE7',
  },
  progressBadgePending: {
    backgroundColor: '#FEF3C7',
  },
  progressBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  dateBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: tokens.colors.surfaceMuted,
    borderRadius: tokens.borderRadius.md,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginBottom: 10,
  },
  dateNavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 4,
    gap: 2,
  },
  dateNavText: {
    fontSize: 11,
    fontWeight: '600',
    color: tokens.colors.onBackground,
  },
  dateBadgeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.surfaceCard,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: tokens.borderRadius.pill,
    gap: 4,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
  },
  dateBadgeBtnToday: {
    borderColor: tokens.colors.primaryContainer,
  },
  dateBadgeText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: tokens.colors.onBackground,
  },
  kpiStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.surfaceAlt,
    borderRadius: tokens.borderRadius.md,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
  },
  kpiItem: {
    flex: 1,
    alignItems: 'center',
  },
  kpiDivider: {
    width: 1,
    height: 24,
    backgroundColor: tokens.colors.borderSubtle,
  },
  kpiLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: tokens.colors.secondary,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  kpiValue: {
    fontSize: 13.5,
    fontWeight: '800',
    color: tokens.colors.onBackground,
    fontVariant: ['tabular-nums'],
  },
  loadingBox: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  loadingText: {
    fontSize: 12,
    color: tokens.colors.secondary,
  },
  sellerList: {
    gap: 6,
  },
  sellerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.surfaceAlt,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: tokens.borderRadius.md,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    gap: 8,
  },
  avatarCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: tokens.colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCircleConfirmed: {
    backgroundColor: '#DCFCE7',
  },
  avatarText: {
    fontSize: 12,
    fontWeight: '700',
    color: tokens.colors.secondary,
  },
  avatarTextConfirmed: {
    color: '#15803D',
  },
  sellerInfo: {
    flex: 1,
  },
  sellerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sellerNameText: {
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.onBackground,
  },
  roleTag: {
    backgroundColor: tokens.colors.surfaceMuted,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  roleTagText: {
    fontSize: 9.5,
    fontWeight: '600',
    color: tokens.colors.secondary,
  },
  sellerSubText: {
    fontSize: 11,
    color: tokens.colors.secondary,
    marginTop: 1,
  },
  statusActionWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rowStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: tokens.borderRadius.pill,
    gap: 3,
  },
  rowStatusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  emptyBox: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 12,
    color: tokens.colors.secondary,
  },
})
