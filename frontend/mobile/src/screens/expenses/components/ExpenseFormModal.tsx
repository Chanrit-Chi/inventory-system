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
import { styles } from '../ExpensesScreen.styles'
import { ControlledInput } from '../../../components/ControlledInput'
import { CATEGORIES, getCategoryConfig, getPaymentBadge } from '../expenseUtils'
import type { Control, UseFormSetValue } from 'react-hook-form'
import type { ExpenseFormValues } from '../../../utils/validation'

export interface ExpenseFormModalProps {
  visible: boolean
  control: Control<ExpenseFormValues>
  setValue: UseFormSetValue<ExpenseFormValues>
  formCategory: string
  formMethod: string
  submitting: boolean
  onClose: () => void
  onSubmit: () => void
}

export const ExpenseFormModal: React.FC<ExpenseFormModalProps> = ({
  visible,
  control,
  setValue,
  formCategory,
  formMethod,
  submitting,
  onClose,
  onSubmit,
}) => {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.detailSheet}>
          <View style={styles.sheetHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={[styles.catIconWrap, { backgroundColor: '#E0F2FE' }]}>
                <Ionicons name="receipt" size={16} color={tokens.colors.primaryContainer} />
              </View>
              <Text style={styles.detailTitle}>Record New Expense</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={24} color={tokens.colors.secondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.detailBody} showsVerticalScrollIndicator={false}>
            <ControlledInput
              name="title"
              control={control}
              label="Expense Title / Description *"
              placeholder="e.g. Storefront electricity & water bill"
            />

            <Text style={styles.formLabel}>Category *</Text>
            <View style={styles.categoryGrid}>
              {CATEGORIES.map((c) => {
                const cfg = getCategoryConfig(c)
                const isActive = formCategory === c
                return (
                  <TouchableOpacity
                    key={c}
                    style={[styles.catBtn, isActive && styles.catBtnActive]}
                    onPress={() => setValue('category', c as ExpenseFormValues['category'])}
                  >
                    <Ionicons name={cfg.icon} size={12} color={isActive ? tokens.colors.onPrimary : cfg.color} />
                    <Text style={[styles.catBtnText, isActive && styles.catBtnTextActive]}>{c}</Text>
                  </TouchableOpacity>
                )
              })}
            </View>

            <ControlledInput
              name="amount"
              control={control}
              label="Amount ($) *"
              placeholder="0.00"
              inputProps={{ keyboardType: 'numeric' }}
            />

            <Text style={styles.formLabel}>Payment Method *</Text>
            <View style={styles.methodRow}>
              {(['Cash', 'ABA QR', 'Card', 'Bank Transfer'] as const).map((m) => {
                const badge = getPaymentBadge(m)
                const isActive = formMethod === m
                return (
                  <TouchableOpacity
                    key={m}
                    style={[styles.methodBtn, isActive && styles.methodBtnActive]}
                    onPress={() => setValue('paymentMethod', m as ExpenseFormValues['paymentMethod'])}
                  >
                    <Ionicons name={badge.name} size={14} color={isActive ? tokens.colors.onPrimary : badge.color} />
                    <Text style={[styles.methodBtnText, isActive && styles.methodBtnTextActive]}>{m}</Text>
                  </TouchableOpacity>
                )
              })}
            </View>

            <ControlledInput
              name="notes"
              control={control}
              label="Notes / Vendor Reference"
              placeholder="Invoice reference, vendor details, or memo..."
              inputProps={{ multiline: true, style: { height: 65 } }}
            />

            <TouchableOpacity
              style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
              onPress={onSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color={tokens.colors.onPrimary} />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={18} color={tokens.colors.onPrimary} />
                  <Text style={styles.submitBtnText}>Save & Log Expense</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}
