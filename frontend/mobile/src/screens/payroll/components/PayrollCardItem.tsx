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
import { MONTH_NAMES, formatCurrency, getPeriodDateRange } from '../payrollUtils'

export interface PayrollCardItemProps {
  item: Payroll
  staffName: string
  isSelected: boolean
  selectionMode: boolean
  onPress: () => void
  onDeleteDraft: (id: string, staffName: string, periodStr: string) => void
  onQuickFinalize?: (item: Payroll) => void
  onQuickPay?: (item: Payroll) => void
}

export const PayrollCardItem: React.FC<PayrollCardItemProps> = React.memo(({
  item,
  staffName,
  isSelected,
  selectionMode,
  onPress,
  onDeleteDraft,
  onQuickFinalize,
  onQuickPay,
}) => {
  const initial = (staffName || 'S').charAt(0).toUpperCase()
  const baseSalary = Number(item.base_salary || 0)
  const incentiveAmount = Number(
    item.incentive_override !== null &&
      item.incentive_override !== undefined &&
      item.incentive_override !== ''
      ? item.incentive_override
      : item.incentive_amount ?? (item as any).sales_commission ?? 0
  )
  const bulkEligible = item.status === 'FINALIZED'
  const isDraft = item.status === 'DRAFT'
  const isFinalized = item.status === 'FINALIZED'
  const isPaid = item.status === 'PAID'
  const selectDisabled = selectionMode && !bulkEligible

  const monthName = MONTH_NAMES[item.period_month - 1] || `M${item.period_month}`
  const periodRange = getPeriodDateRange(item.period_year, item.period_month)
  const periodStr = `${periodRange.start} → ${periodRange.end}`

  // Quick summary string
  const summaryParts: string[] = []
  if (baseSalary > 0) summaryParts.push(`Base ${formatCurrency(baseSalary)}`)
  if (incentiveAmount > 0) summaryParts.push(`Inc +${formatCurrency(incentiveAmount)}`)
  const summaryText = summaryParts.length > 0 ? summaryParts.join(' · ') : `Period: ${monthName}`

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
      <View style={cardStyles.mainRow}>
        {/* Left: Avatar + Identity + Summary */}
        <View style={cardStyles.leftCol}>
          <View style={cardStyles.identityRow}>
            <View style={cardStyles.avatarCircle}>
              <Text style={cardStyles.avatarText}>{initial}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={cardStyles.userName} numberOfLines={1}>
                  {staffName}
                </Text>
                <View
                  style={[
                    cardStyles.statusBadge,
                    {
                      backgroundColor: isPaid ? '#DCFCE7' : isFinalized ? '#FEF3C7' : '#F1F5F9',
                      borderColor: isPaid ? '#86EFAC' : isFinalized ? '#FCD34D' : '#CBD5E1',
                    },
                  ]}
                >
                  <Text
                    style={[
                      cardStyles.statusText,
                      { color: isPaid ? '#15803D' : isFinalized ? '#B45309' : '#64748B' },
                    ]}
                  >
                    {item.status}
                  </Text>
                </View>
              </View>
              <Text style={cardStyles.metaSubtitle} numberOfLines={1}>
                {item.user?.department || 'Staff'} · {summaryText}
              </Text>
            </View>
          </View>
        </View>

        {/* Right: Net Pay + Direct 1-Tap Action */}
        <View style={cardStyles.rightCol}>
          <Text style={cardStyles.netPayAmount} numberOfLines={1}>
            {formatCurrency(item.total_net_pay || (item as any).total_net)}
          </Text>

          {/* Action Zone */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
            {selectionMode ? (
              <View
                style={[
                  cardStyles.selectCircle,
                  isSelected && cardStyles.selectCircleOn,
                  selectDisabled && cardStyles.selectCircleDisabled,
                ]}
              >
                {Boolean(isSelected) && <Ionicons name="checkmark" size={12} color={tokens.colors.onPrimary} />}
              </View>
            ) : isDraft ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <TouchableOpacity
                  style={cardStyles.actionBtnFinalize}
                  onPress={(e) => {
                    e.stopPropagation?.()
                    onQuickFinalize?.(item)
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="checkmark-done" size={12} color="#FFFFFF" />
                  <Text style={cardStyles.actionBtnFinalizeText}>Finalize</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={cardStyles.deleteBtn}
                  onPress={(e) => {
                    e.stopPropagation?.()
                    onDeleteDraft(item.id, staffName, periodStr)
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                >
                  <Ionicons name="trash-outline" size={14} color={tokens.colors.actionDestructive} />
                </TouchableOpacity>
              </View>
            ) : isFinalized ? (
              <TouchableOpacity
                style={cardStyles.actionBtnPay}
                onPress={(e) => {
                  e.stopPropagation?.()
                  onQuickPay?.(item)
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="card-outline" size={12} color="#FFFFFF" />
                <Text style={cardStyles.actionBtnPayText}>Pay</Text>
              </TouchableOpacity>
            ) : (
              <View style={cardStyles.paidIndicator}>
                <Ionicons name="checkmark-circle" size={13} color="#15803D" />
                <Text style={cardStyles.paidIndicatorText}>Paid</Text>
              </View>
            )}

            <Ionicons name="chevron-forward" size={14} color={tokens.colors.textMuted} style={{ marginLeft: 2 }} />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  )
})

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: tokens.colors.surfaceCard,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    marginBottom: 8,
    ...tokens.shadows.card,
  },
  cardSelected: {
    borderColor: tokens.colors.primaryContainer,
    backgroundColor: '#F0F9FF',
  },
  cardDisabled: {
    opacity: 0.5,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftCol: {
    flex: 1,
    paddingRight: 10,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: tokens.colors.actionPrimaryBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '800',
    color: tokens.colors.primaryContainer,
  },
  userName: {
    fontSize: 13.5,
    fontWeight: '700',
    color: tokens.colors.onBackground,
    maxWidth: 130,
  },
  metaSubtitle: {
    fontSize: 11,
    color: tokens.colors.secondary,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  rightCol: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  netPayAmount: {
    fontSize: 15,
    fontWeight: '800',
    color: tokens.colors.primaryContainer,
    letterSpacing: -0.3,
  },
  actionBtnFinalize: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0284C7',
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderRadius: 6,
    gap: 3,
  },
  actionBtnFinalizeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  actionBtnPay: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16A34A',
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 6,
    gap: 3,
  },
  actionBtnPayText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  paidIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  paidIndicatorText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
  },
  deleteBtn: {
    padding: 3,
  },
  selectCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: tokens.colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  selectCircleOn: {
    backgroundColor: tokens.colors.primaryContainer,
    borderColor: tokens.colors.primaryContainer,
  },
  selectCircleDisabled: {
    opacity: 0.3,
  },
})
