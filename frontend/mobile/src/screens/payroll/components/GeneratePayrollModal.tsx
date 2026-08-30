import React from 'react'
import {
  View,
  Text,
  Modal,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../../../theme/tokens'
import type { Payroll, UserAccount } from '../../../types'
import { styles } from '../PayrollScreen.styles'
import { MONTH_NAMES } from '../payrollUtils'

export interface GeneratePayrollModalProps {
  visible: boolean
  onClose: () => void
  generateMode: 'BATCH' | 'MULTI' | 'SINGLE'
  setGenerateMode: (m: 'BATCH' | 'MULTI' | 'SINGLE') => void
  selectedMonth: number
  setSelectedMonth: (m: number) => void
  selectedYear: number
  setSelectedYear: (y: number) => void
  users: UserAccount[]
  eligibleUsers: UserAccount[]
  selectedStaffIds: Set<string>
  periodExistingUserIds: Map<string, Payroll>
  selectedUser: string
  setSelectedUser: (id: string) => void
  existingPayrollForSelection: Payroll | null
  generating: boolean
  onToggleStaffSelection: (id: string) => void
  onSelectAllEligible: () => void
  onDeselectAll: () => void
  onGenerate: () => void
}

export const GeneratePayrollModal: React.FC<GeneratePayrollModalProps> = ({
  visible,
  onClose,
  generateMode,
  setGenerateMode,
  selectedMonth,
  setSelectedMonth,
  selectedYear,
  setSelectedYear,
  users,
  eligibleUsers,
  selectedStaffIds,
  periodExistingUserIds,
  selectedUser,
  setSelectedUser,
  existingPayrollForSelection,
  generating,
  onToggleStaffSelection,
  onSelectAllEligible,
  onDeselectAll,
  onGenerate,
}) => {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { maxHeight: '88%', padding: 0 }]}>
          {/* Modal Header */}
          <View style={{ padding: 16, borderBottomWidth: 1, borderColor: tokens.colors.borderSubtle }}>
            <Text style={styles.modalTitle}>Generate Payroll</Text>
            <Text style={{ fontSize: 11, color: tokens.colors.secondary, marginTop: -8 }}>
              Generate draft payroll calculations for single staff, multi-select, or entire team in batch.
            </Text>
          </View>

          <ScrollView style={{ padding: 16 }}>
            {/* Generation Mode Selector */}
            <View style={styles.genTabContainer}>
              <TouchableOpacity
                style={[styles.genTabBtn, generateMode === 'BATCH' && styles.genTabBtnActive]}
                onPress={() => setGenerateMode('BATCH')}
              >
                <Text style={[styles.genTabText, generateMode === 'BATCH' && styles.genTabTextActive]}>
                  ⚡ Batch (All)
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.genTabBtn, generateMode === 'MULTI' && styles.genTabBtnActive]}
                onPress={() => setGenerateMode('MULTI')}
              >
                <Text style={[styles.genTabText, generateMode === 'MULTI' && styles.genTabTextActive]}>
                  ☑ Multi-Select
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.genTabBtn, generateMode === 'SINGLE' && styles.genTabBtnActive]}
                onPress={() => setGenerateMode('SINGLE')}
              >
                <Text style={[styles.genTabText, generateMode === 'SINGLE' && styles.genTabTextActive]}>
                  👤 Single Staff
                </Text>
              </TouchableOpacity>
            </View>

            {/* Period Inputs (Month & Year) */}
            <View style={styles.twoColGrid}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalLabel}>Month (1 - 12)</Text>
                <TextInput
                  style={styles.input}
                  value={String(selectedMonth)}
                  keyboardType="numeric"
                  onChangeText={(t) => setSelectedMonth(Number(t))}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalLabel}>Year</Text>
                <TextInput
                  style={styles.input}
                  value={String(selectedYear)}
                  keyboardType="numeric"
                  onChangeText={(t) => setSelectedYear(Number(t))}
                />
              </View>
            </View>

            {/* Period Quick Month Indicator */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginVertical: 8 }}>
              <Ionicons name="calendar-outline" size={13} color={tokens.colors.secondary} />
              <Text style={{ fontSize: 11.5, color: tokens.colors.secondary, fontWeight: '600' }}>
                Target Period: <Text style={{ color: tokens.colors.primaryContainer, fontWeight: '800' }}>{MONTH_NAMES[selectedMonth - 1] || `Month ${selectedMonth}`} {selectedYear}</Text>
              </Text>
            </View>

            {/* MODE 1: BATCH GENERATE (ALL STAFF) */}
            {generateMode === 'BATCH' && (
              <View style={{ marginTop: 4 }}>
                <View style={styles.batchStatsCard}>
                  <View style={styles.batchStatsRow}>
                    <View style={styles.batchStatCol}>
                      <Text style={styles.batchStatNum}>{users.length}</Text>
                      <Text style={styles.batchStatLabel}>Total Staff</Text>
                    </View>
                    <View style={styles.batchStatDivider} />
                    <View style={styles.batchStatCol}>
                      <Text style={[styles.batchStatNum, { color: tokens.colors.statusWarning }]}>
                        {periodExistingUserIds.size}
                      </Text>
                      <Text style={styles.batchStatLabel}>Already Created</Text>
                    </View>
                    <View style={styles.batchStatDivider} />
                    <View style={styles.batchStatCol}>
                      <Text style={[styles.batchStatNum, { color: tokens.colors.statusSuccess }]}>
                        {eligibleUsers.length}
                      </Text>
                      <Text style={styles.batchStatLabel}>Ready to Gen</Text>
                    </View>
                  </View>
                </View>

                <Text style={{ fontSize: 11.5, color: tokens.colors.secondary, lineHeight: 16, marginBottom: 10 }}>
                  Batch generation will automatically calculate incentives from completed sales orders, apply configured base salaries, and create draft records for all {eligibleUsers.length} pending staff members.
                </Text>
              </View>
            )}

            {/* MODE 2: MULTI-STAFF SELECTION */}
            {generateMode === 'MULTI' && (
              <View style={{ marginTop: 4 }}>
                <View style={styles.multiToolbar}>
                  <Text style={styles.multiToolbarText}>
                    Selected: <Text style={{ color: tokens.colors.primaryContainer, fontWeight: '900' }}>{selectedStaffIds.size}</Text> / {eligibleUsers.length} Eligible
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <TouchableOpacity onPress={onSelectAllEligible}>
                      <Text style={styles.quickActionText}>Select All</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={onDeselectAll}>
                      <Text style={[styles.quickActionText, { color: tokens.colors.secondary }]}>Clear</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <ScrollView style={styles.multiStaffList} nestedScrollEnabled>
                  {users.map((u) => {
                    const isAlreadyGen = periodExistingUserIds.has(u.id)
                    const existingRecord = periodExistingUserIds.get(u.id)
                    const isChecked = selectedStaffIds.has(u.id)

                    return (
                      <TouchableOpacity
                        key={u.id}
                        style={[
                          styles.multiStaffRow,
                          isChecked && styles.multiStaffRowChecked,
                          isAlreadyGen && styles.multiStaffRowDisabled,
                        ]}
                        onPress={() => onToggleStaffSelection(u.id)}
                        disabled={isAlreadyGen}
                        activeOpacity={0.7}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0 }}>
                          <View
                            style={[
                              styles.checkboxSquare,
                              isChecked && styles.checkboxSquareChecked,
                              isAlreadyGen && styles.checkboxSquareDisabled,
                            ]}
                          >
                            {Boolean(isChecked) && <Ionicons name="checkmark" size={13} color="#FFFFFF" />}
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 13, fontWeight: '700', color: tokens.colors.onSurface }} numberOfLines={1}>
                              {u.name}
                            </Text>
                            <Text style={{ fontSize: 10.5, color: tokens.colors.secondary }}>{u.role}</Text>
                          </View>
                        </View>

                        {isAlreadyGen ? (
                          <View style={[styles.liveBadge, { backgroundColor: tokens.colors.statusWarning + '20' }]}>
                            <Text style={[styles.liveBadgeText, { color: tokens.colors.statusWarning }]}>
                              {existingRecord?.status || 'Created'}
                            </Text>
                          </View>
                        ) : (
                          <Text style={{ fontSize: 11, fontWeight: '700', color: tokens.colors.secondary }}>
                            Ready
                          </Text>
                        )}
                      </TouchableOpacity>
                    )
                  })}
                </ScrollView>
              </View>
            )}

            {/* MODE 3: SINGLE STAFF SELECTION */}
            {generateMode === 'SINGLE' && (
              <View style={{ marginTop: 4 }}>
                <Text style={styles.modalLabel}>Staff Member</Text>
                <View style={styles.pickerRow}>
                  {users.length === 0 ? (
                    <Text style={{ color: tokens.colors.secondary, fontSize: 13, paddingVertical: 4 }}>
                      No staff members loaded yet.
                    </Text>
                  ) : (
                    users.map((u) => (
                      <TouchableOpacity
                        key={u.id}
                        style={[styles.chip, selectedUser === u.id && styles.chipActive]}
                        onPress={() => setSelectedUser(u.id)}
                      >
                        <Text style={[styles.chipText, selectedUser === u.id && styles.chipTextActive]}>
                          {u.name}
                        </Text>
                      </TouchableOpacity>
                    ))
                  )}
                </View>

                {existingPayrollForSelection ? (
                  <View style={styles.alreadyGeneratedWarning}>
                    <Ionicons name="information-circle" size={16} color={tokens.colors.statusWarning} />
                    <Text style={styles.alreadyGeneratedText}>
                      Payroll for this period already exists (Status: {existingPayrollForSelection.status}).
                    </Text>
                  </View>
                ) : null}
              </View>
            )}
          </ScrollView>

          {/* Modal Actions */}
          <View
            style={[
              styles.modalActions,
              { padding: 16, borderTopWidth: 1, borderColor: tokens.colors.borderSubtle, marginTop: 0 },
            ]}
          >
            <TouchableOpacity style={styles.modalBtnCancel} onPress={onClose}>
              <Text style={styles.modalBtnCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.modalBtnAction,
                ((generating) ||
                  (generateMode === 'BATCH' && eligibleUsers.length === 0) ||
                  (generateMode === 'MULTI' && selectedStaffIds.size === 0) ||
                  (generateMode === 'SINGLE' && (!selectedUser || !!existingPayrollForSelection))) &&
                  styles.modalBtnDisabled,
              ]}
              onPress={onGenerate}
              disabled={
                generating ||
                (generateMode === 'BATCH' && eligibleUsers.length === 0) ||
                (generateMode === 'MULTI' && selectedStaffIds.size === 0) ||
                (generateMode === 'SINGLE' && (!selectedUser || !!existingPayrollForSelection))
              }
            >
              {generating ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.modalBtnActionText}>
                  {generateMode === 'BATCH'
                    ? `Generate All (${eligibleUsers.length})`
                    : generateMode === 'MULTI'
                    ? `Generate Selected (${selectedStaffIds.size})`
                    : existingPayrollForSelection
                    ? 'Already Generated'
                    : 'Generate'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}
