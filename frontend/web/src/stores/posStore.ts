import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface CartItem {
  id: string
  product_id: string
  variant_id?: string
  name: string
  sku: string
  barcode?: string
  price: number
  cost_price?: number
  quantity: number
  discount: number // percentage or fixed amount
  discount_type?: 'none' | 'percentage' | 'flat'
  notes?: string
  image_url?: string | null
  max_stock?: number
  variant_name?: string
}

export type CartLineItem = CartItem

export interface HoldCart {
  id: string
  name: string
  customer?: {
    id?: string | number
    name: string
    phone?: string
    email?: string
    loyalty_tier?: string
    address?: string
  } | null
  items: CartItem[]
  timestamp: number
  notes?: string
  discount_type?: 'none' | 'percentage' | 'flat'
  discount_value?: number
  tax_rate?: number
  delivery_fee?: number
  is_delivery?: boolean
  delivery_address?: string
  delivery_region?: string
  delivery_company_id?: string | null
  delivery_zone_id?: string | null
  channel_id?: string | null
  seller?: {
    id: number
    name: string
    email?: string
    role?: string
  } | null
}

export type HeldOrder = HoldCart

export interface CartTab {
  id: string
  name: string
  items: CartItem[]
  customer?: HoldCart['customer']
  discountType: 'none' | 'percentage' | 'flat'
  discountValue: number
  taxRate: number
  deliveryFee: number
  isDelivery: boolean
  deliveryAddress: string
  deliveryRegion: string
  deliveryCompanyId: string | null
  deliveryZoneId: string | null
  orderNotes: string
}

export interface StaffMember {
  id: number
  name: string
  email: string
  role: string
  department?: string | null
  is_active: boolean
}

const STORAGE_KEY = 'omnipos_pos_cart'

function createDefaultTab(id = 'cart-1', name = 'Cart 1'): CartTab {
  return {
    id,
    name,
    items: [],
    customer: null,
    discountType: 'none',
    discountValue: 0,
    taxRate: 0,
    deliveryFee: 0,
    isDelivery: false,
    deliveryAddress: '',
    deliveryRegion: '',
    deliveryCompanyId: null,
    deliveryZoneId: null,
    orderNotes: '',
  }
}

