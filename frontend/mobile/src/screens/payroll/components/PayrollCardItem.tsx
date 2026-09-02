import React from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../../../theme/tokens'
import type { Payroll } from '../../../types'
import { MONTH_NAMES, formatCurrency, getStatusColor, getPeriodDateRange } from '../payrollUtils'

export interface PayrollCardItemProps {
  item: Payroll
  staffName: string
  isSelected: boolean
  selectionMode: boolean
  onPress: () => void
  onDeleteDraft: (id: string, staffName: string, periodStr: string) => void
}

export const PayrollCardItem: React.FC<PayrollCardItemProps> = React.memo(({
  item,
  staffName,
  isSelected,
  selectionMode,
  onPress,
  onDeleteDraft,
}) => {
  const initial = (staffName || 'S').charAt(0).toUpperCase()
  const otAmount = Number(item.overtime_amount ?? (item as any).overtime_pay ?? 0)
  const deduction = Number(item.unpaid_leave_deduction || 0)
  const baseSalary = Number(item.base_salary || 0)
  const thirteenthAccrual = Number(
    item.thirteenth_month_contribution ??
    (item as any).thirteenth_month_accrual ??
    (baseSalary > 0 ? Math.round((baseSalary / 12) * 100) / 100 : 0)
  )
  const incentiveAmount = Number(
    item.incentive_override !== null &&
      item.incentive_override !== undefined &&
      item.incentive_override !== ''
      ? item.incentive_override
      : item.incentive_amount ?? (item as any).sales_commission ?? 0
  )
  const bulkEligible = item.status === 'FINALIZED'
  const isDraft = item.status === 'DRAFT'
  const isPaid = item.status === 'PAID'
  const selectDisabled = selectionMode && !bulkEligible

  const monthName = MONTH_NAMES[item.period_month - 1] || `Month ${item.period_month}`
  const periodRange = getPeriodDateRange(item.period_year, item.period_month)
  const periodStr = `${periodRange.start} → ${periodRange.end}`

  return (
    <TouchableOpacity
      style={[
        cardStyles.card,
        isSelected && cardStyles.cardSelected,
        selectDisabled && cardStyles.cardDisabled,
      ]}
      activeOpacity={0.75}
      onPress={onPress}
      disabled={selectDisabled}
      accessibilityRole="button"
      accessibilityLabel={`Payroll for ${staffName}, ${monthName} ${item.period_year}, net pay ${formatCurrency(item.total_net_pay)}`}
    >
      {/* ── Top Header Row ────────────────────────────────────────────── */}
      <View style={cardStyles.headerRow}>
        {/* Avatar */}
        <View style={cardStyles.avatarCircle}>
          <Text style={cardStyles.avatarText}>{initial}</Text>
        </View>

        {/* Staff Name & Metadata */}
        <View style={cardStyles.identityCol}>
          <Text style={cardStyles.userName} numberOfLines={1}>
            {staffName}
          </Text>
          <View style={cardStyles.metaRow}>
            <View style={cardStyles.deptBadge}>
              <Ionicons name="business-outline" size={9.5} color={tokens.colors.secondary} />
              <Text style={cardStyles.deptBadgeText} numberOfLines={1}>
                {item.user?.department || 'General'}
              </Text>
            </View>
            {item.user?.role && (
              <View style={cardStyles.roleBadge}>
                <Text style={cardStyles.roleBadgeText} numberOfLines={1}>
                  {item.user.role}
                </Text>
              </View>
            )}
            {Boolean(item.user?.is_on_probation) && (
              <View style={cardStyles.probationBadge}>
                <Ionicons name="shield-outline" size={9} color="#B45309" />
                <Text style={cardStyles.probationBadgeText}>Probation</Text>
              </View>
            )}
            <View style={cardStyles.periodBadge}>
              <Ionicons name="calendar-outline" size={9.5} color={tokens.colors.secondary} />
              <Text style={cardStyles.periodText}>
                {monthName} {item.period_year}
              </Text>
            </View>
          </View>
        </View>

        {/* Status Badge */}
        <View
          style={[
            cardStyles.statusBadge,
            {
              backgroundColor: isPaid ? '#DCFCE7' : item.status === 'FINALIZED' ? '#FEF3C7' : '#F1F5F9',
              borderColor: isPaid ? '#86EFAC' : item.status === 'FINALIZED' ? '#FCD34D' : '#CBD5E1',
            },
          ]}
        >
          {isPaid && <Ionicons name="checkmark-circle" size={10} color="#15803D" style={{ marginRight: 2 }} />}
          <Text
            style={[
              cardStyles.statusText,
              { color: isPaid ? '#15803D' : item.status === 'FINALIZED' ? '#B45309' : '#64748B' },
            ]}
          >
            {item.status}
          </Text>
        </View>

        {/* Quick Draft Delete Action */}
        {Boolean(isDraft && !selectionMode) && (
          <TouchableOpacity
            style={cardStyles.deleteBtn}
            onPress={(e) => {
              e.stopPropagation?.()
              onDeleteDraft(item.id, staffName, periodStr)
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={`Delete draft payroll for ${staffName}`}
          >
            <Ionicons name="trash-outline" size={14} color={tokens.colors.actionDestructive} />
          </TouchableOpacity>
        )}

        {/* Selection Checkbox */}
        {Boolean(selectionMode) && (
          <View
            style={[
              cardStyles.selectCircle,
              isSelected && cardStyles.selectCircleOn,
              selectDisabled && cardStyles.selectCircleDisabled,
            ]}
          >
            {Boolean(isSelected) && <Ionicons name="checkmark" size={12} color={tokens.colors.onPrimary} />}
          </View>
        )}
      </View>

      {/* ── Key Figures Grid ─────────────────────────────────────────── */}
      <View style={cardStyles.figuresGrid}>
        <View style={cardStyles.figureItem}>
          <Text style={cardStyles.figureLabel} numberOfLines={1}>Base Salary</Text>
          <Text style={cardStyles.figureValue} numberOfLines={1}>
            {formatCurrency(item.base_salary)}
          </Text>
        </View>

        <View style={cardStyles.gridDivider} />

        <View style={cardStyles.figureItem}>
          <Text style={cardStyles.figureLabel} numberOfLines={1}>Incentive</Text>
          <Text
            style={[cardStyles.figureValue, { color: tokens.colors.statusSuccess }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
          >
            +{formatCurrency(incentiveAmount)}
          </Text>
        </View>

        <View style={cardStyles.gridDivider} />

        <View style={cardStyles.figureItem}>
          <Text style={cardStyles.figureLabel} numberOfLines={1}>13th Accrual</Text>
          <Text
            style={[cardStyles.figureValue, { color: '#7C3AED' }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
          >
            +{formatCurrency(thirteenthAccrual)}
          </Text>
        </View>

        {(otAmount > 0 || deduction > 0) && (
          <>
            <View style={cardStyles.gridDivider} />
            <View style={cardStyles.figureItem}>
              <Text style={cardStyles.figureLabel} numberOfLines={1}>OT / Leave</Text>
              <Text
                style={[cardStyles.figureValue, { color: otAmount > 0 ? tokens.colors.statusSuccess : '#D97706' }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                {otAmount > 0 ? `+${formatCurrency(otAmount)}` : `-${formatCurrency(deduction)}`}
              </Text>
            </View>
          </>
        )}
      </View>

      {/* ── Net Pay Footer Bar ───────────────────────────────────────── */}
      <View style={cardStyles.netRow}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={cardStyles.netLabel}>NET PAY:</Text>
            <Text style={cardStyles.netValue} numberOfLines={1}>
              {formatCurrency(item.total_net_pay || (item as any).total_net)}
            </Text>
          </View>
          {item.thirteenth_month_payout !== undefined && Number(item.thirteenth_month_payout) > 0 && (
            <Text style={cardStyles.bonusNote}>
              ★ Includes 13th Month Payout: +{formatCurrency(item.thirteenth_month_payout)}
            </Text>
          )}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          {isPaid && (
            <View style={cardStyles.paidMethodBadge}>
              <Ionicons name="card-outline" size={10} color="#15803D" />
              <Text style={cardStyles.paidMethodText}>{(item as any).payment_method || 'Paid'}</Text>
            </View>
          )}
          <Ionicons name="chevron-forward" size={14} color={tokens.colors.secondary} />
        </View>
      </View>
    </TouchableOpacity>
  )
})

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: tokens.colors.surfaceCard,
    borderRadius: tokens.borderRadius.card,
    padding: 13,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    marginBottom: 12,
    ...tokens.shadows.card,
  },
  cardSelected: {
    borderColor: tokens.colors.primaryContainer,
    backgroundColor: tokens.colors.actionPrimaryBg,
  },
  cardDisabled: {
    opacity: 0.5,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: tokens.colors.actionPrimaryBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: tokens.colors.primaryFixedDim,
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '800',
    color: tokens.colors.primaryContainer,
  },
  identityCol: {
    flex: 1,
    marginLeft: 10,
    marginRight: 6,
  },
  userName: {
    fontSize: 13.5,
    fontWeight: '800',
    color: tokens.colors.onSurface,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  deptBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    maxWidth: 95,
  },
  deptBadgeText: {
    fontSize: 9.5,
    fontWeight: '600',
    color: tokens.colors.secondary,
  },
  roleBadge: {
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  roleBadgeText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#5B21B6',
  },
  probationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: '#FCD34D',
  },
  probationBadgeText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#B45309',
  },
  periodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: '#E2E8F0',
  },
  periodText: {
    fontSize: 9.5,
    fontWeight: '600',
    color: tokens.colors.secondary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: tokens.borderRadius.pill,
    borderWidth: 0.5,
  },
  statusText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  deleteBtn: {
    padding: 6,
    marginLeft: 4,
  },
  selectCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: tokens.colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  selectCircleOn: {
    backgroundColor: tokens.colors.primaryContainer,
    borderColor: tokens.colors.primaryContainer,
  },
  selectCircleDisabled: {
    borderColor: tokens.colors.borderSubtle,
    backgroundColor: tokens.colors.surfaceMuted,
  },
  figuresGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 4,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  figureItem: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  figureLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: tokens.colors.secondary,
    marginBottom: 1,
  },
  figureValue: {
    fontSize: 11.5,
    fontWeight: '700',
    color: tokens.colors.onSurface,
  },
  gridDivider: {
    width: 1,
    height: 16,
    backgroundColor: '#CBD5E1',
  },
  netRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  netLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: tokens.colors.secondary,
    letterSpacing: 0.4,
  },
  netValue: {
    fontSize: 14.5,
    fontWeight: '900',
    color: tokens.colors.primaryContainer,
  },
  bonusNote: {
    fontSize: 9.5,
    fontWeight: '700',
    color: tokens.colors.statusSuccess,
    marginTop: 2,
  },
  paidMethodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  paidMethodText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#15803D',
  },
})
