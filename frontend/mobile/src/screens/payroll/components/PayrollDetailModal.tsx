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
  Switch,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../../../theme/tokens'
import type { Payroll, UserAccount, ThirteenthMonthSummary } from '../../../types'
import { styles } from '../PayrollScreen.styles'
import {
  MONTH_NAMES,
  formatCurrency,
  getStatusColor,
  getStaffName,
  calculatePayrollSummary,
} from '../payrollUtils'

export interface PayrollDetailModalProps {
  visible: boolean
  editingPayroll: Payroll | null
  users: UserAccount[]
  workingDays: string
  setWorkingDays: (v: string) => void
  perfBenefit: string
  setPerfBenefit: (v: string) => void
  delivBenefit: string
  setDelivBenefit: (v: string) => void
  otDays: string
  setOtDays: (v: string) => void
  unpaidDays: string
  setUnpaidDays: (v: string) => void
  collecBenefit: string
  setCollecBenefit: (v: string) => void
  otherBenefit: string
  setOtherBenefit: (v: string) => void
  payrollStatus: 'DRAFT' | 'FINALIZED' | 'PAID'
  incentiveMode: 'AUTO' | 'MANUAL'
  setIncentiveMode: (m: 'AUTO' | 'MANUAL') => void
  manualIncentive: string
  setManualIncentive: (v: string) => void
  includeThirteenthPayout: boolean
  setIncludeThirteenthPayout: (v: boolean) => void
  thirteenthPayoutAmount: string
  setThirteenthPayoutAmount: (v: string) => void
  reserveSummary: ThirteenthMonthSummary | null
  savingDetail: boolean
  onClose: () => void
  onSaveDetail: (mode: 'draft' | 'finalize') => void
  onTransition: (status: 'DRAFT' | 'PAID') => void
  onDeleteDraft: () => void
}

