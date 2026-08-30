import { tokens } from '../../theme/tokens'
import type { Payroll, UserAccount, ThirteenthMonthSummary } from '../../types'

export const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

export const formatCurrency = (val: number | string | undefined | null) => {
  return '$' + Number(val || 0).toFixed(2)
}

export const round2 = (n: number) => Math.round(n * 100) / 100

export const getStatusColor = (status: string) => {
  if (status === 'PAID') return tokens.colors.statusSuccess
  if (status === 'FINALIZED') return tokens.colors.statusWarning
  return tokens.colors.secondary
}

export const getStaffName = (
  p: Pick<Payroll, 'user_id' | 'user'>,
  users: UserAccount[]
): string => {
  return p.user?.name || users.find((u) => u.id === p.user_id)?.name || 'Unknown Staff'
}

export interface PayrollSummaryInput {
  editingPayroll: Payroll | null
  incentiveMode: 'AUTO' | 'MANUAL'
  manualIncentive: string
  workingDays: string
  otDays: string
  unpaidDays: string
  perfBenefit: string
  delivBenefit: string
  collecBenefit: string
  otherBenefit: string
  includeThirteenthPayout: boolean
  thirteenthPayoutAmount: string
  reserveSummary: ThirteenthMonthSummary | null
}

export function calculatePayrollSummary(input: PayrollSummaryInput) {
  const base = Number(input.editingPayroll?.base_salary || 0)
  const incentive =
    input.incentiveMode === 'MANUAL'
      ? parseFloat(input.manualIncentive) || 0
      : Number(input.editingPayroll?.incentive_amount || 0)
  const thirteenth = round2(base / 12)
  const wd = Math.max(parseInt(input.workingDays, 10) || 26, 1)
  const dailyRate = base / wd
  const otAmount = round2((parseFloat(input.otDays) || 0) * dailyRate)
  const unpaidDeduction = round2((parseFloat(input.unpaidDays) || 0) * dailyRate)
  const perf = parseFloat(input.perfBenefit) || 0
  const deliv = parseFloat(input.delivBenefit) || 0
  const collec = parseFloat(input.collecBenefit) || 0
  const other = parseFloat(input.otherBenefit) || 0
  const payout = input.includeThirteenthPayout ? parseFloat(input.thirteenthPayoutAmount) || 0 : 0

  const totalEarnings = round2(base + incentive + perf + deliv + otAmount + collec + other + payout)
  const net = round2(totalEarnings - unpaidDeduction)

  // Calculate remaining reserve balance after this payout
  const existingPayoutInPayroll = Number(input.editingPayroll?.thirteenth_month_payout || 0)
  const availableReservePool = round2((input.reserveSummary?.available_balance ?? 0) + existingPayoutInPayroll)
  const remainingReserve = Math.max(0, round2(availableReservePool - payout))

  return {
    base,
    incentive,
    thirteenth,
    dailyRate,
    otAmount,
    unpaidDeduction,
    perf,
    deliv,
    collec,
    other,
    payout,
    availableReservePool,
    remainingReserve,
    totalEarnings,
    net,
  }
}
