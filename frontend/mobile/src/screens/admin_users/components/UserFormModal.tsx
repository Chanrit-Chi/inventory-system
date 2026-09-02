import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  Modal,
  ScrollView,
  TouchableOpacity,
  Switch,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../../../theme/tokens'
import type { UserAccount, UserRole } from '../../../types'
import { styles } from '../AdminUsersScreen.styles'
import { ControlledInput } from '../../../components/ControlledInput'
import type { Control, UseFormSetValue } from 'react-hook-form'
import { useWatch } from 'react-hook-form'
import type { AdminUserFormValues } from '../../../utils/validation'
import { generateSecureTemporaryPassword } from '../../../utils/password'
import { copyToClipboard } from '../../../utils/clipboard'

export interface UserFormModalProps {
  visible: boolean
  editingUser: UserAccount | null
  control: Control<AdminUserFormValues>
  setValue: UseFormSetValue<AdminUserFormValues>
  formRole: UserRole
  formIsActive: boolean
  formDailyRate: string
  formThirteenthMonthAccrual: string
  onClose: () => void
  onSubmit: () => void
}

export const UserFormModal: React.FC<UserFormModalProps> = ({
  visible,
  editingUser,
  control,
  setValue,
  formRole,
  formIsActive,
  formDailyRate,
  formThirteenthMonthAccrual,
  onClose,
  onSubmit,
}) => {
  const [showPassword, setShowPassword] = useState(true)
  const formPassword = useWatch({ control, name: 'password' }) || ''
  const formProbationExempt = useWatch({ control, name: 'probation_exempt' }) ?? false

  const handleRegeneratePassword = () => {
    const newPass = generateSecureTemporaryPassword(10)
    setValue('password', newPass, { shouldValidate: true, shouldDirty: true })
  }

  const handleCopyPassword = () => {
    if (formPassword) {
      copyToClipboard(formPassword, { label: 'Temporary Password' })
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.modalTitle}>{editingUser ? 'Edit Staff Member' : 'Add New Staff Member'}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={tokens.colors.secondary} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.formScroll}>
            {/* SECTION 1: ACCOUNT CREDENTIALS */}
            <View style={styles.formSectionHeader}>
              <Ionicons name="person-outline" size={16} color={tokens.colors.primaryContainer} />
              <Text style={styles.formSectionTitle}>1. USER IDENTITY & CREDENTIALS</Text>
            </View>

            <ControlledInput
              name="name"
              control={control}
              label="Full Name *"
              placeholder="e.g. Jane Doe"
            />

            <ControlledInput
              name="email"
              control={control}
              label="Email Address *"
              placeholder="jane@example.com"
              inputProps={{ keyboardType: 'email-address', autoCapitalize: 'none' }}
            />

            <ControlledInput
              name="phone"
              control={control}
              label="Contact Phone"
              placeholder="+855 12 345 678"
              inputProps={{ keyboardType: 'phone-pad' }}
            />

            {Boolean(!editingUser) && (
              <View style={styles.tempPasswordCard}>
                <View style={styles.tempPasswordHeader}>
                  <Text style={styles.tempPasswordLabel}>Auto-Generated Temporary Password *</Text>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <TouchableOpacity
                      style={styles.tempPasswordActionBtn}
                      onPress={handleRegeneratePassword}
                      accessibilityLabel="Generate New Password"
                    >
                      <Ionicons name="refresh-outline" size={16} color={tokens.colors.primaryContainer} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.tempPasswordActionBtn}
                      onPress={handleCopyPassword}
                      accessibilityLabel="Copy Password"
                    >
                      <Ionicons name="copy-outline" size={16} color={tokens.colors.primaryContainer} />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.tempPasswordRow}>
                  <TextInput
                    style={styles.tempPasswordInput}
                    value={formPassword}
                    onChangeText={(val) => setValue('password', val, { shouldValidate: true, shouldDirty: true })}
                    placeholder="Auto-generated password"
                    placeholderTextColor={tokens.colors.textMuted}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity
                    style={styles.tempPasswordActionBtn}
                    onPress={() => setShowPassword((v) => !v)}
                    accessibilityLabel={showPassword ? 'Hide Password' : 'Show Password'}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={16}
                      color={tokens.colors.secondary}
                    />
                  </TouchableOpacity>
                </View>

                <View style={styles.tempPasswordNotice}>
                  <Ionicons name="information-circle" size={15} color={tokens.colors.primaryContainer} />
                  <Text style={styles.tempPasswordNoticeText}>
                    A secure temporary password has been auto-generated. The user will be required to set a new password upon their first login.
                  </Text>
                </View>
              </View>
            )}

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>User Account Active</Text>
              <Switch
                value={formIsActive}
                onValueChange={(val) => setValue('isActive', val)}
                trackColor={{ false: tokens.colors.surfaceMuted, true: tokens.colors.primaryContainer }}
              />
            </View>

            <View style={[styles.switchRow, { marginTop: 8 }]}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={styles.switchLabel}>🧪 Test / Demo Account</Text>
                <Text style={{ fontSize: 11, color: tokens.colors.secondary, marginTop: 2 }}>
                  Used for role QA testing. Excluded from live payroll, shift settlements, and business metrics.
                </Text>
              </View>
              <Switch
                value={Boolean(useWatch({ control, name: 'is_test_account' }))}
                onValueChange={(val) => setValue('is_test_account', val, { shouldDirty: true })}
                trackColor={{ false: tokens.colors.surfaceMuted, true: '#F59E0B' }}
                thumbColor={useWatch({ control, name: 'is_test_account' }) ? '#B45309' : '#FFFFFF'}
              />
            </View>

            {/* SECTION 2: EMPLOYMENT & STORE ASSIGNMENT */}
            <View style={[styles.formSectionHeader, { marginTop: 14 }]}>
              <Ionicons name="business-outline" size={16} color={tokens.colors.primaryContainer} />
              <Text style={styles.formSectionTitle}>2. EMPLOYMENT & STORE ASSIGNMENT</Text>
            </View>

            <Text style={styles.formLabel}>Department / Branch Preset</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {[
                'Main Counter',
                'Sales Floor',
                'Warehouse / Stock',
                'Delivery / Dispatch',
                'Management Office',
              ].map((preset) => {
                const currentDept = useWatch({ control, name: 'department' })
                const isSelected = currentDept === preset
                return (
                  <TouchableOpacity
                    key={preset}
                    style={[
                      styles.rolePickBtn,
                      { paddingVertical: 5, paddingHorizontal: 10 },
                      isSelected && styles.rolePickBtnActive,
                    ]}
                    onPress={() => setValue('department', preset, { shouldValidate: true, shouldDirty: true })}
                  >
                    <Text
                      style={[
                        styles.rolePickText,
                        { fontSize: 11 },
                        isSelected && styles.rolePickTextActive,
                      ]}
                    >
                      {preset}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>

            <ControlledInput
              name="department"
              control={control}
              label="Or Custom Department / Branch Name"
              placeholder="e.g. Main Counter / Warehouse"
            />

            <ControlledInput
              name="hire_date"
              control={control}
              label="Hire Date (YYYY-MM-DD)"
              placeholder="2026-08-01"
            />

            {/* WAIVE PROBATION TOGGLE */}
            <View style={{ backgroundColor: '#FEF3C7', borderColor: '#FDE68A', borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#92400E' }}>
                    Waive 3-Month Probation
                  </Text>
                  <Text style={{ fontSize: 11, color: '#B45309', marginTop: 2 }}>
                    Grant immediate full benefits (sales incentives, bonuses & 13th-month accruals from Day 1).
                  </Text>
                </View>
                <Switch
                  value={formProbationExempt}
                  onValueChange={(val) => setValue('probation_exempt', val, { shouldValidate: true, shouldDirty: true })}
                  trackColor={{ false: '#D1D5DB', true: '#F59E0B' }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>

            <Text style={styles.formLabel}>Assigned Access Role *</Text>
            <View style={styles.rolePickerRow}>
              {(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'SELLER'] as const).map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[styles.rolePickBtn, formRole === r && styles.rolePickBtnActive]}
                  onPress={() => setValue('role', r as UserRole)}
                >
                  <Text style={[styles.rolePickText, formRole === r && styles.rolePickTextActive]}>
                    {r}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <ControlledInput
              name="notes"
              control={control}
              label="Internal Employment Notes / Shift Schedule"
              placeholder="e.g. Shift lead, responsible for morning cash drawer"
            />

            {/* SECTION 3: COMPENSATION & BASE SALARY */}
            <View style={[styles.formSectionHeader, { marginTop: 14 }]}>
              <Ionicons name="cash-outline" size={16} color={tokens.colors.statusSuccess} />
              <Text style={[styles.formSectionTitle, { color: tokens.colors.statusSuccess }]}>3. COMPENSATION & SALARY SETUP</Text>
            </View>

            <ControlledInput
              name="base_salary"
              control={control}
              label="Monthly Base Salary ($)"
              placeholder="e.g. 350.00"
              inputProps={{ keyboardType: 'decimal-pad' }}
            />

            <ControlledInput
              name="salary_reason"
              control={control}
              label="Salary Package / Adjustment Note"
              placeholder="e.g. Starting Base Package / Annual Review"
            />

            {/* Live Compensation Accrual Preview Card */}
            <View style={styles.formAccrualPreview}>
              <View style={styles.formAccrualHeader}>
                <Ionicons name="calculator-outline" size={14} color={tokens.colors.primaryContainer} />
                <Text style={styles.formAccrualTitle}>Live Compensation Accruals</Text>
              </View>
              <View style={styles.formAccrualRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formAccrualLabel}>CALCULATED DAILY (26d)</Text>
                  <Text style={styles.formAccrualValue}>${formDailyRate} / day</Text>
                </View>
                <View style={styles.formAccrualDivider} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.formAccrualLabel}>13TH MO. MONTHLY ACCRUAL</Text>
                  <Text style={[styles.formAccrualValue, { color: tokens.colors.statusSuccess }]}>
                    +${formThirteenthMonthAccrual} / mo
                  </Text>
                </View>
              </View>
            </View>

            <TouchableOpacity style={styles.submitBtn} onPress={onSubmit}>
              <Text style={styles.submitBtnText}>{editingUser ? 'Save All Changes' : 'Create Staff Member'}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}
