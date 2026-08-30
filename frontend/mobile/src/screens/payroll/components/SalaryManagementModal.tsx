import React from 'react'
import {
  View,
  Text,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../../../theme/tokens'
import type { UserAccount } from '../../../types'
import { styles } from '../PayrollScreen.styles'
import { formatCurrency } from '../payrollUtils'

export interface SalaryManagementModalProps {
  visible: boolean
  onClose: () => void
  users: UserAccount[]
  salaryLoading: boolean
  salaryDrafts: Record<string, string>
  staffReserves: Record<string, number>
  savingSalaryFor: string | null
  canManage: boolean
  onSaveSalary: (userId: string) => void
  onChangeSalaryDraft: (userId: string, value: string) => void
  onOpenStandalonePayout: (user: UserAccount) => void
}

export const SalaryManagementModal: React.FC<SalaryManagementModalProps> = ({
  visible,
  onClose,
  users,
  salaryLoading,
  salaryDrafts,
  staffReserves,
  savingSalaryFor,
  canManage,
  onSaveSalary,
  onChangeSalaryDraft,
  onOpenStandalonePayout,
}) => {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
        <View style={[styles.modalContent, { maxHeight: '85%', padding: 0 }]}>
          <View style={{ padding: 16, borderBottomWidth: 1, borderColor: tokens.colors.borderSubtle }}>
            <Text style={styles.modalTitle}>Staff Salaries & 13th Month Reserves</Text>
            <Text style={{ fontSize: 11, color: tokens.colors.secondary, marginTop: -8 }}>
              Manage base salary and monitor available 13th month / seniority reserve funds.
            </Text>
          </View>

          {salaryLoading ? (
            <View style={styles.center}>
              <ActivityIndicator size="small" color={tokens.colors.primaryContainer} />
            </View>
          ) : (
            <ScrollView style={{ padding: 16 }}>
              {users.length === 0 ? (
                <Text style={{ color: tokens.colors.secondary, fontSize: 13 }}>No staff members loaded yet.</Text>
              ) : (
                users.map((u) => {
                  const isSaving = savingSalaryFor === u.id
                  const reserveAmt = staffReserves[u.id] ?? 0
                  return (
                    <View key={u.id} style={styles.salaryCardItem}>
                      <View style={styles.salaryCardTopRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 13.5, fontWeight: '700', color: tokens.colors.onSurface }} numberOfLines={1}>
                            {u.name}
                          </Text>
                          <Text style={{ fontSize: 11, color: tokens.colors.secondary }}>{u.role}</Text>
                        </View>
                        <View style={styles.salaryInputGroup}>
                          <Text style={{ fontSize: 12, fontWeight: '600', color: tokens.colors.secondary }}>Base: $</Text>
                          <TextInput
                            style={[styles.input, styles.salaryInput]}
                            value={salaryDrafts[u.id] ?? '0'}
                            keyboardType="decimal-pad"
                            onChangeText={(t) => onChangeSalaryDraft(u.id, t)}
                            placeholder="0.00"
                          />
                          <TouchableOpacity
                            style={styles.salarySaveBtn}
                            onPress={() => onSaveSalary(u.id)}
                            disabled={isSaving}
                          >
                            {isSaving ? (
                              <ActivityIndicator size="small" color={tokens.colors.onPrimary} />
                            ) : (
                              <Ionicons name="checkmark" size={16} color={tokens.colors.onPrimary} />
                            )}
                          </TouchableOpacity>
                        </View>
                      </View>

                      {/* Live Calculated Daily Rate & 13th Month Accrual Row */}
                      {(() => {
                        const baseVal = parseFloat(salaryDrafts[u.id] ?? '0') || 0
                        const calculatedDaily = baseVal > 0 ? (baseVal / 26).toFixed(2) : '0.00'
                        const monthlyAccrual = baseVal > 0 ? (baseVal / 12).toFixed(2) : '0.00'

                        return (
                          <View style={styles.salaryMetricsRow}>
                            <View style={styles.salaryMetricCol}>
                              <Text style={styles.salaryMetricLabel}>CALCULATED DAILY (26d)</Text>
                              <Text style={styles.salaryMetricValue}>${calculatedDaily} / day</Text>
                            </View>
                            <View style={styles.salaryMetricDivider} />
                            <View style={styles.salaryMetricCol}>
                              <Text style={styles.salaryMetricLabel}>13TH MO. ACCRUAL</Text>
                              <Text style={[styles.salaryMetricValue, { color: tokens.colors.statusSuccess }]}>
                                +${monthlyAccrual} / mo
                              </Text>
                            </View>
                          </View>
                        )
                      })()}

                      {/* Reserve Pool Sub-row with Standalone Payout Action */}
                      <View style={styles.reserveSubRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Ionicons name="wallet-outline" size={13} color={tokens.colors.statusSuccess} />
                          <Text style={{ fontSize: 11, fontWeight: '700', color: tokens.colors.secondary }}>
                            Available Reserve: <Text style={{ color: tokens.colors.statusSuccess, fontWeight: '800' }}>{formatCurrency(reserveAmt)}</Text>
                          </Text>
                        </View>
                        {Boolean(canManage) && (
                          <TouchableOpacity
                            style={styles.disburseMiniBtn}
                            onPress={() => onOpenStandalonePayout(u)}
                            activeOpacity={0.8}
                          >
                            <Ionicons name="gift-outline" size={11} color={tokens.colors.primaryContainer} />
                            <Text style={styles.disburseMiniBtnText}>Disburse Payout</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  )
                })
              )}
              <View style={{ height: 20 }} />
            </ScrollView>
          )}

          <View style={[styles.modalActions, { padding: 16, borderTopWidth: 1, borderColor: tokens.colors.borderSubtle, marginTop: 0 }]}>
            <TouchableOpacity style={styles.modalBtnAction} onPress={onClose}>
              <Text style={styles.modalBtnActionText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}
