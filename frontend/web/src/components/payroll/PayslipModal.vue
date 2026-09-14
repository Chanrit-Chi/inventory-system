<script setup lang="ts">
import { computed } from 'vue'
import { Printer } from 'lucide-vue-next'
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui'
import type { Payroll } from '@/stores/payrollStore'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

interface Props {
  open: boolean
  payroll: Payroll | null
  format?: 'A4' | 'THERMAL'
}

const props = withDefaults(defineProps<Props>(), {
  format: 'A4',
})
const emit = defineEmits<{
  (e: 'update:open', val: boolean): void
  (e: 'update:format', val: 'A4' | 'THERMAL'): void
}>()

const localFormat = computed({
  get: () => props.format,
  set: (val: 'A4' | 'THERMAL') => emit('update:format', val),
})

function getPeriodRange(year: number | string, month: number | string) {
  const y = Number(year)
  const m = Number(month)
  const pad = (n: number) => String(n).padStart(2, '0')
  const lastDay = new Date(y, m, 0).getDate()
  return {
    start: `${y}-${pad(m)}-01`,
    end: `${y}-${pad(m)}-${pad(lastDay)}`,
    lastDay,
    formatted: `01-${pad(lastDay)} ${MONTH_NAMES[m - 1] ?? ''} ${y}`,
  }
}

function formatMoney(n: number | string | undefined | null) {
  const num = typeof n === 'string' ? parseFloat(n) : n
  if (num === null || num === undefined || isNaN(num)) return '$0.00'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num)
}

function getStaffName(p: Payroll): string {
  return p.user?.name || (p as any).staff_name || `Staff #${p.user_id?.slice(0, 8) || 'N/A'}`
}

function getStaffRole(p: Payroll): string {
  const r = p.user?.role || (p as any).role || ''
  const d = p.user?.department || (p as any).department || ''
  if (r && d) return `${r} (${d})`
  return r || d || 'Employee'
}

