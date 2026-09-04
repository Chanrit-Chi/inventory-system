import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import AdminUsersView from '@/views/AdminUsersView.vue'

vi.mock('@/api/axios', () => {
  const mockApi = {
    get: vi.fn().mockImplementation((url: string) => {
      if (url === '/users') {
        return Promise.resolve({
          data: {
            data: [
              {
                id: 'user-senior',
                name: 'Senior Cashier (Old Staff)',
                email: 'senior@pos.test',
                role: 'CASHIER',
                department: 'Main Counter',
                hire_date: '2025-01-10', // Hired over 1 year ago (> 3 months)
                probation_exempt: false,
                is_on_probation: false,
                seniority_months: 19,
                base_salary: 350,
                is_active: true,
              },
              {
                id: 'user-junior',
                name: 'Junior Cashier (New Staff)',
                email: 'junior@pos.test',
                role: 'CASHIER',
                department: 'Main Counter',
                hire_date: new Date().toISOString().slice(0, 10), // Hired today (< 3 months)
                probation_exempt: false,
                is_on_probation: true,
                seniority_months: 0,
                base_salary: 250,
                is_active: true,
              },
            ],
            meta: { total: 2 },
          },
        })
      }
      return Promise.resolve({ data: { data: [] } })
    }),
    post: vi.fn().mockResolvedValue({ data: { data: {} } }),
    patch: vi.fn().mockResolvedValue({ data: { data: {} } }),
    delete: vi.fn().mockResolvedValue({ data: {} }),
  }
  return {
    default: mockApi,
    ApiError: class ApiError extends Error {},
  }
})

describe('AdminUsersView Probation Logic', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    document.body.innerHTML = ''
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('renders users list correctly', async () => {
    const wrapper = mount(AdminUsersView, {
      global: {
        stubs: {
          SelectField: true,
          DatePicker: true,
          Dialog: true,
          DialogContent: true,
          DialogHeader: true,
          DialogTitle: true,
          DialogFooter: true,
        },
      },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('Senior Cashier (Old Staff)')
    expect(wrapper.text()).toContain('Junior Cashier (New Staff)')
  })

  it('shows Probation Completed banner for staff hired > 3 months ago', async () => {
    const wrapper = mount(AdminUsersView, {
      global: {
        mocks: {
          $router: { push: vi.fn() },
        },
        stubs: {
          SelectField: true,
          DatePicker: true,
        },
      },
    })
    await flushPromises()

    // Find and click the edit button for senior cashier (first edit button)
    const editBtns = wrapper.findAll('button').filter(b => b.text().includes('Edit'))
    expect(editBtns.length).toBeGreaterThan(0)
    await editBtns[0].trigger('click')
    await flushPromises()

    // The modal should show "Probation Completed (Full Benefits Active)"
    expect(document.body.textContent).toContain('Probation Completed')
    expect(document.body.textContent).not.toContain('Waive 3-Month Probation (Grant Full Benefits Immediately)')
  })

  it('shows Waive Probation checkbox for newly hired staff (< 3 months)', async () => {
    const wrapper = mount(AdminUsersView, {
      global: {
        mocks: {
          $router: { push: vi.fn() },
        },
        stubs: {
          SelectField: true,
          DatePicker: true,
        },
      },
    })
    await flushPromises()

    // Find and click the edit button for junior cashier (second edit button)
    const editBtns = wrapper.findAll('button').filter(b => b.text().includes('Edit'))
    expect(editBtns.length).toBeGreaterThan(1)
    await editBtns[1].trigger('click')
    await flushPromises()

    // The modal should show the waiver checkbox
    expect(document.body.textContent).toContain('Waive 3-Month Probation (Grant Full Benefits Immediately)')
  })

  it('renders all staff detail sections on a single screen without tabs', async () => {
    const wrapper = mount(AdminUsersView, {
      global: {
        mocks: {
          $router: { push: vi.fn() },
        },
        stubs: {
          SelectField: true,
          DatePicker: true,
        },
      },
    })
    await flushPromises()

    // Click Details button on the first user
    const detailBtns = wrapper.findAll('button').filter(b => b.text().includes('Details'))
    expect(detailBtns.length).toBeGreaterThan(0)
    await detailBtns[0].trigger('click')
    await flushPromises()

    // Verify all 3 sections are simultaneously visible on the same screen
    expect(document.body.textContent).toContain('Compensation & Benefit Package')
    expect(document.body.textContent).toContain('Employment & Tenure')
    expect(document.body.textContent).toContain('Sales Performance & Activity')

    // Verify tab buttons were removed
    expect(document.body.textContent).not.toContain('Overview & Stats')
    expect(document.body.textContent).not.toContain('Sales Analytics')
    expect(document.body.textContent).not.toContain('Compensation & Raises')
  })

  it('renders human-readable date filters on a single row with whitespace-nowrap in expanded dialog', async () => {
    const wrapper = mount(AdminUsersView, {
      global: {
        mocks: {
          $router: { push: vi.fn() },
        },
        stubs: {
          SelectField: true,
          DatePicker: true,
        },
      },
    })
    await flushPromises()

    const detailBtns = wrapper.findAll('button').filter(b => b.text().includes('Details'))
    await detailBtns[0].trigger('click')
    await flushPromises()

    // Assert human labels are present
    const humanLabels = ['Today', '7 Days', '30 Days', 'This Month', 'This Year']
    for (const label of humanLabels) {
      expect(document.body.textContent).toContain(label)
    }

    // Find date filter buttons and verify whitespace-nowrap and shrink-0
    const filterButtons = Array.from(document.querySelectorAll('button')).filter(b =>
      humanLabels.includes(b.textContent?.trim() || '')
    )
    expect(filterButtons.length).toBe(5)
    for (const btn of filterButtons) {
      expect(btn.className).toContain('whitespace-nowrap')
      expect(btn.className).toContain('shrink-0')
    }
  })
})

