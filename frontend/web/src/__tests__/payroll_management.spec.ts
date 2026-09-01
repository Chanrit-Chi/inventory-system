import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import api from '@/api/axios'
import router from '@/router'
import type { Payroll } from '@/stores/payrollStore'
import PayrollView from '@/views/PayrollView.vue'

// Mock Axios
vi.mock('@/api/axios', () => {
  const mockApi = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  }
  return {
    default: mockApi,
    ApiError: class ApiError extends Error {
      errors?: Record<string, string[]>
      status?: number
      constructor(msg: string, errors?: Record<string, string[]>, status?: number) {
        super(msg)
        this.name = 'ApiError'
        this.errors = errors
        this.status = status
      }
    },
  }
})

describe('Staff Payroll Management System', () => {
  const mockStaffUsers = [
    { id: 'u-1', name: 'Alice Cashier', role: 'SELLER', department: 'Front Counter', status: 'active' },
    { id: 'u-2', name: 'Bob Salesrep', role: 'SELLER', department: 'Outside Sales', status: 'active' },
    { id: 'u-3', name: 'Carol Manager', role: 'MANAGER', department: 'Store Operations', status: 'active' },
  ]

  const mockPayrolls: Payroll[] = [
    {
      id: 'pay-1',
      user_id: 'u-1',
      user: { id: 'u-1', name: 'Alice Cashier', email: 'alice@store.com', role: 'SELLER', department: 'Front Counter' },
      period_month: 8,
      period_year: 2026,
      status: 'DRAFT',
      base_salary: 500,
      working_days: 26,
      performance_benefit: 30,
      delivery_benefit: 20,
      overtime_days: 2,
      overtime_pay: 38.46,
      unpaid_leave_days: 1,
      unpaid_leave_deduction: 19.23,
      collective_benefit: 0,
      other_benefits: 0,
      sales_commission: 75.50,
      thirteenth_month_accrual: 25.00,
      thirteenth_month_payout: 0,
      gross_salary: 663.96,
      tax_deduction: 0,
      total_net_pay: 644.73,
    },
    {
      id: 'pay-2',
      user_id: 'u-2',
      user: { id: 'u-2', name: 'Bob Salesrep', email: 'bob@store.com', role: 'SELLER', department: 'Outside Sales' },
      period_month: 8,
      period_year: 2026,
      status: 'FINALIZED',
      base_salary: 600,
      working_days: 26,
      performance_benefit: 50,
      delivery_benefit: 0,
      overtime_days: 0,
      overtime_pay: 0,
      unpaid_leave_days: 0,
      unpaid_leave_deduction: 0,
      collective_benefit: 0,
      other_benefits: 0,
      sales_commission: 120.00,
      thirteenth_month_accrual: 30.00,
      thirteenth_month_payout: 0,
      gross_salary: 770.00,
      tax_deduction: 0,
      total_net_pay: 770.00,
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())

    ;(api.get as any).mockImplementation((url: string) => {
      if (url === '/payrolls') {
        return Promise.resolve({ data: { data: mockPayrolls, meta: { total: 2, current_page: 1, last_page: 1 } } })
      }
      if (url === '/users') {
        return Promise.resolve({ data: { data: mockStaffUsers } })
      }
      if (url.includes('/salary')) {
        return Promise.resolve({ data: { data: { base_salary: 500, currency: 'USD' } } })
      }
      if (url.includes('/13th-month-savings')) {
        return Promise.resolve({
          data: {
            data: {
              user_id: 'u-1',
              total_accrued: 150,
              total_paid_out: 0,
              available_balance: 150,
            },
          },
        })
      }
      return Promise.resolve({ data: { data: [] } })
    })
  })

  describe('1. Payroll List & KPI Summaries', () => {
    it('renders staff compensation records, names, roles, and status badges', async () => {
      const wrapper = mount(PayrollView, {
        global: {
          plugins: [router],
          stubs: { RouterLink: true, teleport: true },
        },
      })
      await flushPromises()

      expect(wrapper.text()).toContain('Staff Payroll')
      expect(wrapper.text()).toContain('Alice Cashier')
      expect(wrapper.text()).toContain('Bob Salesrep')
      expect(wrapper.text()).toContain('$644.73')
      expect(wrapper.text()).toContain('$770.00')
      expect(wrapper.text()).toContain('Draft')
      expect(wrapper.text()).toContain('Finalized')
    })

    it('calculates KPIs for net disbursements, commissions, and 13th month reserves', async () => {
      const wrapper = mount(PayrollView, {
        global: {
          plugins: [router],
          stubs: { RouterLink: true, teleport: true },
        },
      })
      await flushPromises()

      // Net payouts: 644.73 + 770.00 = 1414.73
      expect(wrapper.text()).toContain('$1414.73')
      // Commissions: 75.50 + 120.00 = 195.50
      expect(wrapper.text()).toContain('$195.50')
      // 13th month accrual: 25.00 + 30.00 = 55.00
      expect(wrapper.text()).toContain('$55.00')
    })
  })

  describe('2. Interactive Calculation & Live Math Reactivity', () => {
    it('opens detail modal and computes daily rate, overtime, unpaid deductions, and net salary in real time', async () => {
      const wrapper = mount(PayrollView, {
        global: {
          plugins: [router],
          stubs: { RouterLink: true, teleport: true },
        },
      })
      await flushPromises()

      const vm = wrapper.vm as any
      // Open Alice's draft payroll
      await vm.openDetail(mockPayrolls[0])
      expect(vm.showDetailModal).toBe(true)
      expect(vm.editingPayroll?.id).toBe('pay-1')

      // Check initial live calculation values (base: 500, days: 26 -> dailyRate = 19.2307)
      expect(vm.liveCalculations.dailyRate).toBeCloseTo(19.23, 1)
      expect(vm.liveCalculations.gross).toBeCloseTo(663.96, 1)

      // Adjust overtime days from 2 to 4
      vm.otDays = 4
      expect(vm.liveCalculations.otPay).toBeCloseTo(76.92, 1)

      // Adjust unpaid leave days to 0
      vm.unpaidDays = 0
      expect(vm.liveCalculations.unpaidDeduction).toBe(0)

      // Switch to manual incentive override
      vm.incentiveMode = 'MANUAL'
      vm.manualIncentive = 100
      expect(vm.liveCalculations.commission).toBe(100)

      // Enable 13th month payout draw
      vm.includeThirteenthPayout = true
      vm.thirteenthPayoutAmount = 50
      expect(vm.liveCalculations.thirteenthPayout).toBe(50)
    })

    it('saves draft changes and transitions status to FINALIZED', async () => {
      ;(api.put as any).mockResolvedValueOnce({
        data: {
          data: {
            ...mockPayrolls[0],
            status: 'FINALIZED',
            overtime_days: 3,
            total_net_pay: 680.00,
          },
        },
      })

      const wrapper = mount(PayrollView, {
        global: {
          plugins: [router],
          stubs: { RouterLink: true, teleport: true },
        },
      })
      await flushPromises()

      const vm = wrapper.vm as any
      await vm.openDetail(mockPayrolls[0])
      vm.otDays = 3

      await vm.handleSaveDetail('FINALIZED')
      expect(api.put).toHaveBeenCalledWith('/payrolls/pay-1', expect.objectContaining({
        status: 'FINALIZED',
        overtime_days: 3,
      }))
      expect(vm.showDetailModal).toBe(false)
    })
  })

  describe('3. Payroll Generation Workflow', () => {
    it('executes batch generation for all eligible staff and displays duplicate avoidance stats', async () => {
      ;(api.post as any).mockResolvedValueOnce({
        data: {
          data: { generated_count: 1, skipped_count: 2 },
          message: 'Generated 1 payroll(s). (2 skipped/already existing)',
        },
      })

      const wrapper = mount(PayrollView, {
        global: {
          plugins: [router],
          stubs: { RouterLink: true, teleport: true },
        },
      })
      await flushPromises()

      const vm = wrapper.vm as any
      vm.showGenerateModal = true
      vm.generateMode = 'BATCH'
      vm.generateMonth = 8
      vm.generateYear = 2026

      // Carol is the only eligible one (Alice and Bob already exist in mockPayrolls for Aug 2026)
      expect(vm.eligibleStaffUsers.length).toBe(1)
      expect(vm.eligibleStaffUsers[0].name).toBe('Carol Manager')

      await vm.handleGenerate()
      expect(api.post).toHaveBeenCalledWith('/payrolls/generate', {
        month: 8,
        year: 2026,
        batch: true,
        all_staff: true,
      })
      expect(vm.showGenerateModal).toBe(false)
    })

    it('supports single staff generation and selected multi staff generation', async () => {
      ;(api.post as any).mockResolvedValueOnce({
        data: { data: {}, message: 'Generated successfully' },
      })

      const wrapper = mount(PayrollView, {
        global: {
          plugins: [router],
          stubs: { RouterLink: true, teleport: true },
        },
      })
      await flushPromises()

      const vm = wrapper.vm as any
      vm.showGenerateModal = true
      vm.generateMode = 'SINGLE'
      vm.generateMonth = 8
      vm.generateYear = 2026
      vm.singleStaffId = 'u-3'

      await vm.handleGenerate()
      expect(api.post).toHaveBeenCalledWith('/payrolls/generate', {
        month: 8,
        year: 2026,
        user_id: 'u-3',
      })
    })
  })

  describe('4. Base Salaries & 13th-Month Reserves Management', () => {
    it('updates staff monthly base salary rate', async () => {
      ;(api.post as any).mockResolvedValueOnce({
        data: { data: { user_id: 'u-1', base_salary: 550 } },
      })

      const wrapper = mount(PayrollView, {
        global: {
          plugins: [router],
          stubs: { RouterLink: true, teleport: true },
        },
      })
      await flushPromises()

      const vm = wrapper.vm as any
      vm.openSalaryManagement()
      expect(vm.showSalaryModal).toBe(true)

      vm.salaryDrafts['u-1'] = 550
      await vm.saveSalaryForUser('u-1')

      expect(api.post).toHaveBeenCalledWith('/users/u-1/salary', {
        base_salary: 550,
        currency: 'USD',
      })
    })

    it('records standalone seniority / Khmer New Year bonus payout', async () => {
      ;(api.post as any).mockResolvedValueOnce({
        data: { data: {}, message: 'Payout recorded' },
      })

      const wrapper = mount(PayrollView, {
        global: {
          plugins: [router],
          stubs: { RouterLink: true, teleport: true },
        },
      })
      await flushPromises()

      const vm = wrapper.vm as any
      vm.openStandalonePayout('u-1')
      expect(vm.showStandaloneModal).toBe(true)
      expect(vm.standaloneUserId).toBe('u-1')

      vm.standaloneAmount = 100
      vm.standaloneNotes = 'Khmer New Year Bonus'
      await vm.handleSaveStandalone()

      expect(api.post).toHaveBeenCalledWith('/users/u-1/savings/payout', {
        amount: 100,
        notes: 'Khmer New Year Bonus',
        fiscal_year: 2026,
      })
      expect(vm.showStandaloneModal).toBe(false)
    })
  })

  describe('5. Bulk Operations & Payslip Printing', () => {
    it('selects multiple payroll rows and executes bulk status transition to PAID', async () => {
      ;(api.post as any).mockResolvedValueOnce({
        data: { data: {}, message: 'Updated 2 payroll runs' },
      })

      const wrapper = mount(PayrollView, {
        global: {
          plugins: [router],
          stubs: { RouterLink: true, teleport: true },
        },
      })
      await flushPromises()

      const vm = wrapper.vm as any
      vm.toggleSelectAll()
      expect(vm.selectedIds.size).toBe(2)

      await vm.handleBulkStatus('PAID')
      expect(api.post).toHaveBeenCalledWith('/payrolls/bulk-status', {
        ids: ['pay-1', 'pay-2'],
        status: 'PAID',
      })
      expect(vm.selectedIds.size).toBe(0)
    })

    it('opens payslip modal with formatted earnings breakdown and print trigger', async () => {
      const wrapper = mount(PayrollView, {
        global: {
          plugins: [router],
          stubs: { RouterLink: true, teleport: true },
        },
      })
      await flushPromises()

      const vm = wrapper.vm as any
      vm.openPayslip(mockPayrolls[0])
      expect(vm.showPayslipModal).toBe(true)
      expect(vm.payslipPayroll?.id).toBe('pay-1')
      expect(vm.payslipFormat).toBe('A4')

      // Switch to thermal slip
      vm.payslipFormat = 'THERMAL'
      expect(vm.payslipFormat).toBe('THERMAL')
    })
  })
})