function triggerPrint() {
  const printableArea = document.getElementById('printable-payslip')
  if (!printableArea) {
    window.print()
    return
  }

  const printWindow = window.open('', '_blank', 'width=700,height=800')
  if (!printWindow) {
    window.print()
    return
  }

  const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
    .map(el => el.outerHTML)
    .join('\n')

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Payslip - ${props.payroll ? getStaffName(props.payroll) : 'Staff'}</title>
        ${styles}
        <style>
          body { background: white !important; padding: 20px; font-family: sans-serif; }
          @page { size: ${localFormat.value === 'THERMAL' ? '80mm auto' : 'A4'}; margin: ${localFormat.value === 'THERMAL' ? '2mm' : '15mm'}; }
          #printable-payslip { border: none !important; box-shadow: none !important; width: 100% !important; max-width: ${localFormat.value === 'THERMAL' ? '72mm' : '100%'} !important; margin: 0 auto; }
        </style>
      </head>
      <body>
        ${printableArea.outerHTML}
      </body>
    </html>
  `)
  printWindow.document.close()
  printWindow.focus()
  setTimeout(() => {
    printWindow.print()
    printWindow.close()
  }, 350)
}
</script>

<template>
  <Dialog :open="open" @update:open="(val) => emit('update:open', val)">
    <DialogContent class="sm:max-w-lg max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <div class="flex items-center justify-between pr-4">
          <DialogTitle class="font-display">Staff Payslip Slip</DialogTitle>
          <div class="flex items-center gap-1 bg-surface border border-border rounded-md p-0.5 text-3xs">
            <button
              type="button"
              :class="['px-2 py-0.5 rounded font-semibold', localFormat === 'A4' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground']"
              @click="localFormat = 'A4'"
            >
              A4 Slip
            </button>
            <button
              type="button"
              :class="['px-2 py-0.5 rounded font-semibold', localFormat === 'THERMAL' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground']"
              @click="localFormat = 'THERMAL'"
            >
              Thermal (80mm)
            </button>
          </div>
        </div>
      </DialogHeader>

      <div v-if="payroll" id="printable-payslip" class="p-4 rounded-xl border border-border bg-white text-slate-900 font-sans space-y-3">
        <!-- Header -->
        <div class="text-center border-b border-slate-200 pb-3">
          <h2 class="font-bold text-base tracking-tight uppercase">Salary Payslip</h2>
          <div class="text-xs text-slate-500 font-medium">
            Period: {{ getPeriodRange(payroll.period_year, payroll.period_month).formatted }} ({{ MONTH_NAMES[payroll.period_month - 1] }} {{ payroll.period_year }})
          </div>
        </div>

        <!-- Staff Details -->
        <div class="grid grid-cols-2 gap-2 text-xs py-1 border-b border-slate-200">
          <div>
            <span class="text-slate-400 block text-[10px] uppercase font-semibold">Employee</span>
            <span class="font-bold text-slate-800">{{ getStaffName(payroll) }}</span>
          </div>
          <div class="text-right">
            <span class="text-slate-400 block text-[10px] uppercase font-semibold">Role / Dept</span>
            <span class="semibold text-slate-700">{{ getStaffRole(payroll) }}</span>
          </div>
        </div>

        <!-- Earnings Table -->
        <div class="space-y-1 text-xs">
          <div class="font-bold text-[11px] text-slate-700 uppercase tracking-wider">Earnings</div>
          <div class="flex justify-between py-0.5">
            <span class="text-slate-600">Base Salary ({{ payroll.working_days || 26 }} working days):</span>
            <span class="font-mono font-semibold text-slate-900">{{ formatMoney(payroll.base_salary) }}</span>
          </div>
          <div v-if="(payroll.overtime_pay || (payroll as any).overtime_amount || 0) > 0" class="flex justify-between py-0.5">
            <span class="text-slate-600">Overtime Pay ({{ payroll.overtime_days || 0 }} days):</span>
            <span class="font-mono font-semibold text-emerald-600">+ {{ formatMoney(payroll.overtime_pay || (payroll as any).overtime_amount) }}</span>
          </div>
          <div v-if="((payroll as any).incentive_override ?? payroll.sales_commission ?? (payroll as any).incentive_amount ?? 0) > 0" class="flex justify-between py-0.5">
            <span class="text-slate-600">Sales Commission / Incentive:</span>
            <span class="font-mono font-semibold text-emerald-600">+ {{ formatMoney((payroll as any).incentive_override ?? payroll.sales_commission ?? (payroll as any).incentive_amount) }}</span>
          </div>
          <div v-if="(payroll.performance_benefit || 0) > 0" class="flex justify-between py-0.5">
            <span class="text-slate-600">Performance Benefit:</span>
            <span class="font-mono font-semibold text-emerald-600">+ {{ formatMoney(payroll.performance_benefit) }}</span>
          </div>
          <div v-if="(payroll.delivery_benefit || 0) > 0" class="flex justify-between py-0.5">
            <span class="text-slate-600">Delivery Benefit:</span>
            <span class="font-mono font-semibold text-emerald-600">+ {{ formatMoney(payroll.delivery_benefit) }}</span>
          </div>
          <div v-if="(payroll.collective_benefit || 0) > 0" class="flex justify-between py-0.5">
            <span class="text-slate-600">Collective Benefit:</span>
            <span class="font-mono font-semibold text-emerald-600">+ {{ formatMoney(payroll.collective_benefit) }}</span>
          </div>
          <div v-if="(payroll.other_benefits || 0) > 0" class="flex justify-between py-0.5">
            <span class="text-slate-600">Other Benefits:</span>
            <span class="font-mono font-semibold text-emerald-600">+ {{ formatMoney(payroll.other_benefits) }}</span>
          </div>
          <div v-if="(payroll.thirteenth_month_payout || 0) > 0" class="flex justify-between py-1 bg-emerald-50 px-2 rounded border border-emerald-200">
            <span class="text-emerald-800 font-semibold">🎁 13th Month / Seniority Payout:</span>
            <span class="font-mono font-bold text-emerald-700">+ {{ formatMoney(payroll.thirteenth_month_payout) }}</span>
          </div>
        </div>

        <!-- Deductions -->
        <div v-if="(payroll.unpaid_leave_deduction || 0) + (payroll.tax_deduction || 0) > 0" class="space-y-1 text-xs border-t border-slate-200 pt-2">
          <div class="font-bold text-[11px] text-slate-700 uppercase tracking-wider">Deductions</div>
          <div v-if="(payroll.unpaid_leave_deduction || 0) > 0" class="flex justify-between py-0.5">
            <span class="text-slate-600">Unpaid Leave ({{ payroll.unpaid_leave_days || 0 }} days):</span>
            <span class="font-mono font-semibold text-rose-600">- {{ formatMoney(payroll.unpaid_leave_deduction) }}</span>
          </div>
          <div v-if="(payroll.tax_deduction || 0) > 0" class="flex justify-between py-0.5">
            <span class="text-slate-600">Tax Deduction:</span>
            <span class="font-mono font-semibold text-rose-600">- {{ formatMoney(payroll.tax_deduction) }}</span>
          </div>
        </div>

        <!-- Monthly Accrual Info -->
        <div class="flex justify-between items-center py-1 border-t border-slate-100 text-[10px] text-slate-500 italic">
          <span>Monthly Seniority Accrual into Reserve Fund:</span>
          <span class="font-mono font-medium text-slate-600">+{{ formatMoney(payroll.thirteenth_month_contribution || payroll.thirteenth_month_accrual || Math.round((payroll.base_salary / 12) * 100) / 100) }}/mo</span>
        </div>

        <!-- Total Net -->
        <div class="border-t-2 border-slate-900 pt-2 flex justify-between items-center text-sm font-bold">
          <span class="uppercase tracking-wider">Net Amount Paid:</span>
          <span class="text-base font-mono text-emerald-700">{{ formatMoney(payroll.total_net_pay || (payroll as any).total_net) }}</span>
        </div>

        <!-- Signature Section for A4 -->
        <div v-if="localFormat === 'A4'" class="grid grid-cols-2 gap-6 pt-6 mt-4 border-t border-slate-200 text-center text-3xs text-slate-500">
          <div>
            <div class="h-10 border-b border-slate-300"></div>
            <span class="mt-1 block">Prepared By (Admin)</span>
          </div>
          <div>
            <div class="h-10 border-b border-slate-300"></div>
            <span class="mt-1 block">Employee Signature</span>
          </div>
        </div>
      </div>

      <DialogFooter class="gap-2 sm:gap-0 mt-4">
        <Button variant="outline" @click="emit('update:open', false)">Close</Button>
        <Button variant="primary" class="gap-1.5" @click="triggerPrint">
          <Printer :size="14" />
          <span>Print Payslip</span>
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
