import React from 'react'
import {
  View,
  Text,
  TouchableOpacity,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../../../theme/tokens'
import type { ExpenseRecord } from '../../../types'
import { styles } from '../ExpensesScreen.styles'
import {
  formatExpenseDate,
  formatRelativeTime,
  getCategoryConfig,
  getPaymentBadge,
} from '../expenseUtils'

export interface ExpenseRowItemProps {
  exp: ExpenseRecord
  onPress: (exp: ExpenseRecord) => void
}

export const ExpenseRowItem: React.FC<ExpenseRowItemProps> = React.memo(({ exp, onPress }) => {
  const catConfig = getCategoryConfig(exp.category)
  const payBadge = getPaymentBadge(exp.paymentMethod)

  return (
    <TouchableOpacity
      style={styles.expenseCard}
      onPress={() => onPress(exp)}
      activeOpacity={0.78}
      accessibilityRole="button"
      accessibilityLabel={`Expense ${exp.title}, amount $${exp.amount.toFixed(2)}`}
    >
      {/* Card Header: Category & Date */}
      <View style={styles.cardHeaderRow}>
        <View style={styles.catPill}>
          <View style={[styles.catIconWrap, { backgroundColor: catConfig.bg }]}>
            <Ionicons name={catConfig.icon} size={12} color={catConfig.color} />
          </View>
          <Text style={styles.catPillText}>{exp.category}</Text>
        </View>

        <View style={styles.headerRightInfo}>
          <Text style={styles.relativeTimeText}>{formatRelativeTime(exp.expenseDate)}</Text>
          <View style={[styles.payMethodBadge, { backgroundColor: payBadge.bg }]}>
            <Ionicons name={payBadge.name} size={10} color={payBadge.color} />
            <Text style={[styles.payMethodText, { color: payBadge.color }]}>{payBadge.label}</Text>
          </View>
        </View>
      </View>

      {/* Card Body: Title & Amount */}
      <View style={styles.cardBodyRow}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={styles.expTitle} numberOfLines={2}>
            {exp.title}
          </Text>
          {Boolean(exp.notes) && (
            <Text style={styles.expNotes} numberOfLines={1}>
              {exp.notes}
            </Text>
          )}
        </View>
        <Text style={styles.expAmount}>-${exp.amount.toFixed(2)}</Text>
      </View>

      {/* Card Footer: Staff & Timestamp */}
      <View style={styles.cardDivider} />
      <View style={styles.cardFooterRow}>
        <View style={styles.staffWrap}>
          <Ionicons name="person-outline" size={11} color={tokens.colors.secondary} />
          <Text style={styles.staffText}>{exp.recordedBy || 'Admin'}</Text>
        </View>
        <View style={styles.dateWrap}>
          <Ionicons name="calendar-outline" size={11} color={tokens.colors.secondary} />
          <Text style={styles.dateText}>{formatExpenseDate(exp.expenseDate)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  )
})