export const usePosStore = defineStore('pos', () => {
  // Tabs & Active Tab
  const tabs = ref<CartTab[]>([createDefaultTab()])
  const activeTabId = ref<string>('cart-1')

  // Global POS Terminal metadata
  const activeChannelId = ref<string | null>(localStorage.getItem('omnipos_active_channel') || null)
  const activeChannelName = ref<string>('')
  const activeSeller = ref<StaffMember | null>(null)

  // Held Orders (Parked carts)
  const heldOrders = ref<HeldOrder[]>([])

  // Tender / Payment State (per transaction)
  const paymentMethod = ref<'CASH' | 'CARD' | 'QR' | 'SPLIT'>('CASH')
  const tenderedAmount = ref<number>(0)

  // Scanner state
  const scannerBuffer = ref<string>('')
  const isScannerActive = ref<boolean>(false)

  // Active Tab Computed Helper
  const activeTab = computed(() => {
    const found = tabs.value.find((t) => t.id === activeTabId.value)
    if (found) return found
    return tabs.value[0] || createDefaultTab()
  })

  // Cart properties forwarded from active tab
  const items = computed(() => activeTab.value.items)
  const customer = computed(() => activeTab.value.customer)
  const discountType = computed(() => activeTab.value.discountType)
  const discountValue = computed(() => activeTab.value.discountValue)
  const taxRate = computed(() => activeTab.value.taxRate)
  const deliveryFee = computed(() => activeTab.value.deliveryFee)
  const isDelivery = computed(() => activeTab.value.isDelivery)
  const deliveryAddress = computed(() => activeTab.value.deliveryAddress)
  const deliveryRegion = computed(() => activeTab.value.deliveryRegion)
  const deliveryCompanyId = computed(() => activeTab.value.deliveryCompanyId)
  const deliveryZoneId = computed(() => activeTab.value.deliveryZoneId)
  const orderNotes = computed(() => activeTab.value.orderNotes)

  // ==========================================================================
  // Financial Computations
  // ==========================================================================

  const getLineTotal = (item: CartItem): number => {
    const rawTotal = item.price * item.quantity
    if (item.discount_type === 'percentage') {
      return Math.max(0, rawTotal - (rawTotal * item.discount) / 100)
    } else if (item.discount_type === 'flat') {
      return Math.max(0, rawTotal - item.discount)
    } else if (item.discount > 0) {
      // Legacy fallback: percentage if <= 100, else flat
      return Math.max(0, rawTotal - (rawTotal * item.discount) / 100)
    }
    return rawTotal
  }

  const subtotal = computed(() => {
    return activeTab.value.items.reduce((sum, item) => sum + getLineTotal(item), 0)
  })

  const orderDiscountAmount = computed(() => {
    const type = activeTab.value.discountType
    const val = activeTab.value.discountValue
    if (type === 'flat') {
      return Math.min(subtotal.value, Math.max(0, val))
    }
    if (type === 'percentage') {
      return (subtotal.value * Math.min(100, Math.max(0, val))) / 100
    }
    return 0
  })

  const discountedSubtotal = computed(() => {
    return Math.max(0, subtotal.value - orderDiscountAmount.value)
  })

  const taxAmount = computed(() => {
    if (activeTab.value.taxRate <= 0) return 0
    return (discountedSubtotal.value * activeTab.value.taxRate) / 100
  })

  const total = computed(() => {
    const dFee = activeTab.value.isDelivery ? (activeTab.value.deliveryFee || 0) : 0
    return Math.max(0, discountedSubtotal.value + taxAmount.value + dFee)
  })

  const grandTotal = total

  const itemCount = computed(() => {
    return activeTab.value.items.reduce((sum, item) => sum + item.quantity, 0)
  })

  const changeAmount = computed(() => {
    if (paymentMethod.value === 'CASH' && tenderedAmount.value > 0) {
      return Math.max(0, tenderedAmount.value - total.value)
    }
    return 0
  })

  const isCartEmpty = computed(() => activeTab.value.items.length === 0)

  // ==========================================================================
  // Persistence Actions
  // ==========================================================================

  function saveToLocalStorage() {
    try {
      const payload = {
        tabs: tabs.value,
        activeTabId: activeTabId.value,
        heldOrders: heldOrders.value,
        activeChannelId: activeChannelId.value,
        activeChannelName: activeChannelName.value,
        activeSeller: activeSeller.value,
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    } catch (e) {
      console.warn('Failed to persist POS cart state to localStorage', e)
    }
  }

  function loadFromLocalStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed.tabs) && parsed.tabs.length > 0) {
        tabs.value = parsed.tabs
      }
      if (parsed.activeTabId) {
        activeTabId.value = parsed.activeTabId
      }
      if (Array.isArray(parsed.heldOrders)) {
        heldOrders.value = parsed.heldOrders
      }
      if (parsed.activeChannelId) {
        activeChannelId.value = parsed.activeChannelId
      }
      if (parsed.activeChannelName) {
        activeChannelName.value = parsed.activeChannelName
      }
      if (parsed.activeSeller) {
        activeSeller.value = parsed.activeSeller
      }
    } catch (e) {
      console.warn('Failed to parse POS cart state from localStorage', e)
    }
  }

  // ==========================================================================
  // Tab Actions
  // ==========================================================================

  function createTab(name?: string): string {
    const newIndex = tabs.value.length + 1
    const newId = `cart-${Date.now()}`
    const tabName = name || `Cart ${newIndex}`
    tabs.value.push(createDefaultTab(newId, tabName))
    activeTabId.value = newId
    saveToLocalStorage()
    return newId
  }

  function switchTab(tabId: string) {
    if (tabs.value.some((t) => t.id === tabId)) {
      activeTabId.value = tabId
      saveToLocalStorage()
    }
  }

  function closeTab(tabId: string) {
    if (tabs.value.length <= 1) {
      // If only one tab remains, just clear it
      clearCart()
      return
    }
    const idx = tabs.value.findIndex((t) => t.id === tabId)
    if (idx !== -1) {
      tabs.value.splice(idx, 1)
      if (activeTabId.value === tabId) {
        activeTabId.value = tabs.value[Math.max(0, idx - 1)].id
      }
      saveToLocalStorage()
    }
  }

  // ==========================================================================
  // Item & Cart Actions
  // ==========================================================================

  function addToCart(
    product: {
      id: string
      name: string
      selling_price?: number | string | null
      image_url?: string | null
      sku?: string | null
      barcode?: string | null
      variants?: any[]
    },
    variant?: {
      id: string
      sku?: string
      barcode?: string | null
      selling_price?: number | string | null
      cost_price?: number | string | null
      quantity_on_hand?: number
      attribute_values?: any[]
      attributeValues?: any[]
    },
    quantity = 1
  ): CartItem {
    const tab = activeTab.value

    const variantId = variant?.id
    const sku = variant?.sku || product.sku || `${product.id}-DEFAULT`
    const barcode = variant?.barcode || product.barcode || undefined

    const price = typeof variant?.selling_price === 'number'
      ? variant.selling_price
      : typeof product.selling_price === 'number'
        ? product.selling_price
        : parseFloat(String(variant?.selling_price || product.selling_price || 0)) || 0

    const costPrice = typeof variant?.cost_price === 'number'
      ? variant.cost_price
      : parseFloat(String(variant?.cost_price || 0)) || undefined

    const maxStock = variant?.quantity_on_hand !== undefined
      ? variant.quantity_on_hand
      : undefined

    // Build variant display name if attributes exist
    let variantName = ''
    const attrs = variant?.attribute_values || variant?.attributeValues || []
    if (attrs.length > 0) {
      variantName = attrs.map((a: any) => a.value_name || a.name || '').filter(Boolean).join(' / ')
    }

    // Check if matching line item exists (matching product_id and variant_id/sku)
    const existingIndex = tab.items.findIndex(
      (item) => item.product_id === product.id && (variantId ? item.variant_id === variantId : item.sku === sku)
    )

    let resultingItem: CartItem

    if (existingIndex !== -1) {
      const existing = tab.items[existingIndex]
      existing.quantity += quantity
      resultingItem = existing
    } else {
      resultingItem = {
        id: `${product.id}-${variantId || 'base'}-${Date.now()}`,
        product_id: product.id,
        variant_id: variantId,
        name: product.name,
        variant_name: variantName || undefined,
        sku,
        barcode,
        price,
        cost_price: costPrice,
        quantity,
        discount: 0,
        discount_type: 'none',
        image_url: product.image_url,
        max_stock: maxStock,
      }
      tab.items.push(resultingItem)
    }

    saveToLocalStorage()
    return resultingItem
  }

  function updateQuantity(itemId: string, quantity: number) {
    const tab = activeTab.value
    const idx = tab.items.findIndex((i) => i.id === itemId)
    if (idx === -1) return

    if (quantity <= 0) {
      tab.items.splice(idx, 1)
    } else {
      tab.items[idx].quantity = quantity
    }
    saveToLocalStorage()
  }

  function applyLineDiscount(itemId: string, type: 'none' | 'percentage' | 'flat', value: number) {
    const tab = activeTab.value
    const item = tab.items.find((i) => i.id === itemId)
    if (!item) return

    item.discount_type = type
    item.discount = Math.max(0, value)
    saveToLocalStorage()
  }

  function updateLineNote(itemId: string, notes: string) {
    const tab = activeTab.value
    const item = tab.items.find((i) => i.id === itemId)
    if (!item) return

    item.notes = notes
    saveToLocalStorage()
  }

  function removeItem(itemId: string) {
    const tab = activeTab.value
    tab.items = tab.items.filter((i) => i.id !== itemId)
    saveToLocalStorage()
  }

  function clearCart() {
    const tab = activeTab.value
    tab.items = []
    tab.customer = null
    tab.discountType = 'none'
    tab.discountValue = 0
    tab.taxRate = 0
    tab.deliveryFee = 0
    tab.isDelivery = false
    tab.deliveryAddress = ''
    tab.deliveryRegion = ''
    tab.deliveryCompanyId = null
    tab.deliveryZoneId = null
    tab.orderNotes = ''
    saveToLocalStorage()
  }

  // ==========================================================================
  // Customer & Seller Actions
  // ==========================================================================

  function setCustomer(cust: HoldCart['customer']) {
    activeTab.value.customer = cust
    saveToLocalStorage()
  }

  function clearCustomer() {
    activeTab.value.customer = null
    saveToLocalStorage()
  }

  function setSeller(seller: StaffMember | null) {
    activeSeller.value = seller
    saveToLocalStorage()
  }

  function setChannel(channelId: string | null, channelName = '') {
    activeChannelId.value = channelId
    activeChannelName.value = channelName
    if (channelId) {
      localStorage.setItem('omnipos_active_channel', channelId)
    }
    saveToLocalStorage()
  }

  // ==========================================================================
  // Discounts, Taxes, & Delivery
  // ==========================================================================

  function setOrderDiscount(type: 'none' | 'percentage' | 'flat', value: number) {
    activeTab.value.discountType = type
    activeTab.value.discountValue = Math.max(0, value)
    saveToLocalStorage()
  }

  function setTaxRate(rate: number) {
    activeTab.value.taxRate = Math.max(0, rate)
    saveToLocalStorage()
  }

  function setDelivery(options: {
    isDelivery: boolean
    address?: string
    region?: string
    companyId?: string | null
    zoneId?: string | null
    fee?: number
  }) {
    const tab = activeTab.value
    tab.isDelivery = options.isDelivery
    if (options.address !== undefined) tab.deliveryAddress = options.address
    if (options.region !== undefined) tab.deliveryRegion = options.region
    if (options.companyId !== undefined) tab.deliveryCompanyId = options.companyId
    if (options.zoneId !== undefined) tab.deliveryZoneId = options.zoneId
    if (options.fee !== undefined) tab.deliveryFee = options.fee
    saveToLocalStorage()
  }

  function setOrderNotes(notes: string) {
    activeTab.value.orderNotes = notes
    saveToLocalStorage()
  }

  function setPaymentMethod(method: 'CASH' | 'CARD' | 'QR' | 'SPLIT') {
    paymentMethod.value = method
  }

  function setTenderedAmount(amount: number) {
    tenderedAmount.value = Math.max(0, amount)
  }

  // ==========================================================================
  // Hold / Resume / Park Orders
  // ==========================================================================

  function holdCurrentOrder(orderName?: string, notes?: string): HeldOrder | null {
    const tab = activeTab.value
    if (tab.items.length === 0) return null

    const heldId = `hold-${Date.now()}`
    const name = orderName || tab.name || `Order #${heldOrders.value.length + 1}`

    const held: HeldOrder = {
      id: heldId,
      name,
      customer: tab.customer ? { ...tab.customer } : null,
      items: JSON.parse(JSON.stringify(tab.items)),
      timestamp: Date.now(),
      notes: notes || tab.orderNotes,
      discount_type: tab.discountType,
      discount_value: tab.discountValue,
      tax_rate: tab.taxRate,
      delivery_fee: tab.deliveryFee,
      is_delivery: tab.isDelivery,
      delivery_address: tab.deliveryAddress,
      delivery_region: tab.deliveryRegion,
      delivery_company_id: tab.deliveryCompanyId,
      delivery_zone_id: tab.deliveryZoneId,
      channel_id: activeChannelId.value,
      seller: activeSeller.value ? { ...activeSeller.value } : null,
    }

    heldOrders.value.unshift(held)

    // Reset current active tab items
    clearCart()
    saveToLocalStorage()
    return held
  }

  function resumeHeldOrder(heldId: string) {
    const idx = heldOrders.value.findIndex((h) => h.id === heldId)
    if (idx === -1) return

    const held = heldOrders.value[idx]

    // If current tab is not empty, create a new tab or overwrite if empty
    if (activeTab.value.items.length > 0) {
      const newTabId = createTab(held.name || `Resumed Cart`)
      switchTab(newTabId)
    }

    const tab = activeTab.value
    tab.name = held.name || tab.name
    tab.items = JSON.parse(JSON.stringify(held.items))
    tab.customer = held.customer ? { ...held.customer } : null
    tab.discountType = held.discount_type || 'none'
    tab.discountValue = held.discount_value || 0
    tab.taxRate = held.tax_rate || 0
    tab.deliveryFee = held.delivery_fee || 0
    tab.isDelivery = !!held.is_delivery
    tab.deliveryAddress = held.delivery_address || ''
    tab.deliveryRegion = held.delivery_region || ''
    tab.deliveryCompanyId = held.delivery_company_id || null
    tab.deliveryZoneId = held.delivery_zone_id || null
    tab.orderNotes = held.notes || ''

    if (held.seller) {
      activeSeller.value = held.seller as StaffMember
    }

    // Remove from heldOrders
    heldOrders.value.splice(idx, 1)
    saveToLocalStorage()
  }

  function deleteHeldOrder(heldId: string) {
    heldOrders.value = heldOrders.value.filter((h) => h.id !== heldId)
    saveToLocalStorage()
  }

  // ==========================================================================
  // Post-Transaction Reset
  // ==========================================================================

  function resetTransaction() {
    clearCart()
    paymentMethod.value = 'CASH'
    tenderedAmount.value = 0
    saveToLocalStorage()
  }

  // Initialize store from localStorage
  loadFromLocalStorage()

  return {
    // State
    tabs,
    activeTabId,
    activeTab,
    items,
    customer,
    discountType,
    discountValue,
    taxRate,
    deliveryFee,
    isDelivery,
    deliveryAddress,
    deliveryRegion,
    deliveryCompanyId,
    deliveryZoneId,
    orderNotes,
    activeChannelId,
    activeChannelName,
    activeSeller,
    heldOrders,
    paymentMethod,
    tenderedAmount,
    scannerBuffer,
    isScannerActive,

    // Computeds
    subtotal,
    orderDiscountAmount,
    discountedSubtotal,
    taxAmount,
    total,
    grandTotal,
    itemCount,
    changeAmount,
    isCartEmpty,
    getLineTotal,

    // Tab Actions
    createTab,
    switchTab,
    closeTab,

    // Cart Actions
    addToCart,
    updateQuantity,
    applyLineDiscount,
    updateLineNote,
    removeItem,
    clearCart,

    // Entity Actions
    setCustomer,
    clearCustomer,
    setSeller,
    setChannel,
    setOrderDiscount,
    setTaxRate,
    setDelivery,
    setOrderNotes,
    setPaymentMethod,
    setTenderedAmount,

    // Hold Orders
    holdCurrentOrder,
    resumeHeldOrder,
    deleteHeldOrder,

    // Lifecycle / Storage
    resetTransaction,
    saveToLocalStorage,
    loadFromLocalStorage,
  }
})