export const PayrollDetailModal: React.FC<PayrollDetailModalProps> = ({
  visible,
  editingPayroll,
  users,
  workingDays,
  setWorkingDays,
  perfBenefit,
  setPerfBenefit,
  delivBenefit,
  setDelivBenefit,
  otDays,
  setOtDays,
  unpaidDays,
  setUnpaidDays,
  collecBenefit,
  setCollecBenefit,
  otherBenefit,
  setOtherBenefit,
  payrollStatus,
  incentiveMode,
  setIncentiveMode,
  manualIncentive,
  setManualIncentive,
  includeThirteenthPayout,
  setIncludeThirteenthPayout,
  thirteenthPayoutAmount,
  setThirteenthPayoutAmount,
  reserveSummary,
  savingDetail,
  onClose,
  onSaveDetail,
  onTransition,
  onDeleteDraft,
}) => {
  const staffName = editingPayroll ? getStaffName(editingPayroll, users) : 'Staff Payroll'
  const isEditable = payrollStatus === 'DRAFT'

  const summary = calculatePayrollSummary({
    editingPayroll,
    incentiveMode,
    manualIncentive,
    workingDays,
    otDays,
    unpaidDays,
    perfBenefit,
    delivBenefit,
    collecBenefit,
    otherBenefit,
    includeThirteenthPayout,
    thirteenthPayoutAmount,
    reserveSummary,
  })

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
        <View style={[styles.modalContent, { maxHeight: '92%', padding: 0 }]}>
          {/* Modal Header */}
          <View style={styles.detailHeader}>
            <View style={styles.headerStaffIdentity}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarText}>
                  {staffName.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.modalStaffName} numberOfLines={1}>
                  {staffName}
                </Text>
                <View style={styles.headerSubRow}>
                  <Text style={styles.modalPeriodPill}>
                    {editingPayroll
                      ? `${MONTH_NAMES[editingPayroll.period_month - 1] || editingPayroll.period_month} ${editingPayroll.period_year}`
                      : ''}
                  </Text>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: getStatusColor(payrollStatus) + '20' },
                    ]}
                  >
                    <Text style={[styles.statusText, { color: getStatusColor(payrollStatus) }]}>
                      {payrollStatus}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={styles.modalCloseIconBtn}
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={22} color={tokens.colors.secondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ padding: 16 }} showsVerticalScrollIndicator={false}>
            {/* Status Banner */}
            <View style={[styles.statusBanner, { backgroundColor: getStatusColor(payrollStatus) + '18' }]}>
              <Ionicons
                name={
                  payrollStatus === 'PAID'
                    ? 'checkmark-done-circle'
                    : payrollStatus === 'FINALIZED'
                    ? 'lock-closed'
                    : 'create-outline'
                }
                size={16}
                color={getStatusColor(payrollStatus)}
              />
              <Text style={[styles.statusBannerText, { color: getStatusColor(payrollStatus) }]}>
                {payrollStatus === 'DRAFT'
                  ? 'Draft Mode: All fields are editable. Review live calculation below.'
                  : payrollStatus === 'FINALIZED'
                  ? 'Finalized: Calculations are locked. Reopen as draft to modify.'
                  : 'Paid: Record has been settled and locked.'}
              </Text>
            </View>

            {/* CARD 1: Basic Earnings & Working Days */}
            <View style={styles.formSectionCard}>
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="calendar-outline" size={16} color={tokens.colors.primaryContainer} />
                <Text style={styles.sectionTitle}>Working Days & Daily Rate</Text>
              </View>

              <View style={styles.infoRowGrid}>
                <View style={styles.infoColBox}>
                  <Text style={styles.infoColLabel}>BASE SALARY</Text>
                  <Text style={styles.infoColValue}>{formatCurrency(summary.base)}</Text>
                </View>
                <View style={styles.infoColBox}>
                  <Text style={styles.infoColLabel}>CALCULATED DAILY RATE</Text>
                  <Text style={[styles.infoColValue, { color: tokens.colors.primaryContainer }]}>
                    {formatCurrency(summary.dailyRate)} / day
                  </Text>
                </View>
              </View>

              <Text style={styles.modalLabel}>Standard Working Days in Month</Text>
              <TextInput
                style={[styles.input, !isEditable && styles.inputDisabled]}
                value={workingDays}
                keyboardType="numeric"
                onChangeText={setWorkingDays}
                editable={isEditable}
                placeholder="26"
              />
            </View>

            {/* CARD 2: Overtime & Unpaid Leave */}
            <View style={styles.formSectionCard}>
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="time-outline" size={16} color={tokens.colors.primaryContainer} />
                <Text style={styles.sectionTitle}>Attendance, OT & Leave</Text>
              </View>

              <View style={styles.twoColGrid}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalLabel}>Overtime (Days)</Text>
                  <TextInput
                    style={[styles.input, !isEditable && styles.inputDisabled]}
                    value={otDays}
                    keyboardType="decimal-pad"
                    onChangeText={setOtDays}
                    editable={isEditable}
                    placeholder="0"
                  />
                  <Text style={styles.inputSubHint}>
                    +{formatCurrency(summary.otAmount)} ({otDays || 0} days @ {formatCurrency(summary.dailyRate)})
                  </Text>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.modalLabel}>Unpaid Leave (Days)</Text>
                  <TextInput
                    style={[styles.input, !isEditable && styles.inputDisabled]}
                    value={unpaidDays}
                    keyboardType="decimal-pad"
                    onChangeText={setUnpaidDays}
                    editable={isEditable}
                    placeholder="0"
                  />
                  <Text style={[styles.inputSubHint, { color: tokens.colors.statusError }]}>
                    -{formatCurrency(summary.unpaidDeduction)} ({unpaidDays || 0} days @ {formatCurrency(summary.dailyRate)})
                  </Text>
                </View>
              </View>
            </View>

            {/* CARD 3: Sales Order Incentive Mode */}
            <View style={styles.formSectionCard}>
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="trending-up-outline" size={16} color={tokens.colors.primaryContainer} />
                <Text style={styles.sectionTitle}>Sales Commission / Order Incentive</Text>
              </View>

              <View style={styles.pickerRow}>
                {(['AUTO', 'MANUAL'] as const).map((m) => (
                  <TouchableOpacity
                    key={m}
                    style={[styles.chip, incentiveMode === m && styles.chipActive]}
                    onPress={() => setIncentiveMode(m)}
                    disabled={!isEditable}
                  >
                    <Ionicons
                      name={m === 'AUTO' ? 'flash-outline' : 'create-outline'}
                      size={13}
                      color={incentiveMode === m ? tokens.colors.primaryContainer : tokens.colors.secondary}
                    />
                    <Text style={[styles.chipText, incentiveMode === m && styles.chipTextActive]}>
                      {m === 'AUTO' ? 'Auto from Orders' : 'Manual Override'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {incentiveMode === 'AUTO' ? (
                <View style={styles.incentiveAutoInfoBox}>
                  <Text style={styles.incentiveAutoValueText}>
                    Auto Calculated: <Text style={{ fontWeight: '800' }}>+{formatCurrency(summary.incentive)}</Text>
                  </Text>
                  <Text style={styles.incentiveTierExplanation}>
                    Based on completed orders: $1–30: $0.25 • $30–50: $0.50 • $50–60: $0.75 • $60–80: $1.00 • &gt;$80: $2.00
                  </Text>
                </View>
              ) : (
                <View style={{ marginTop: 8 }}>
                  <Text style={styles.modalLabel}>Manual Incentive Amount ($)</Text>
                  <TextInput
                    style={[styles.input, !isEditable && styles.inputDisabled]}
                    value={manualIncentive}
                    keyboardType="decimal-pad"
                    onChangeText={setManualIncentive}
                    editable={isEditable}
                    placeholder="0.00"
                  />
                </View>
              )}
            </View>

            {/* CARD 4: Allowances & Performance Benefits */}
            <View style={styles.formSectionCard}>
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="gift-outline" size={16} color={tokens.colors.primaryContainer} />
                <Text style={styles.sectionTitle}>Benefits & Allowances</Text>
              </View>

              <View style={styles.benefitsGrid}>
                <View style={styles.benefitInputCol}>
                  <View style={styles.benefitLabelRow}>
                    <Ionicons name="trophy-outline" size={12} color={tokens.colors.primaryContainer} />
                    <Text style={styles.benefitLabelText} numberOfLines={1}>Performance</Text>
                  </View>
                  <View style={[styles.currencyInputBox, !isEditable && styles.inputDisabled]}>
                    <Text style={styles.currencyPrefix}>$</Text>
                    <TextInput
                      style={styles.benefitTextInput}
                      value={perfBenefit}
                      keyboardType="decimal-pad"
                      onChangeText={setPerfBenefit}
                      editable={isEditable}
                      placeholder="0.00"
                      placeholderTextColor={tokens.colors.textDisabled}
                    />
                  </View>
                </View>

                <View style={styles.benefitInputCol}>
                  <View style={styles.benefitLabelRow}>
                    <Ionicons name="bicycle-outline" size={12} color={tokens.colors.primaryContainer} />
                    <Text style={styles.benefitLabelText} numberOfLines={1}>Delivery</Text>
                  </View>
                  <View style={[styles.currencyInputBox, !isEditable && styles.inputDisabled]}>
                    <Text style={styles.currencyPrefix}>$</Text>
                    <TextInput
                      style={styles.benefitTextInput}
                      value={delivBenefit}
                      keyboardType="decimal-pad"
                      onChangeText={setDelivBenefit}
                      editable={isEditable}
                      placeholder="0.00"
                      placeholderTextColor={tokens.colors.textDisabled}
                    />
                  </View>
                </View>
              </View>

              <View style={[styles.benefitsGrid, { marginTop: 10 }]}>
                <View style={styles.benefitInputCol}>
                  <View style={styles.benefitLabelRow}>
                    <Ionicons name="people-outline" size={12} color={tokens.colors.primaryContainer} />
                    <Text style={styles.benefitLabelText} numberOfLines={1}>Collective</Text>
                  </View>
                  <View style={[styles.currencyInputBox, !isEditable && styles.inputDisabled]}>
                    <Text style={styles.currencyPrefix}>$</Text>
                    <TextInput
                      style={styles.benefitTextInput}
                      value={collecBenefit}
                      keyboardType="decimal-pad"
                      onChangeText={setCollecBenefit}
                      editable={isEditable}
                      placeholder="0.00"
                      placeholderTextColor={tokens.colors.textDisabled}
                    />
                  </View>
                </View>

                <View style={styles.benefitInputCol}>
                  <View style={styles.benefitLabelRow}>
                    <Ionicons name="add-circle-outline" size={12} color={tokens.colors.primaryContainer} />
                    <Text style={styles.benefitLabelText} numberOfLines={1}>Other Benefits</Text>
                  </View>
                  <View style={[styles.currencyInputBox, !isEditable && styles.inputDisabled]}>
                    <Text style={styles.currencyPrefix}>$</Text>
                    <TextInput
                      style={styles.benefitTextInput}
                      value={otherBenefit}
                      keyboardType="decimal-pad"
                      onChangeText={setOtherBenefit}
                      editable={isEditable}
                      placeholder="0.00"
                      placeholderTextColor={tokens.colors.textDisabled}
                    />
                  </View>
                </View>
              </View>
            </View>

            {/* CARD 5: 13TH MONTH / SENIORITY PAYOUT OPTION */}
            <View style={styles.formSectionCard}>
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="trophy-outline" size={16} color={tokens.colors.statusSuccess} />
                <Text style={styles.sectionTitle}>13th Month / Seniority Reserve Payout</Text>
              </View>

              <View style={styles.reserveInfoBanner}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.reserveBannerLabel}>ACCUMULATED RESERVE AVAILABLE</Text>
                  <Text style={styles.reserveBannerAmount}>{formatCurrency(summary.availableReservePool)}</Text>
                </View>
                <View style={styles.reserveAccruingBadge}>
                  <Text style={styles.reserveAccruingText}>+{formatCurrency(summary.thirteenth)}/mo accrued</Text>
                </View>
              </View>

              {/* Toggle Payout for this Payroll */}
              <View style={styles.payoutToggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.payoutToggleTitle}>Include Payout in this Payroll</Text>
                  <Text style={styles.payoutToggleSub}>
                    E.g. Bi-annual Khmer New Year or Year-end disbursement
                  </Text>
                </View>
                <Switch
                  value={includeThirteenthPayout}
                  onValueChange={(val) => {
                    setIncludeThirteenthPayout(val)
                    if (val && (!thirteenthPayoutAmount || thirteenthPayoutAmount === '0')) {
                      setThirteenthPayoutAmount(String(summary.availableReservePool))
                    }
                  }}
                  disabled={!isEditable}
                  trackColor={{ false: tokens.colors.surfaceMuted, true: tokens.colors.statusSuccess + '80' }}
                  thumbColor={includeThirteenthPayout ? tokens.colors.statusSuccess : '#FFFFFF'}
                />
              </View>

              {Boolean(includeThirteenthPayout) && (
                <View style={{ marginTop: 10 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={styles.modalLabel}>Disbursement Amount ($)</Text>
                    {Boolean(summary.availableReservePool > 0 && isEditable) && (
                      <TouchableOpacity
                        onPress={() => setThirteenthPayoutAmount(String(summary.availableReservePool))}
                      >
                        <Text style={{ fontSize: 11, fontWeight: '700', color: tokens.colors.primaryContainer }}>
                          Pay Full ({formatCurrency(summary.availableReservePool)})
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <TextInput
                    style={[styles.input, !isEditable && styles.inputDisabled]}
                    value={thirteenthPayoutAmount}
                    keyboardType="decimal-pad"
                    onChangeText={setThirteenthPayoutAmount}
                    editable={isEditable}
                    placeholder="0.00"
                  />
                  <Text style={{ fontSize: 10, color: tokens.colors.secondary, marginTop: 4 }}>
                    Remaining reserve balance for next cycle: <Text style={{ fontWeight: '700', color: tokens.colors.onSurface }}>{formatCurrency(summary.remainingReserve)}</Text>
                  </Text>
                </View>
              )}
            </View>

            {/* CARD 6: Complete Live Payslip Breakdown */}
            <View style={styles.payslipBreakdownCard}>
              <View style={styles.summaryHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="receipt-outline" size={16} color={tokens.colors.primaryContainer} />
                  <Text style={styles.summaryTitle}>Live Payslip Breakdown</Text>
                </View>
                <View style={styles.liveBadge}>
                  <Text style={styles.liveBadgeText}>Live Math</Text>
                </View>
              </View>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Base Monthly Salary</Text>
                <Text style={styles.summaryValue}>{formatCurrency(summary.base)}</Text>
              </View>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>
                  Order Incentive {incentiveMode === 'MANUAL' ? '(Manual)' : '(Auto)'}
                </Text>
                <Text style={[styles.summaryValue, { color: tokens.colors.statusSuccess }]}>
                  +{formatCurrency(summary.incentive)}
                </Text>
              </View>

              {summary.perf > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Performance Benefit</Text>
                  <Text style={[styles.summaryValue, { color: tokens.colors.statusSuccess }]}>
                    +{formatCurrency(summary.perf)}
                  </Text>
                </View>
              )}

              {summary.deliv > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Delivery Benefit</Text>
                  <Text style={[styles.summaryValue, { color: tokens.colors.statusSuccess }]}>
                    +{formatCurrency(summary.deliv)}
                  </Text>
                </View>
              )}

              {summary.otAmount > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Overtime ({otDays} days)</Text>
                  <Text style={[styles.summaryValue, { color: tokens.colors.statusSuccess }]}>
                    +{formatCurrency(summary.otAmount)}
                  </Text>
                </View>
              )}

              {summary.collec > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Collective Benefit</Text>
                  <Text style={[styles.summaryValue, { color: tokens.colors.statusSuccess }]}>
                    +{formatCurrency(summary.collec)}
                  </Text>
                </View>
              )}

              {summary.other > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Other Benefits</Text>
                  <Text style={[styles.summaryValue, { color: tokens.colors.statusSuccess }]}>
                    +{formatCurrency(summary.other)}
                  </Text>
                </View>
              )}

              {summary.payout > 0 && (
                <View style={[styles.summaryRow, { backgroundColor: tokens.colors.statusSuccess + '12', paddingHorizontal: 6, borderRadius: 4 }]}>
                  <Text style={[styles.summaryLabel, { color: tokens.colors.statusSuccess, fontWeight: '700' }]}>
                    🎁 13th Month / Seniority Payout
                  </Text>
                  <Text style={[styles.summaryValue, { color: tokens.colors.statusSuccess, fontWeight: '800' }]}>
                    +{formatCurrency(summary.payout)}
                  </Text>
                </View>
              )}

              {summary.unpaidDeduction > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Unpaid Leave ({unpaidDays} days)</Text>
                  <Text style={[styles.summaryValue, { color: tokens.colors.statusError }]}>
                    -{formatCurrency(summary.unpaidDeduction)}
                  </Text>
                </View>
              )}

              <View style={[styles.summaryRow, { marginTop: 4, paddingTop: 4, borderTopWidth: 1, borderColor: tokens.colors.borderSubtle }]}>
                <Text style={[styles.summaryLabel, { fontStyle: 'italic' }]}>Monthly Accrual into Reserve Fund</Text>
                <Text style={[styles.summaryValue, { color: tokens.colors.secondary }]}>
                  +{formatCurrency(summary.thirteenth)}/mo
                </Text>
              </View>

              {/* Grand Total Net Pay Highlight */}
              <View style={styles.netHighlightBox}>
                <View>
                  <Text style={styles.netHighlightLabel}>TOTAL NET PAY</Text>
                  <Text style={styles.netHighlightSub}>
                    Base + Benefits + OT {summary.payout > 0 ? '+ 13th Payout ' : ''}- Leave Deductions
                  </Text>
                </View>
                <Text style={styles.netHighlightAmount}>{formatCurrency(summary.net)}</Text>
              </View>
            </View>

            <View style={{ height: 24 }} />
          </ScrollView>

          {/* Lifecycle-aware Action Bar with prominent Delete for Drafts */}
          <View style={styles.detailActionBar}>
            {payrollStatus === 'DRAFT' && (
              <>
                <TouchableOpacity
                  style={styles.modalBtnDestructive}
                  onPress={onDeleteDraft}
                  disabled={savingDetail}
                  activeOpacity={0.8}
                >
                  <Ionicons name="trash-outline" size={16} color="#DC2626" />
                  <Text style={styles.modalBtnDestructiveText}>Delete</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalBtnSecondary, styles.modalBtnFlex, savingDetail && styles.modalBtnDisabled]}
                  onPress={() => onSaveDetail('draft')}
                  disabled={savingDetail}
                  activeOpacity={0.8}
                >
                  <Text style={styles.modalBtnSecondaryText}>Save Draft</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalBtnAction, styles.modalBtnFlex, savingDetail && styles.modalBtnDisabled]}
                  onPress={() => onSaveDetail('finalize')}
                  disabled={savingDetail}
                  activeOpacity={0.85}
                >
                  {savingDetail ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="lock-closed" size={14} color="#fff" />
                      <Text style={styles.modalBtnActionText}>Finalize</Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            )}

            {payrollStatus === 'FINALIZED' && (
              <>
                <TouchableOpacity style={styles.modalBtnCancel} onPress={onClose}>
                  <Text style={styles.modalBtnCancelText}>Close</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtnSecondary, styles.modalBtnFlex, savingDetail && styles.modalBtnDisabled]}
                  onPress={() => onTransition('DRAFT')}
                  disabled={savingDetail}
                  activeOpacity={0.8}
                >
                  <Ionicons name="refresh" size={14} color={tokens.colors.primaryContainer} />
                  <Text style={styles.modalBtnSecondaryText}>Reopen Draft</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtnPaid, styles.modalBtnFlex, savingDetail && styles.modalBtnDisabled]}
                  onPress={() => onTransition('PAID')}
                  disabled={savingDetail}
                  activeOpacity={0.85}
                >
                  <Ionicons name="cash" size={15} color="#FFFFFF" />
                  <Text style={styles.modalBtnPaidText}>Mark as Paid</Text>
                </TouchableOpacity>
              </>
            )}

            {payrollStatus === 'PAID' && (
              <TouchableOpacity
                style={[styles.modalBtnAction, { width: '100%' }]}
                onPress={onClose}
              >
                <Text style={styles.modalBtnActionText}>Done</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}
