import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import api from '@/api/axios'

// Stores
import { usePosStore, type StaffMember } from '@/stores/posStore'
import { useAuthStore } from '@/stores/authStore'

// Components
import SellerPickerModal from '@/components/pos/SellerPickerModal.vue'
import PosCheckoutModal from '@/components/pos/PosCheckoutModal.vue'
import PosVariantModal from '@/components/pos/PosVariantModal.vue'
import DeliveryZonePickerModal from '@/components/pos/DeliveryZonePickerModal.vue'
import PosReceiptModal from '@/components/pos/PosReceiptModal.vue'
import AppHeader from '@/components/shell/AppHeader.vue'
import SellerDailySummaryModal from '@/components/seller/SellerDailySummaryModal.vue'
import SalesChannelsView from '@/views/SalesChannelsView.vue'
import router from '@/router'

// Mock Axios
vi.mock('@/api/axios', () => {
  const mockApi = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
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

describe('POS Seller Attribution & Daily Shift Settlement Flow', () => {
  const mockCurrentUser = {
    id: 'user-cashier-1',
    name: 'Alice Cashier',
    email: 'alice@inventory.local',
    role: 'SELLER' as const,
    department: 'Front Counter',
  }

  const mockStaffList: StaffMember[] = [
    { id: 'user-cashier-1', name: 'Alice Cashier', role: 'SELLER', department: 'Front Counter', is_active: true },
    { id: 'user-rep-2', name: 'Bob Salesrep', role: 'SELLER', department: 'Outside Sales', is_active: true },
    { id: 'user-manager-3', name: 'Carol Manager', role: 'MANAGER', department: 'Store Operations', is_active: true },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    const pinia = createPinia()
    setActivePinia(pinia)

    const authStore = useAuthStore()
    authStore.user = { ...mockCurrentUser }
    authStore.token = 'mock-jwt-token'
  })

  describe('1. POS Store Seller Management', () => {
    it('sets and updates active seller', () => {
      const posStore = usePosStore()
      expect(posStore.activeSeller).toBeNull()

      posStore.setSeller(mockStaffList[0])
      expect(posStore.activeSeller?.name).toBe('Alice Cashier')
      expect(posStore.activeSeller?.id).toBe('user-cashier-1')

      // Switch seller to colleague on behalf
      posStore.setSeller(mockStaffList[1])
      expect(posStore.activeSeller?.name).toBe('Bob Salesrep')
      expect(posStore.activeSeller?.id).toBe('user-rep-2')
    })

    it('preserves active seller when parking (holding) and resuming orders', () => {
      const posStore = usePosStore()
      posStore.setSeller(mockStaffList[1]) // Bob

      posStore.addToCart({
        id: 'p-1',
        name: 'Item 1',
        selling_price: 25,
      })

      const held = posStore.holdCurrentOrder('Held for Bob')
      expect(held).toBeTruthy()
      expect(held?.seller?.id).toBe('user-rep-2')
      expect(held?.seller?.name).toBe('Bob Salesrep')

      // Reset seller to Alice
      posStore.setSeller(mockStaffList[0])
      expect(posStore.activeSeller?.id).toBe('user-cashier-1')

      // Resume held order
      posStore.resumeHeldOrder(held!.id)
      expect(posStore.activeSeller?.id).toBe('user-rep-2')
      expect(posStore.activeSeller?.name).toBe('Bob Salesrep')
    })

    it('enforces max_stock limits in addToCart and updateQuantity', () => {
      const posStore = usePosStore()
      const product = {
        id: 'p-stock-1',
        name: 'Limited Edition Mug',
        selling_price: 15,
        variants: [{ id: 'v-1', sku: 'MUG-RED', quantity_on_hand: 3 }],
      }

      // Add 2 items (allowed, 3 in stock)
      const item1 = posStore.addToCart(product, product.variants[0], 2)
      expect(item1.quantity).toBe(2)
      expect(item1.max_stock).toBe(3)

      // Add 2 more (total 4 > 3, should cap at 3)
      const item2 = posStore.addToCart(product, product.variants[0], 2)
      expect(item2.quantity).toBe(3)

      // updateQuantity beyond max_stock returns false and clamps
      const ok = posStore.updateQuantity(item2.id, 10)
      expect(ok).toBe(false)
      expect(posStore.items[0].quantity).toBe(3)
    })
  })

  describe('2. SellerPickerModal Component', () => {
    it('renders staff list, indicates current user with Me badge, and handles selection', async () => {
      const wrapper = mount(SellerPickerModal, {
        props: {
          open: true,
          staffMembers: mockStaffList,
          selectedId: 'user-cashier-1',
          currentUserId: 'user-cashier-1',
        },
      })

      expect(wrapper.text()).toContain('Assign Sales Representative')
      expect(wrapper.text()).toContain('Alice Cashier')
      expect(wrapper.text()).toContain('Me')
      expect(wrapper.text()).toContain('Bob Salesrep')

      // Filter search
      const searchInput = wrapper.find('input[type="text"]')
      await searchInput.setValue('Bob')

      expect(wrapper.text()).toContain('Bob Salesrep')
      expect(wrapper.text()).not.toContain('Alice Cashier')

      // Click Bob to select
      const bobButton = wrapper.findAll('button').find((b) => b.text().includes('Bob Salesrep'))
      expect(bobButton).toBeTruthy()
      await bobButton!.trigger('click')

      expect(wrapper.emitted('select')).toBeTruthy()
      expect(wrapper.emitted('select')![0][0]).toEqual(mockStaffList[1])
    })

    it('shows Reset to Me banner when another seller is selected and resets', async () => {
      const wrapper = mount(SellerPickerModal, {
        props: {
          open: true,
          staffMembers: mockStaffList,
          selectedId: 'user-rep-2', // Bob is selected
          currentUserId: 'user-cashier-1', // Logged in as Alice
        },
      })

      expect(wrapper.text()).toContain('Reset to Me (Alice Cashier)')

      const resetBanner = wrapper.findAll('button').find((b) => b.text().includes('Reset to Me'))
      expect(resetBanner).toBeTruthy()
      await resetBanner!.trigger('click')

      expect(wrapper.emitted('select')).toBeTruthy()
      expect(wrapper.emitted('select')![0][0]).toEqual(mockStaffList[0])
    })
  })

  describe('3. PosCheckoutModal Sales Channel & Stock Awareness', () => {
    const mockChannels = [
      { id: 'chan-pos', name: 'Retail Counter POS', platform: 'pos', is_active: true, is_default: true },
      { id: 'chan-tiktok', name: 'TikTok Live Stream', platform: 'tiktok', is_active: true, is_default: false },
      { id: 'chan-web', name: 'Online Webstore', platform: 'web', is_active: true, is_default: false },
    ]

    it('displays Sales Channels selector and emits update:channel-id when clicked', async () => {
      const wrapper = mount(PosCheckoutModal, {
        props: {
          open: true,
          subtotal: 100,
          total: 100,
          channels: mockChannels,
          selectedChannelId: 'chan-pos',
        },
      })

      expect(wrapper.text()).toContain('Sales Channel')
      expect(wrapper.text()).toContain('Retail Counter POS')
      expect(wrapper.text()).toContain('TikTok Live Stream')
      expect(wrapper.text()).toContain('Online Webstore')

      // Click TikTok Live channel
      const tiktokBtn = wrapper.findAll('button').find((b) => b.text().includes('TikTok Live Stream'))
      expect(tiktokBtn).toBeTruthy()
      await tiktokBtn!.trigger('click')

      expect(wrapper.emitted('update:channel-id')).toBeTruthy()
      expect(wrapper.emitted('update:channel-id')![0][0]).toBe('chan-tiktok')
    })

    it('renders sales channels cleanly with icons and names', () => {
      const sameNameChannels = [
        { id: 'c-fb', name: 'KC Main Stream', platform: 'facebook', code: 'FB-01', is_active: true, is_default: true },
        { id: 'c-tt', name: 'KC TikTok Stream', platform: 'tiktok', code: 'TT-01', is_active: true, is_default: false },
        { id: 'c-tg', name: 'KC Telegram Chat', platform: 'telegram', code: 'TG-01', is_active: true, is_default: false },
      ]

      const wrapper = mount(PosCheckoutModal, {
        props: {
          open: true,
          subtotal: 50,
          total: 50,
          channels: sameNameChannels,
          selectedChannelId: 'c-tt',
        },
      })

      expect(wrapper.text()).toContain('KC Main Stream')
      expect(wrapper.text()).toContain('KC TikTok Stream')
      expect(wrapper.text()).toContain('KC Telegram Chat')
    })

    it('verifies top bar AppHeader does not render sales channel dropdown', () => {
      const wrapper = mount(AppHeader, {
        global: {
          plugins: [router],
        },
      })
      expect(wrapper.find('.header-channel-wrapper').exists()).toBe(false)
      expect(wrapper.find('.header-channel-btn').exists()).toBe(false)
    })

    it('validates sales channel form: auto-generates code and prevents duplicate name on the same platform', async () => {
      const mockChannels = [
        { id: '1', name: 'Main Shop', platform: 'facebook', code: 'FB-MAIN', is_active: true, is_default: false },
        { id: '2', name: 'Main Shop', platform: 'tiktok', code: 'TT-MAIN', is_active: true, is_default: false },
      ]

      ;(api.get as any).mockImplementation((url: string) => {
        if (url === '/sales-channels') {
          return Promise.resolve({ data: { data: mockChannels } })
        }
        return Promise.resolve({ data: { data: [] } })
      })

      const wrapper = mount(SalesChannelsView, {
        attachTo: document.body,
        global: {
          plugins: [router],
          stubs: { RouterLink: true },
        },
      })
      await flushPromises()

      const vm = wrapper.vm as any
      vm.openCreateModal()
      expect(vm.formVisible).toBe(true)

      // Test 1: Code auto-generation from name & platform
      vm.form.platform = 'facebook'
      vm.form.name = 'Live Event #1'
      vm.onNameOrPlatformInput()
      expect(vm.form.code).toBe('FB-LIVE-EVENT-1')

      // Test 2: Platform change updates code
      vm.form.platform = 'tiktok'
      vm.onNameOrPlatformInput()
      expect(vm.form.code).toBe('TT-LIVE-EVENT-1')

      // Test 3: Creating same name on different platform is permitted
      vm.form.platform = 'telegram'
      vm.form.name = 'Main Shop'
      vm.formError = ''
      ;(api.post as any).mockResolvedValueOnce({ data: { data: { id: '3', name: 'Main Shop', platform: 'telegram', code: 'TG-MAIN' } } })
      await vm.handleSubmit()
      expect(vm.formError).toBe('')

      // Test 4: Creating same name on the SAME platform is blocked with clear error
      vm.openCreateModal()
      vm.form.platform = 'facebook'
      vm.form.name = 'Main Shop' // already exists on facebook
      await vm.handleSubmit()
      expect(vm.formError).toContain('already exists on the Facebook platform')
    })

    it('displays overstock warning banner and blocks charge action if cart item exceeds inventory', () => {
      const overstockedCartItems = [
        {
          id: 'item-1',
          product_id: 'p-1',
          name: 'Designer Shoes',
          sku: 'SHOE-42',
          price: 120,
          quantity: 5,
          max_stock: 2, // 5 in cart, only 2 available
          discount: 0,
        },
      ]

      const wrapper = mount(PosCheckoutModal, {
        props: {
          open: true,
          subtotal: 600,
          total: 600,
          channels: mockChannels,
          cartItems: overstockedCartItems,
        },
      })

      expect(wrapper.text()).toContain('Stock Limit Exceeded')
      expect(wrapper.text()).toContain('Designer Shoes')
      expect(wrapper.text()).toContain('5 in cart, only 2 in stock')

      // Charge button is disabled
      const chargeBtn = wrapper.findAll('button').find((b) => b.text().includes('Charge'))
      expect(chargeBtn?.attributes('disabled')).toBeDefined()
    })

    it('displays seller attribution with Direct and On-Behalf states', async () => {
      // Direct
      const directWrapper = mount(PosCheckoutModal, {
        props: {
          open: true,
          subtotal: 100,
          total: 100,
          activeSeller: mockStaffList[0],
          isSellingOnBehalf: false,
        },
      })
      expect(directWrapper.text()).toContain('Direct')
      expect(directWrapper.text()).toContain('Alice Cashier')

      // On behalf
      const onBehalfWrapper = mount(PosCheckoutModal, {
        props: {
          open: true,
          subtotal: 100,
          total: 100,
          activeSeller: mockStaffList[1],
          isSellingOnBehalf: true,
        },
      })
      expect(onBehalfWrapper.text()).toContain('On Behalf')
      expect(onBehalfWrapper.text()).toContain('Bob Salesrep')
      expect(onBehalfWrapper.text()).toContain('Reset to Me')
    })
  })

  describe('4. PosVariantModal Stock & Cart Awareness', () => {
    it('calculates remaining stock considering items already in cart and disables Add when depleted', async () => {
      const product = {
        id: 'prod-tshirt',
        name: 'Cotton T-Shirt',
        variants: [
          { id: 'v-small', sku: 'TS-S', quantity_on_hand: 4, selling_price: 20 },
          { id: 'v-med', sku: 'TS-M', quantity_on_hand: 2, selling_price: 20 },
        ],
      }

      const cartItems = [
        { product_id: 'prod-tshirt', variant_id: 'v-med', sku: 'TS-M', quantity: 2, id: 'c-1', name: 'Cotton T-Shirt', price: 20, discount: 0 },
      ]

      const wrapper = mount(PosVariantModal, {
        props: {
          open: true,
          product,
          cartItems,
        },
      })

      expect(wrapper.text()).toContain('Cotton T-Shirt')
      // Small has 4 in stock (0 in cart -> 4 left)
      expect(wrapper.text()).toContain('4 left')
      // Medium has 2 in stock (2 in cart -> max in cart)
      expect(wrapper.text()).toContain('Max in cart (2/2)')

      // Medium Add button should be disabled
      const medRow = wrapper.findAll('.group').find((r) => r.text().includes('TS-M'))
      const medAddBtn = medRow?.findAll('button').find((b) => b.text().includes('Add'))
      expect(medAddBtn?.attributes('disabled')).toBeDefined()
    })
  })

  describe('5. DeliveryZonePickerModal Custom Rate Selection', () => {
    const mockZones = [
      { id: 'z-pp', name: 'Phnom Penh', cost: 1.5, estimated_days: '1-2', is_active: true },
      { id: 'z-prov', name: 'Provinces', cost: 2.0, estimated_days: '2-3', is_active: true },
    ]

    it('renders standard zones along with Custom / Negotiated Rate option', () => {
      const wrapper = mount(DeliveryZonePickerModal, {
        attachTo: document.body,
        props: {
          open: true,
          zones: mockZones,
        },
      })

      expect(document.body.textContent).toContain('Select Delivery Zone')
      expect(document.body.textContent).toContain('Phnom Penh')
      expect(document.body.textContent).toContain('$1.50')
      expect(document.body.textContent).toContain('Provinces')
      expect(document.body.textContent).toContain('$2.00')
      expect(document.body.textContent).toContain('Custom / Negotiated Rate')
      expect(document.body.textContent).toContain('Manual negotiated price')

      wrapper.unmount()
    })

    it('selects Custom option, accepts custom fee input, and emits applied rate', async () => {
      const wrapper = mount(DeliveryZonePickerModal, {
        attachTo: document.body,
        props: {
          open: true,
          zones: mockZones,
          selectedId: 'z-pp',
        },
      })

      const vm = wrapper.vm as any
      // Select Custom
      vm.handleSelectZone({ id: 'custom', name: 'Custom / Negotiated Rate', cost: 0 })
      await flushPromises()

      expect(vm.selectedZoneId).toBe('custom')

      // Set custom fee
      vm.setPresetFee(4.5)
      expect(vm.customFee).toBe(4.5)

      // Apply
      vm.handleApply()
      await flushPromises()

      expect(wrapper.emitted('select')).toBeTruthy()
      const emittedArgs = wrapper.emitted('select')![0]
      expect(emittedArgs[0]).toMatchObject({
        id: 'custom',
        name: 'Custom / Negotiated Rate',
      })
      expect(emittedArgs[1]).toBe(4.5)

      wrapper.unmount()
    })

    it('supports Free ($0) preset button for quick shipping waiver', async () => {
      const wrapper = mount(DeliveryZonePickerModal, {
        attachTo: document.body,
        props: {
          open: true,
          zones: mockZones,
          selectedId: 'z-prov',
          initialCost: 2.0,
        },
      })

      const vm = wrapper.vm as any
      vm.setPresetFee(0)
      vm.handleApply()
      await flushPromises()

      expect(wrapper.emitted('select')![0][1]).toBe(0)

      wrapper.unmount()
    })
  })

  describe('6. PosReceiptModal Mobile Parity & Dynamic Layout', () => {
    const mockOrder = {
      id: 'ord-rec-99',
      order_number: 'ORD-2026-9901',
      channel_name: 'TikTok Live Stream',
      channel_platform: 'tiktok',
      created_at: '2026-09-01T10:41:00Z',
      items: [
        {
          id: 'item-1',
          product_name: 'Summer Linen Shirt',
          sku: 'SHIRT-L-BLUE',
          quantity: 2,
          unit_price: 35.0,
          total_price: 70.0,
          discount: 10,
        },
      ],
      subtotal: 70.0,
      discount: 7.0,
      delivery_fee: 3.5,
      delivery_company: 'Grab Express',
      delivery_address: 'Street 2004, Sen Sok, Phnom Penh',
      tax_amount: 3.32,
      tax_rate: 5,
      total_amount: 69.82,
      payment_method: 'ABA QR',
      tendered_amount: 69.82,
      customer_info: {
        name: 'John Customer',
        phone: '+85512998877',
        loyalty_tier: 'VIP Gold',
      },
      seller: {
        name: 'Bob Salesrep',
        role: 'SELLER',
      },
      cashier: {
        name: 'Alice Cashier',
        role: 'SELLER',
      },
    }

    it('renders mobile-parity receipt with Channel badge, Sold By, Customer Bill To, and Grand Total box', () => {
      const wrapper = mount(PosReceiptModal, {
        props: {
          open: true,
          order: mockOrder,
          storeName: 'KC Shop',
        },
      })

      // Brand & header
      expect(wrapper.text()).toContain('KC Shop')
      expect(wrapper.text()).toContain('Official Digital Tax Receipt')

      // Metadata & Omnichannel badge
      expect(wrapper.text()).toContain('TikTok Live Stream')
      expect(wrapper.text()).toContain('ORD-2026-9901')
      expect(wrapper.text()).toContain('Bob Salesrep')
      expect(wrapper.text()).toContain('Alice Cashier')

      // Bill To customer & delivery fulfillment badge
      expect(wrapper.text()).toContain('Bill To')
      expect(wrapper.text()).toContain('John Customer')
      expect(wrapper.text()).toContain('VIP Gold')
      expect(wrapper.text()).toContain('+85512998877')
      expect(wrapper.text()).toContain('Grab Express')
      expect(wrapper.text()).toContain('Street 2004, Sen Sok, Phnom Penh')

      // Items
      expect(wrapper.text()).toContain('Summer Linen Shirt')
      expect(wrapper.text()).toContain('SHIRT-L-BLUE')
      expect(wrapper.text()).toContain('2 × $35.00')
      expect(wrapper.text()).toContain('$70.00')

      // Financials & Grand Total Box
      expect(wrapper.text()).toContain('Subtotal:')
      expect(wrapper.text()).toContain('Discount:')
      expect(wrapper.text()).toContain('-$7.00')
      expect(wrapper.text()).toContain('Delivery Fee (Grab Express):')
      expect(wrapper.text()).toContain('+$3.50')
      expect(wrapper.text()).toContain('Total Paid')
      expect(wrapper.text()).toContain('Authorized via ABA QR')
      expect(wrapper.text()).toContain('$69.82')

      // Action buttons
      expect(wrapper.text()).toContain('Print Receipt')
      expect(wrapper.text()).toContain('New Sale')
    })
  })

  describe('7. SellerDailySummaryModal (Daily Shift Close & Reconciliation)', () => {
    const mockSummaryData = {
      seller: { id: 'user-cashier-1', name: 'Alice Cashier', role: 'SELLER' },
      date: '2026-09-01',
      is_today: true,
      total_orders_count: 5,
      direct_orders_count: 3,
      assisted_orders_count: 2,
      total_sales_amount: 540.0,
      total_incentive_amount: 16.2,
      direct_orders: [
        {
          id: 'ord-1',
          order_number: 'ORD-1001',
          status: 'paid',
          total_amount: 150.0,
          incentive: 4.5,
          customer_name: 'John Walkin',
          channel_name: 'POS Main',
          created_at: '2026-09-01T09:30:00Z',
          is_assisted: false,
        },
        {
          id: 'ord-2',
          order_number: 'ORD-1002',
          status: 'paid',
          total_amount: 200.0,
          incentive: 6.0,
          customer_name: 'Mary Jane',
          channel_name: 'POS Main',
          created_at: '2026-09-01T10:15:00Z',
          is_assisted: false,
        },
      ],
      assisted_orders: [
        {
          id: 'ord-3',
          order_number: 'ORD-1003',
          status: 'paid',
          total_amount: 190.0,
          incentive: 5.7,
          customer_name: 'David Colleague',
          channel_name: 'POS Main',
          created_at: '2026-09-01T11:00:00Z',
          is_assisted: true,
          input_by_user: { id: 'user-rep-2', name: 'Bob Salesrep', role: 'Staff' },
        },
      ],
      settlement: null,
      is_confirmed: false,
    }

    it('fetches and displays daily reconciliation KPIs, direct vs assisted breakdown, and assisted operator badge', async () => {
      vi.mocked(api.get).mockImplementation(async (url: string) => {
        if (url === '/seller-settlements/summary') {
          return { data: { data: mockSummaryData } } as any
        }
        if (url === '/staff-members') {
          return { data: { data: mockStaffList } } as any
        }
        return { data: [] } as any
      })

      const wrapper = mount(SellerDailySummaryModal, {
        props: {
          open: true,
          targetSellerId: 'user-cashier-1',
          initialDate: '2026-09-01',
        },
      })

      await flushPromises()

      expect(wrapper.text()).toContain('Daily Shift Settlement')
      expect(wrapper.text()).toContain('$540.00') // Total Shift Sales
      expect(wrapper.text()).toContain('+$16.20') // Est. Incentive
      expect(wrapper.text()).toContain('Direct Register Orders')
      expect(wrapper.text()).toContain('Input by Team on Behalf')
      expect(wrapper.text()).toContain('ORD-1001')
      expect(wrapper.text()).toContain('ORD-1003')
      expect(wrapper.text()).toContain('Input by Bob Salesrep') // Operator badge
    })

    it('opens confirmation prompt and executes shift sign-off', async () => {
      vi.mocked(api.get).mockImplementation(async (url: string) => {
        if (url === '/seller-settlements/summary') {
          return { data: { data: mockSummaryData } } as any
        }
        return { data: [] } as any
      })
      vi.mocked(api.post).mockResolvedValue({ data: { success: true } } as any)

      const wrapper = mount(SellerDailySummaryModal, {
        props: {
          open: true,
          targetSellerId: 'user-cashier-1',
          initialDate: '2026-09-01',
        },
      })

      await flushPromises()

      const confirmBtn = wrapper.findAll('button').find((b) => b.text().includes("Confirm & Sign Off Today's Sales"))
      expect(confirmBtn).toBeTruthy()
      await confirmBtn!.trigger('click')

      // Prompt dialog opens
      expect(wrapper.text()).toContain("Confirm Today's Sales Sign-Off")

      // Click Confirm & Sign Off inside dialog
      const finalBtn = wrapper.findAll('button').find((b) => b.text() === 'Confirm & Sign Off')
      expect(finalBtn).toBeTruthy()
      await finalBtn!.trigger('click')

      await flushPromises()

      expect(api.post).toHaveBeenCalledWith('/seller-settlements/confirm', expect.objectContaining({
        seller_id: 'user-cashier-1',
        confirmed_date: '2026-09-01',
      }))
    })

    it('disables sign-off button if staff member has 0 sales', async () => {
      const emptySummary = {
        ...mockSummaryData,
        total_orders_count: 0,
        total_sales_amount: 0,
        direct_orders: [],
        assisted_orders: [],
      }

      vi.mocked(api.get).mockResolvedValue({ data: { data: emptySummary } } as any)

      const wrapper = mount(SellerDailySummaryModal, {
        props: {
          open: true,
          targetSellerId: 'user-cashier-1',
          initialDate: '2026-09-01',
        },
      })

      await flushPromises()

      expect(wrapper.text()).toContain('No Sales to Sign Off')
      const disabledBtn = wrapper.findAll('button').find((b) => b.text().includes('No Sales to Sign Off'))
      expect(disabledBtn?.attributes('disabled')).toBeDefined()
    })
  })
})
