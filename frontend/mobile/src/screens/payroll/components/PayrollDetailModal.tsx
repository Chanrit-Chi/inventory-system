import React, { useState } from 'react'
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

  const [showIncentiveNote, setShowIncentiveNote] = useState(false)
  const [showRateNote, setShowRateNote] = useState(false)
  const [showCalcNote, setShowCalcNote] = useState(false)

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
            {/* Top Net Pay Hero - Instant key summary */}
            <View style={styles.detailHeroCard}>
              <View style={styles.detailHeroTopRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={styles.detailHeroLabel}>Total Net Pay</Text>
                  <TouchableOpacity
                    style={styles.infoIconBtn}
                    onPress={() => setShowCalcNote((prev) => !prev)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityRole="button"
                    accessibilityLabel="Net pay calculation breakdown info"
                  >
                    <Ionicons
                      name={showCalcNote ? 'information-circle' : 'information-circle-outline'}
                      size={15}
                      color={tokens.colors.primaryContainer}
                    />
                  </TouchableOpacity>
                </View>
                <Text style={styles.detailHeroAmount}>{formatCurrency(summary.net)}</Text>
              </View>

              {showCalcNote && (
                <View style={[styles.calculationNoteBox, { marginTop: 2, marginBottom: 8 }]}>
                  <Text style={styles.calculationNoteTitle}>Net Pay Calculation Formula</Text>
                  <Text style={styles.calculationNoteText}>
                    • Base: {formatCurrency(summary.base)}
                  </Text>
                  {summary.incentive > 0 && (
                    <Text style={styles.calculationNoteText}>
                      • Order Incentive: +{formatCurrency(summary.incentive)}
                    </Text>
                  )}
                  {summary.perf + summary.deliv + summary.collec + summary.other > 0 && (
                    <Text style={styles.calculationNoteText}>
                      • Benefits & Allowances: +{formatCurrency(summary.perf + summary.deliv + summary.collec + summary.other)}
                    </Text>
                  )}
                  {summary.otAmount > 0 && (
                    <Text style={styles.calculationNoteText}>
                      • Overtime ({otDays}d @ {formatCurrency(summary.dailyRate)}/d): +{formatCurrency(summary.otAmount)}
                    </Text>
                  )}
                  {summary.payout > 0 && (
                    <Text style={styles.calculationNoteText}>
                      • 13th Month / Seniority Payout: +{formatCurrency(summary.payout)}
                    </Text>
                  )}
                  {summary.unpaidDeduction > 0 && (
                    <Text style={styles.calculationNoteText}>
                      • Unpaid Leave ({unpaidDays}d @ {formatCurrency(summary.dailyRate)}/d): -{formatCurrency(summary.unpaidDeduction)}
                    </Text>
                  )}
                  <Text style={[styles.calculationNoteText, { fontWeight: '700', marginTop: 2 }]}>
                    = Net Pay: {formatCurrency(summary.net)}
                  </Text>
                </View>
              )}

              <View style={styles.detailHeroMetricsRow}>
                <View style={styles.detailHeroMetricItem}>
                  <Text style={styles.detailHeroMetricLabel}>Base</Text>
                  <Text style={styles.detailHeroMetricValue}>{formatCurrency(summary.base)}</Text>
                </View>
                <View style={styles.detailHeroDivider} />
                <View style={styles.detailHeroMetricItem}>
                  <Text style={styles.detailHeroMetricLabel}>+ Earnings</Text>
                  <Text style={[styles.detailHeroMetricValue, { color: tokens.colors.statusSuccess }]}>
                    +{formatCurrency(summary.totalEarnings - summary.base)}
                  </Text>
                </View>
                <View style={styles.detailHeroDivider} />
                <View style={styles.detailHeroMetricItem}>
                  <Text style={styles.detailHeroMetricLabel}>- Deductions</Text>
                  <Text
                    style={[
                      styles.detailHeroMetricValue,
                      {
                        color:
                          summary.unpaidDeduction > 0
                            ? tokens.colors.statusError
                            : tokens.colors.secondary,
                      },
                    ]}
                  >
                    -{formatCurrency(summary.unpaidDeduction)}
                  </Text>
                </View>
              </View>
            </View>

            {!isEditable ? (
              <>
                {/* Clean Read-Only Earnings Voucher */}
                <View style={styles.payslipSectionCard}>
                  <View style={styles.payslipSectionHeader}>
                    <Ionicons name="wallet-outline" size={15} color={tokens.colors.primaryContainer} />
                    <Text style={styles.payslipSectionTitle}>Earnings Breakdown</Text>
                  </View>

                  <View style={styles.payslipLineRow}>
                    <Text style={styles.payslipLineLabel}>Base Monthly Salary</Text>
                    <Text style={styles.payslipLineValue}>{formatCurrency(summary.base)}</Text>
                  </View>

                  {summary.incentive > 0 && (
                    <View style={styles.payslipLineRow}>
                      <Text style={styles.payslipLineLabel}>
                        Order Incentive {incentiveMode === 'MANUAL' ? '(Manual)' : '(Auto)'}
                      </Text>
                      <Text style={[styles.payslipLineValue, { color: tokens.colors.statusSuccess }]}>
                        +{formatCurrency(summary.incentive)}
                      </Text>
                    </View>
                  )}

                  {summary.perf > 0 && (
                    <View style={styles.payslipLineRow}>
                      <Text style={styles.payslipLineLabel}>Performance Benefit</Text>
                      <Text style={[styles.payslipLineValue, { color: tokens.colors.statusSuccess }]}>
                        +{formatCurrency(summary.perf)}
                      </Text>
                    </View>
                  )}

                  {summary.deliv > 0 && (
                    <View style={styles.payslipLineRow}>
                      <Text style={styles.payslipLineLabel}>Delivery Benefit</Text>
                      <Text style={[styles.payslipLineValue, { color: tokens.colors.statusSuccess }]}>
                        +{formatCurrency(summary.deliv)}
                      </Text>
                    </View>
                  )}

                  {summary.otAmount > 0 && (
                    <View style={styles.payslipLineRow}>
                      <Text style={styles.payslipLineLabel}>Overtime ({otDays} days)</Text>
                      <Text style={[styles.payslipLineValue, { color: tokens.colors.statusSuccess }]}>
                        +{formatCurrency(summary.otAmount)}
                      </Text>
                    </View>
                  )}

                  {summary.collec > 0 && (
                    <View style={styles.payslipLineRow}>
                      <Text style={styles.payslipLineLabel}>Collective Benefit</Text>
                      <Text style={[styles.payslipLineValue, { color: tokens.colors.statusSuccess }]}>
                        +{formatCurrency(summary.collec)}
                      </Text>
                    </View>
                  )}

                  {summary.other > 0 && (
                    <View style={styles.payslipLineRow}>
                      <Text style={styles.payslipLineLabel}>Other Benefits</Text>
                      <Text style={[styles.payslipLineValue, { color: tokens.colors.statusSuccess }]}>
                        +{formatCurrency(summary.other)}
                      </Text>
                    </View>
                  )}

                  {summary.payout > 0 && (
                    <View style={styles.payslipLineRow}>
                      <Text
                        style={[
                          styles.payslipLineLabel,
                          { color: tokens.colors.statusSuccess, fontWeight: '700' },
                        ]}
                      >
                        13th Month / Seniority Payout
                      </Text>
                      <Text
                        style={[
                          styles.payslipLineValue,
                          { color: tokens.colors.statusSuccess, fontWeight: '800' },
                        ]}
                      >
                        +{formatCurrency(summary.payout)}
                      </Text>
                    </View>
                  )}

                  <View style={[styles.payslipLineRow, styles.payslipLineTotal]}>
                    <Text style={styles.payslipLineTotalLabel}>Total Earnings</Text>
                    <Text
                      style={[
                        styles.payslipLineTotalValue,
                        { color: tokens.colors.statusSuccess },
                      ]}
                    >
                      {formatCurrency(summary.totalEarnings)}
                    </Text>
                  </View>
                </View>

                {/* Clean Deductions & Reserves */}
                <View style={styles.payslipSectionCard}>
                  <View style={styles.payslipSectionHeader}>
                    <Ionicons name="document-text-outline" size={15} color={tokens.colors.secondary} />
                    <Text style={styles.payslipSectionTitle}>Deductions & Reserves</Text>
                  </View>

                  <View style={styles.payslipLineRow}>
                    <Text style={styles.payslipLineLabel}>Unpaid Leave ({unpaidDays} days)</Text>
                    <Text
                      style={[
                        styles.payslipLineValue,
                        summary.unpaidDeduction > 0 && { color: tokens.colors.statusError },
                      ]}
                    >
                      {summary.unpaidDeduction > 0
                        ? `-${formatCurrency(summary.unpaidDeduction)}`
                        : '$0.00'}
                    </Text>
                  </View>

                  <View style={styles.payslipLineRow}>
                    <Text style={styles.payslipLineLabel}>Working Days</Text>
                    <Text style={styles.payslipLineValue}>{workingDays} days</Text>
                  </View>

                  <View style={styles.payslipLineRow}>
                    <Text style={styles.payslipLineLabel}>13th Month Accrual (Reserve)</Text>
                    <Text style={[styles.payslipLineValue, { color: tokens.colors.secondary }]}>
                      +{formatCurrency(summary.thirteenth)}/mo
                    </Text>
                  </View>
                </View>
              </>
            ) : (
              <>
                {/* CARD 1: Working Days & Attendance */}
                <View style={styles.formSectionCard}>
                  <View style={styles.sectionHeaderRow}>
                    <Ionicons name="calendar-outline" size={15} color={tokens.colors.primaryContainer} />
                    <Text style={styles.sectionTitle}>Working Days & Attendance</Text>
                    <View style={{ marginLeft: 'auto', flexDirection: 'row', alignItems: 'center' }}>
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: '700',
                          color: tokens.colors.primaryContainer,
                        }}
                      >
                        {formatCurrency(summary.dailyRate)}/day
                      </Text>
                      <TouchableOpacity
                        style={styles.infoIconBtn}
                        onPress={() => setShowRateNote((prev) => !prev)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityRole="button"
                        accessibilityLabel="Daily rate calculation info"
                      >
                        <Ionicons
                          name={showRateNote ? 'information-circle' : 'information-circle-outline'}
                          size={15}
                          color={tokens.colors.primaryContainer}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {showRateNote && (
                    <View style={styles.calculationNoteBox}>
                      <Text style={styles.calculationNoteTitle}>Daily Rate Calculation</Text>
                      <Text style={styles.calculationNoteText}>
                        • Daily Rate = Base Salary ({formatCurrency(summary.base)}) ÷ {workingDays || 26} work days = {formatCurrency(summary.dailyRate)}/day
                      </Text>
                      <Text style={styles.calculationNoteText}>
                        • Overtime = {otDays || 0} days × {formatCurrency(summary.dailyRate)} = +{formatCurrency(summary.otAmount)}
                      </Text>
                      <Text style={styles.calculationNoteText}>
                        • Unpaid Leave = {unpaidDays || 0} days × {formatCurrency(summary.dailyRate)} = -{formatCurrency(summary.unpaidDeduction)}
                      </Text>
                    </View>
                  )}

                  <View style={styles.twoColGrid}>
                    <View style={styles.attendanceCol}>
                      <Text style={styles.attendanceColLabel} numberOfLines={1}>
                        Work Days
                      </Text>
                      <TextInput
                        style={[styles.input, styles.attendanceInput]}
                        value={workingDays}
                        keyboardType="numeric"
                        onChangeText={setWorkingDays}
                        placeholder="26"
                      />
                    </View>

                    <View style={styles.attendanceCol}>
                      <Text style={styles.attendanceColLabel} numberOfLines={1}>
                        Overtime (d)
                      </Text>
                      <TextInput
                        style={[styles.input, styles.attendanceInput]}
                        value={otDays}
                        keyboardType="decimal-pad"
                        onChangeText={setOtDays}
                        placeholder="0"
                      />
                    </View>

                    <View style={styles.attendanceCol}>
                      <Text style={styles.attendanceColLabel} numberOfLines={1}>
                        Unpaid (d)
                      </Text>
                      <TextInput
                        style={[styles.input, styles.attendanceInput]}
                        value={unpaidDays}
                        keyboardType="decimal-pad"
                        onChangeText={setUnpaidDays}
                        placeholder="0"
                      />
                    </View>
                  </View>

                  {(summary.otAmount > 0 || summary.unpaidDeduction > 0) && (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, paddingHorizontal: 2 }}>
                      <Text style={{ fontSize: 9.5, color: tokens.colors.secondary }}>
                        Rate: {formatCurrency(summary.dailyRate)}/d
                      </Text>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        {summary.otAmount > 0 && (
                          <Text style={{ fontSize: 9.5, color: tokens.colors.statusSuccess, fontWeight: '700' }}>
                            OT: +{formatCurrency(summary.otAmount)}
                          </Text>
                        )}
                        {summary.unpaidDeduction > 0 && (
                          <Text style={{ fontSize: 9.5, color: tokens.colors.statusError, fontWeight: '700' }}>
                            Leave: -{formatCurrency(summary.unpaidDeduction)}
                          </Text>
                        )}
                      </View>
                    </View>
                  )}
                </View>

                {/* CARD 2: Sales Order Incentive */}
                <View style={styles.formSectionCard}>
                  <View style={styles.sectionHeaderRow}>
                    <Ionicons name="trending-up-outline" size={15} color={tokens.colors.primaryContainer} />
                    <Text style={styles.sectionTitle}>Order Incentive</Text>
                  </View>

                  <View style={styles.pickerRow}>
                    {(['AUTO', 'MANUAL'] as const).map((m) => (
                      <TouchableOpacity
                        key={m}
                        style={[styles.chip, incentiveMode === m && styles.chipActive]}
                        onPress={() => setIncentiveMode(m)}
                      >
                        <Ionicons
                          name={m === 'AUTO' ? 'flash-outline' : 'create-outline'}
                          size={13}
                          color={
                            incentiveMode === m
                              ? tokens.colors.primaryContainer
                              : tokens.colors.secondary
                          }
                        />
                        <Text
                          style={[
                            styles.chipText,
                            incentiveMode === m && styles.chipTextActive,
                          ]}
                        >
                          {m === 'AUTO' ? 'Auto from Orders' : 'Manual Override'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {incentiveMode === 'AUTO' ? (
                    <View style={styles.incentiveAutoInfoBox}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Text style={styles.incentiveAutoValueText}>
                          Calculated from Orders:{' '}
                          <Text
                            style={{
                              fontWeight: '800',
                              color: tokens.colors.statusSuccess,
                            }}
                          >
                            +{formatCurrency(summary.incentive)}
                          </Text>
                        </Text>
                        <TouchableOpacity
                          style={styles.infoIconBtn}
                          onPress={() => setShowIncentiveNote((prev) => !prev)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          accessibilityRole="button"
                          accessibilityLabel="Order incentive calculation note"
                        >
                          <Ionicons
                            name={showIncentiveNote ? 'information-circle' : 'information-circle-outline'}
                            size={16}
                            color={tokens.colors.primaryContainer}
                          />
                        </TouchableOpacity>
                      </View>

                      {showIncentiveNote && (
                        <View style={[styles.calculationNoteBox, { marginTop: 6, marginBottom: 0 }]}>
                          <Text style={styles.calculationNoteTitle}>Order Incentive Tiers</Text>
                          <Text style={styles.calculationNoteText}>
                            Based on monthly completed orders: $1–30: $0.25 • $30–50: $0.50 • $50–60: $0.75 • $60–80: $1.00 • &gt;$80: $2.00
                          </Text>
                        </View>
                      )}
                    </View>
                  ) : (
                    <View style={{ marginTop: 8 }}>
                      <Text style={styles.modalLabel}>Manual Amount ($)</Text>
                      <TextInput
                        style={styles.input}
                        value={manualIncentive}
                        keyboardType="decimal-pad"
                        onChangeText={setManualIncentive}
                        placeholder="0.00"
                      />
                    </View>
                  )}
                </View>

                {/* CARD 3: Benefits & Allowances */}
                <View style={styles.formSectionCard}>
                  <View style={styles.sectionHeaderRow}>
                    <Ionicons name="gift-outline" size={15} color={tokens.colors.primaryContainer} />
                    <Text style={styles.sectionTitle}>Benefits & Allowances</Text>
                  </View>

                  <View style={styles.benefitsGrid}>
                    <View style={styles.benefitInputCol}>
                      <View style={styles.benefitLabelRow}>
                        <Ionicons name="trophy-outline" size={12} color={tokens.colors.primaryContainer} />
                        <Text style={styles.benefitLabelText} numberOfLines={1}>
                          Performance
                        </Text>
                      </View>
                      <View style={styles.currencyInputBox}>
                        <Text style={styles.currencyPrefix}>$</Text>
                        <TextInput
                          style={styles.benefitTextInput}
                          value={perfBenefit}
                          keyboardType="decimal-pad"
                          onChangeText={setPerfBenefit}
                          placeholder="0.00"
                          placeholderTextColor={tokens.colors.textDisabled}
                        />
                      </View>
                    </View>

                    <View style={styles.benefitInputCol}>
                      <View style={styles.benefitLabelRow}>
                        <Ionicons name="bicycle-outline" size={12} color={tokens.colors.primaryContainer} />
                        <Text style={styles.benefitLabelText} numberOfLines={1}>
                          Delivery
                        </Text>
                      </View>
                      <View style={styles.currencyInputBox}>
                        <Text style={styles.currencyPrefix}>$</Text>
                        <TextInput
                          style={styles.benefitTextInput}
                          value={delivBenefit}
                          keyboardType="decimal-pad"
                          onChangeText={setDelivBenefit}
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
                        <Text style={styles.benefitLabelText} numberOfLines={1}>
                          Collective
                        </Text>
                      </View>
                      <View style={styles.currencyInputBox}>
                        <Text style={styles.currencyPrefix}>$</Text>
                        <TextInput
                          style={styles.benefitTextInput}
                          value={collecBenefit}
                          keyboardType="decimal-pad"
                          onChangeText={setCollecBenefit}
                          placeholder="0.00"
                          placeholderTextColor={tokens.colors.textDisabled}
                        />
                      </View>
                    </View>

                    <View style={styles.benefitInputCol}>
                      <View style={styles.benefitLabelRow}>
                        <Ionicons name="add-circle-outline" size={12} color={tokens.colors.primaryContainer} />
                        <Text style={styles.benefitLabelText} numberOfLines={1}>
                          Other
                        </Text>
                      </View>
                      <View style={styles.currencyInputBox}>
                        <Text style={styles.currencyPrefix}>$</Text>
                        <TextInput
                          style={styles.benefitTextInput}
                          value={otherBenefit}
                          keyboardType="decimal-pad"
                          onChangeText={setOtherBenefit}
                          placeholder="0.00"
                          placeholderTextColor={tokens.colors.textDisabled}
                        />
                      </View>
                    </View>
                  </View>
                </View>

                {/* CARD 4: 13th Month / Seniority Payout */}
                <View style={styles.formSectionCard}>
                  <View style={styles.sectionHeaderRow}>
                    <Ionicons name="trophy-outline" size={15} color={tokens.colors.statusSuccess} />
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

                  <View style={styles.payoutToggleRow}>
                    <Text style={styles.payoutToggleTitle}>Include Payout in this Payroll</Text>
                    <Switch
                      value={includeThirteenthPayout}
                      onValueChange={(val) => {
                        setIncludeThirteenthPayout(val)
                        if (val && (!thirteenthPayoutAmount || thirteenthPayoutAmount === '0')) {
                          setThirteenthPayoutAmount(String(summary.availableReservePool))
                        }
                      }}
                      trackColor={{ false: tokens.colors.surfaceMuted, true: tokens.colors.statusSuccess + '80' }}
                      thumbColor={includeThirteenthPayout ? tokens.colors.statusSuccess : '#FFFFFF'}
                    />
                  </View>

                  {Boolean(includeThirteenthPayout) && (
                    <View style={{ marginTop: 8 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={styles.modalLabel}>Disbursement Amount ($)</Text>
                        {Boolean(summary.availableReservePool > 0) && (
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
                        style={styles.input}
                        value={thirteenthPayoutAmount}
                        keyboardType="decimal-pad"
                        onChangeText={setThirteenthPayoutAmount}
                        placeholder="0.00"
                      />
                      <Text style={{ fontSize: 10, color: tokens.colors.secondary, marginTop: 4 }}>
                        Remaining reserve: <Text style={{ fontWeight: '700', color: tokens.colors.onSurface }}>{formatCurrency(summary.remainingReserve)}</Text>
                      </Text>
                    </View>
                  )}
                </View>

                {/* CARD 5: Live Math Breakdown */}
                <View style={styles.payslipBreakdownCard}>
                  <View style={styles.summaryHeaderRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="receipt-outline" size={15} color={tokens.colors.primaryContainer} />
                      <Text style={styles.summaryTitle}>Live Breakdown</Text>
                      <TouchableOpacity
                        style={styles.infoIconBtn}
                        onPress={() => setShowCalcNote((prev) => !prev)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityRole="button"
                        accessibilityLabel="Calculation note"
                      >
                        <Ionicons
                          name={showCalcNote ? 'information-circle' : 'information-circle-outline'}
                          size={15}
                          color={tokens.colors.primaryContainer}
                        />
                      </TouchableOpacity>
                    </View>
                    <View style={styles.liveBadge}>
                      <Text style={styles.liveBadgeText}>Live Math</Text>
                    </View>
                  </View>

                  {showCalcNote && (
                    <View style={[styles.calculationNoteBox, { marginBottom: 8 }]}>
                      <Text style={styles.calculationNoteTitle}>Calculation Formula</Text>
                      <Text style={styles.calculationNoteText}>
                        Net Pay = Base Salary + Order Incentives + Benefits + Overtime + 13th Payout - Unpaid Leave Deductions
                      </Text>
                    </View>
                  )}

                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Base Monthly Salary</Text>
                    <Text style={styles.summaryValue}>{formatCurrency(summary.base)}</Text>
                  </View>

                  {summary.incentive > 0 && (
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Order Incentive</Text>
                      <Text style={[styles.summaryValue, { color: tokens.colors.statusSuccess }]}>
                        +{formatCurrency(summary.incentive)}
                      </Text>
                    </View>
                  )}

                  {summary.perf + summary.deliv + summary.collec + summary.other > 0 && (
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Total Benefits</Text>
                      <Text style={[styles.summaryValue, { color: tokens.colors.statusSuccess }]}>
                        +{formatCurrency(summary.perf + summary.deliv + summary.collec + summary.other)}
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

                  {summary.payout > 0 && (
                    <View
                      style={[
                        styles.summaryRow,
                        {
                          backgroundColor: tokens.colors.statusSuccess + '12',
                          paddingHorizontal: 6,
                          borderRadius: 4,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.summaryLabel,
                          { color: tokens.colors.statusSuccess, fontWeight: '700' },
                        ]}
                      >
                        13th Month / Seniority Payout
                      </Text>
                      <Text
                        style={[
                          styles.summaryValue,
                          { color: tokens.colors.statusSuccess, fontWeight: '800' },
                        ]}
                      >
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

                  <View
                    style={[
                      styles.summaryRow,
                      {
                        marginTop: 4,
                        paddingTop: 4,
                        borderTopWidth: 1,
                        borderColor: tokens.colors.borderSubtle,
                      },
                    ]}
                  >
                    <Text style={[styles.summaryLabel, { fontStyle: 'italic' }]}>
                      Reserve Accrual
                    </Text>
                    <Text style={[styles.summaryValue, { color: tokens.colors.secondary }]}>
                      +{formatCurrency(summary.thirteenth)}/mo
                    </Text>
                  </View>

                  <View style={styles.netHighlightBox}>
                    <Text style={styles.netHighlightLabel}>TOTAL NET PAY</Text>
                    <Text style={styles.netHighlightAmount}>{formatCurrency(summary.net)}</Text>
                  </View>
                </View>
              </>
            )}

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
