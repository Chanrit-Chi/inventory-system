import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import api from '@/api/axios'
import { calculateLoyalty, getTier, getTierDetails } from '@/utils/loyalty'
import { useCustomerLookup } from '@/composables/useCustomerLookup'
import CustomerLookupRow from '@/components/pos/CustomerLookupRow.vue'
import PosCheckoutModal from '@/components/pos/PosCheckoutModal.vue'

describe('Customer Lookup & Loyalty Parity Module', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    setActivePinia(createPinia())
  })

  describe('1. Dual-Criteria Loyalty Calculation (Mobile Parity)', () => {
    it('calculates Platinum tier for high spent (>= 1000) OR high orders (>= 20)', () => {
      // High spent, low orders
      expect(getTier(1000, 1)).toBe('PLATINUM')
      expect(getTier(1500, 0)).toBe('PLATINUM')

      // Low spent, high orders (frequency regular)
      expect(getTier(300, 20)).toBe('PLATINUM')
      expect(getTier(50, 25)).toBe('PLATINUM')

      const loyalty = calculateLoyalty({ total_spent: 1250.5, total_purchased: 5 })
      expect(loyalty.tier).toBe('Platinum')
      expect(loyalty.points).toBe(1250)
      expect(loyalty.totalSpent).toBe(1250.5)
      expect(loyalty.totalPurchased).toBe(5)
    })

    it('calculates Gold tier for spent >= 500 OR orders >= 10', () => {
      expect(getTier(500, 2)).toBe('GOLD')
      expect(getTier(250, 10)).toBe('GOLD')
      expect(getTier(800, 9)).toBe('GOLD')

      const loyalty = calculateLoyalty({ total_spent: 600, total_purchased: 12 })
      expect(loyalty.tier).toBe('Gold')
      expect(loyalty.points).toBe(600)
    })

    it('calculates Silver tier for spent >= 200 OR orders >= 3', () => {
      expect(getTier(200, 1)).toBe('SILVER')
      expect(getTier(150, 3)).toBe('SILVER')
      expect(getTier(499, 2)).toBe('SILVER')

      const loyalty = calculateLoyalty({ total_spent: 220, total_purchased: 4 })
      expect(loyalty.tier).toBe('Silver')
    })

    it('calculates Bronze tier for customers below Silver thresholds', () => {
      expect(getTier(100, 1)).toBe('BRONZE')
      expect(getTier(199, 2)).toBe('BRONZE')
      expect(getTier(0, 0)).toBe('BRONZE')

      const loyalty = calculateLoyalty({ total_spent: 50, total_purchased: 1 })
      expect(loyalty.tier).toBe('Bronze')
    })

    it('provides styled tier details with badge classes and icons', () => {
      const plat = getTierDetails('Platinum')
      expect(plat.tier).toBe('Platinum')
      expect(plat.icon).toBe('diamond')
      expect(plat.label).toBe('Platinum Tier')

      const gold = getTierDetails('GOLD')
      expect(gold.tier).toBe('Gold')
      expect(gold.icon).toBe('ribbon')

      const silver = getTierDetails('silver')
      expect(silver.tier).toBe('Silver')
      expect(silver.icon).toBe('medal')

      const bronze = getTierDetails('Bronze')
      expect(bronze.tier).toBe('Bronze')
      expect(bronze.icon).toBe('star')
    })
  })

  describe('2. useCustomerLookup Composable', () => {
    it('performs debounced search and sets suggestions', async () => {
      const mockCustomers = [
        { id: 'c-1', name: 'Alice Smith', phone: '012111222', total_spent: 1200, total_purchased: 15 },
        { id: 'c-2', name: 'Alice Wonder', phone: '012111333', total_spent: 300, total_purchased: 4 },
      ]

      const getSpy = vi.spyOn(api, 'get').mockResolvedValueOnce({
        data: { data: mockCustomers },
      } as any)

      const lookup = useCustomerLookup({ debounceMs: 50 })

      lookup.handleSetPhone('012111')
      expect(lookup.status.value).toBe('idle')

      // Wait for debounce timer to fire
      await new Promise((r) => setTimeout(r, 80))
      await flushPromises()

      expect(getSpy).toHaveBeenCalledWith('/customers', expect.objectContaining({
        params: expect.objectContaining({ search: '012111' }),
      }))
      expect(lookup.suggestions.value).toHaveLength(2)
      expect(lookup.status.value).toBe('found')
    })

    it('selects a customer and populates loyaltyInfo', () => {
      const lookup = useCustomerLookup()
      const customer = {
        id: 'c-99',
        name: 'David Gold',
        phone: '0987654321',
        total_spent: 750,
        total_purchased: 12,
        delivery_address: '456 Monivong Blvd',
      }

      lookup.selectCustomer(customer)

      expect(lookup.matchedCustomer.value).toBeTruthy()
      expect(lookup.matchedCustomer.value?.name).toBe('David Gold')
      expect(lookup.phone.value).toBe('0987654321')
      expect(lookup.loyaltyInfo.value?.tier).toBe('Gold')
      expect(lookup.loyaltyInfo.value?.points).toBe(750)
      expect(lookup.suggestions.value).toHaveLength(0)
    })

    it('resets customer selection on resetCustomer', () => {
      const lookup = useCustomerLookup()
      lookup.selectCustomer({ id: 'c-1', name: 'Bob', phone: '0123' })
      expect(lookup.matchedCustomer.value).toBeTruthy()

      lookup.resetCustomer()
      expect(lookup.matchedCustomer.value).toBeNull()
      expect(lookup.phone.value).toBe('')
      expect(lookup.name.value).toBe('')
      expect(lookup.loyaltyInfo.value).toBeNull()
    })
  })

  describe('3. CustomerLookupRow.vue Component', () => {
    it('renders input fields with test IDs and handles input events', async () => {
      const wrapper = mount(CustomerLookupRow, {
        props: {
          phone: '012345',
          name: 'Jane',
          matchedCustomer: null,
          suggestions: [],
          status: 'idle',
        },
      })

      const phoneInput = wrapper.find('[data-testid="input-customer-phone"]')
      const nameInput = wrapper.find('[data-testid="input-customer-name"]')

      expect(phoneInput.exists()).toBe(true)
      expect(nameInput.exists()).toBe(true)

      await phoneInput.setValue('012999')
      expect(wrapper.emitted('update:phone')?.[0]).toEqual(['012999'])

      await nameInput.setValue('Jane Doe')
      expect(wrapper.emitted('update:name')?.[0]).toEqual(['Jane Doe'])
    })

    it('displays searching spinner when status is searching', () => {
      const wrapper = mount(CustomerLookupRow, {
        props: {
          phone: '012',
          name: '',
          matchedCustomer: null,
          status: 'searching',
        },
      })

      expect(wrapper.text()).toContain('Searching...')
    })

    it('displays + New Member badge when phone >= 3 and no match found', () => {
      const wrapper = mount(CustomerLookupRow, {
        props: {
          phone: '099887766',
          name: 'New Shopper',
          matchedCustomer: null,
          suggestions: [],
          status: 'not_found',
        },
      })

      expect(wrapper.text()).toContain('+ New Member')
    })

    it('displays suggestions dropdown with rich metadata and emits select on click', async () => {
      const suggestions = [
        {
          id: 'c-1',
          name: 'Sokha Chan',
          phone: '012555666',
          total_spent: 1500,
          total_purchased: 22,
          delivery_address: 'Toul Kork, Phnom Penh',
        },
      ]

      const wrapper = mount(CustomerLookupRow, {
        props: {
          phone: '012555',
          name: '',
          matchedCustomer: null,
          suggestions,
          status: 'found',
        },
      })

      expect(wrapper.text()).toContain('Matching Customers (1)')
      expect(wrapper.text()).toContain('Sokha Chan')
      expect(wrapper.text()).toContain('Platinum')
      expect(wrapper.text()).toContain('Spent $1500.00 • 22 orders')
      expect(wrapper.text()).toContain('Toul Kork, Phnom Penh')

      // Click select button
      const selectBtn = wrapper.find('button.group-hover\\:bg-\\[\\#FF8800\\]')
      if (selectBtn.exists()) {
        await selectBtn.trigger('click')
      } else {
        const item = wrapper.find('.cursor-pointer.flex.items-center.justify-between')
        await item.trigger('click')
      }

      expect(wrapper.emitted('select')).toBeTruthy()
      expect(wrapper.emitted('select')?.[0][0]).toEqual(suggestions[0])
    })

    it('renders 3-column Loyalty Metric card when a customer is matched', () => {
      const matchedCustomer = {
        id: 'c-gold',
        name: 'Vannak Lim',
        phone: '011223344',
        total_spent: 850.75,
        total_purchased: 14,
      }

      const loyaltyInfo = calculateLoyalty(matchedCustomer)

      const wrapper = mount(CustomerLookupRow, {
        props: {
          phone: '011223344',
          name: 'Vannak Lim',
          matchedCustomer,
          loyaltyInfo,
          status: 'found',
        },
      })

      // Matched Tier Badge in Header
      expect(wrapper.text()).toContain('Gold Tier')

      // 3-Column Loyalty Card Metrics
      expect(wrapper.text()).toContain('POINTS')
      expect(wrapper.text()).toContain('⭐ 850')
      expect(wrapper.text()).toContain('LIFETIME SPENT')
      expect(wrapper.text()).toContain('$850.75')
      expect(wrapper.text()).toContain('ORDERS')
      expect(wrapper.text()).toContain('14 sales')

      // Change button is displayed
      expect(wrapper.text()).toContain('Change')
    })
  })

  describe('4. PosCheckoutModal Integration with Customer Lookup', () => {
    it('seamlessly integrates CustomerLookupRow, sets matched customer, and populates delivery address', async () => {
      const wrapper = mount(PosCheckoutModal, {
        props: {
          open: true,
          total: 150.00,
          subtotal: 150.00,
          isDelivery: true,
        },
        global: {
          plugins: [createPinia()],
        },
      })
      await flushPromises()

      const vm = wrapper.vm as any

      const mockCustomer = {
        id: 'cust-vip',
        name: 'Evelyn Platinum',
        phone: '017000111',
        total_spent: 2400.00,
        total_purchased: 35,
        delivery_address: 'BKK1, St 51, Villa 12',
        region: 'Chamkarmon',
      }

      vm.selectCustomerSuggestion(mockCustomer)
      await nextTick()

      expect(vm.customerPhoneInput).toBe('017000111')
      expect(vm.customerNameInput).toBe('Evelyn Platinum')
      expect(vm.matchedCustomer).toBeTruthy()
      expect(vm.matchedCustomer.name).toBe('Evelyn Platinum')

      // Verified emissions
      expect(wrapper.emitted('update:customer-phone')!.slice(-1)[0]).toEqual(['017000111'])
      expect(wrapper.emitted('update:customer-name')!.slice(-1)[0]).toEqual(['Evelyn Platinum'])
      expect(wrapper.emitted('update:delivery-address')!.slice(-1)[0]).toEqual(['BKK1, St 51, Villa 12'])
      expect(wrapper.emitted('update:delivery-region')!.slice(-1)[0]).toEqual(['Chamkarmon'])

      // Verify CustomerLookupRow is rendered inside modal
      const lookupRow = wrapper.findComponent(CustomerLookupRow)
      expect(lookupRow.exists()).toBe(true)
      expect(lookupRow.text()).toContain('Platinum Tier')
      expect(lookupRow.text()).toContain('⭐ 2,400')
      expect(lookupRow.text()).toContain('$2400.00')
      expect(lookupRow.text()).toContain('35 sales')
    })
  })
})
