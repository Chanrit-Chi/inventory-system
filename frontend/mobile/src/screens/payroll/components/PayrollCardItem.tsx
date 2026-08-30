import React from 'react'
import {
  View,
  Text,
  TouchableOpacity,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../../../theme/tokens'
import type { Payroll } from '../../../types'
import { styles } from '../PayrollScreen.styles'
import { MONTH_NAMES, formatCurrency, getStatusColor } from '../payrollUtils'

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
  const initial = staffName.charAt(0).toUpperCase()
  const otAmount = Number(item.overtime_amount || 0)
  const deduction = Number(item.unpaid_leave_deduction || 0)
  const bulkEligible = item.status === 'FINALIZED'
  const isDraft = item.status === 'DRAFT'
  const selectDisabled = selectionMode && !bulkEligible

  const periodStr = `${MONTH_NAMES[item.period_month - 1] || item.period_month} ${item.period_year}`

  return (
    <TouchableOpacity
      style={[styles.card, isSelected && styles.cardSelected, selectDisabled && styles.cardDisabled]}
      activeOpacity={0.7}
      onPress={onPress}
      disabled={selectDisabled}
      accessibilityRole="button"
      accessibilityLabel={`Payroll for ${staffName}, ${periodStr}, net pay ${formatCurrency(item.total_net_pay)}`}
    >
      {/* Identity Row */}
      <View style={styles.cardIdentity}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <View style={styles.cardIdText}>
          <Text style={styles.userName} numberOfLines={1}>
            {staffName}
          </Text>
          <Text style={styles.periodText}>
            {periodStr} • {item.working_days ?? 26} work days
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>{item.status}</Text>
        </View>

        {/* Quick Draft Delete Action directly from card */}
        {Boolean(isDraft && !selectionMode) && (
          <TouchableOpacity
            style={styles.cardDeleteBtn}
            onPress={(e) => {
              e.stopPropagation?.()
              onDeleteDraft(item.id, staffName, periodStr)
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={`Delete draft payroll for ${staffName}`}
          >
            <Ionicons name="trash-outline" size={16} color={tokens.colors.actionDestructive} />
          </TouchableOpacity>
        )}

        {Boolean(selectionMode) && (
          <View
            style={[
              styles.selectCircle,
              isSelected && styles.selectCircleOn,
              selectDisabled && styles.selectCircleDisabled,
            ]}
          >
            {Boolean(isSelected) && <Ionicons name="checkmark" size={13} color={tokens.colors.onPrimary} />}
          </View>
        )}
      </View>

      {/* Key Figures Grid */}
      <View style={styles.figuresRow}>
        <View style={styles.figureBox}>
          <Text style={styles.figureLabel}>Base Salary</Text>
          <Text style={styles.figureValue} numberOfLines={1}>
            {formatCurrency(item.base_salary)}
          </Text>
        </View>
        <View style={styles.figureBox}>
          <Text style={styles.figureLabel}>Incentive</Text>
          <Text style={[styles.figureValue, { color: tokens.colors.statusSuccess }]} numberOfLines={1}>
            +{formatCurrency(item.incentive_amount)}
          </Text>
        </View>
        <View style={styles.figureBox}>
          <Text style={styles.figureLabel}>OT / Leave</Text>
          <Text style={styles.figureValue} numberOfLines={1}>
            +{formatCurrency(otAmount)} / -{formatCurrency(deduction)}
          </Text>
        </View>
      </View>

      {/* Net Pay Footer */}
      <View style={styles.netRow}>
        <View>
          <Text style={styles.netLabel}>Net Pay</Text>
          {item.thirteenth_month_payout !== undefined && Number(item.thirteenth_month_payout) > 0 && (
            <Text style={{ fontSize: 10, color: tokens.colors.statusSuccess, fontWeight: '700' }}>
              Incl. 13th Payout +{formatCurrency(item.thirteenth_month_payout)}
            </Text>
          )}
        </View>
        <Text style={styles.netValue}>{formatCurrency(item.total_net_pay)}</Text>
        <Ionicons name="chevron-forward" size={16} color={tokens.colors.secondary} />
      </View>
    </TouchableOpacity>
  )
})
