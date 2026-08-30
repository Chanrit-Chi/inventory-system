import React from 'react'
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../../../theme/tokens'
import type { ExpenseRecord } from '../../../types'
import { styles } from '../ExpensesScreen.styles'
import { formatExpenseDate } from '../expenseUtils'

export interface ExpenseDetailModalProps {
  visible: boolean
  expense: ExpenseRecord | null
  canManage: boolean
  deletingId: string | null
  onClose: () => void
  onDelete: (id: string, title: string) => void
}

export const ExpenseDetailModal: React.FC<ExpenseDetailModalProps> = ({
  visible,
  expense,
  canManage,
  deletingId,
  onClose,
  onDelete,
}) => {
  return (
    <Modal
      visible={visible && !!expense}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.detailSheet}>
          <View style={styles.sheetHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={[styles.catIconWrap, { backgroundColor: '#FEE2E2' }]}>
                <Ionicons name="cash" size={16} color={tokens.colors.statusError} />
              </View>
              <Text style={styles.detailTitle}>Expense Details</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={24} color={tokens.colors.secondary} />
            </TouchableOpacity>
          </View>

          {expense ? (
            <ScrollView style={styles.detailBody} showsVerticalScrollIndicator={false}>
              {/* Amount Callout */}
              <View style={styles.detailAmountCard}>
                <Text style={styles.detailAmountSub}>TOTAL EXPENDITURE</Text>
                <Text style={styles.detailAmountVal}>${expense.amount.toFixed(2)}</Text>
                <View style={styles.detailAmountBadge}>
                  <Text style={styles.detailAmountBadgeText}>{expense.category}</Text>
                </View>
              </View>

              {/* Information Rows */}
              <View style={styles.detailInfoBox}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailRowLabel}>Title</Text>
                  <Text style={styles.detailRowVal}>{expense.title}</Text>
                </View>
                <View style={styles.detailDivider} />

                <View style={styles.detailRow}>
                  <Text style={styles.detailRowLabel}>Category</Text>
                  <Text style={styles.detailRowVal}>{expense.category}</Text>
                </View>
                <View style={styles.detailDivider} />

                <View style={styles.detailRow}>
                  <Text style={styles.detailRowLabel}>Payment Method</Text>
                  <Text style={styles.detailRowVal}>{expense.paymentMethod}</Text>
                </View>
                <View style={styles.detailDivider} />

                <View style={styles.detailRow}>
                  <Text style={styles.detailRowLabel}>Expense Date</Text>
                  <Text style={styles.detailRowVal}>{formatExpenseDate(expense.expenseDate)}</Text>
                </View>
                <View style={styles.detailDivider} />

                <View style={styles.detailRow}>
                  <Text style={styles.detailRowLabel}>Recorded By</Text>
                  <Text style={styles.detailRowVal}>{expense.recordedBy || 'Staff'}</Text>
                </View>

                {expense.notes ? (
                  <>
                    <View style={styles.detailDivider} />
                    <View style={[styles.detailRow, { flexDirection: 'column', alignItems: 'flex-start', gap: 4 }]}>
                      <Text style={styles.detailRowLabel}>Notes / Reference</Text>
                      <Text style={styles.detailNotesText}>{expense.notes}</Text>
                    </View>
                  </>
                ) : null}
              </View>

              {/* Actions */}
              {Boolean(canManage) && (
                <TouchableOpacity
                  style={styles.deleteExpenseBtn}
                  onPress={() => onDelete(expense.id, expense.title)}
                  disabled={deletingId === expense.id}
                >
                  {deletingId === expense.id ? (
                    <ActivityIndicator size="small" color={tokens.colors.statusError} />
                  ) : (
                    <>
                      <Ionicons name="trash-outline" size={16} color={tokens.colors.statusError} />
                      <Text style={styles.deleteExpenseBtnText}>Delete This Expense Record</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </ScrollView>
          ) : null}
        </View>
      </View>
    </Modal>
  )
}
