<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import {
  Search,
  X,
  Plus,
  Minus,
  Trash2,
  Tag,
  FileText,
  User,
  ScanBarcode,
  ShoppingBag,
  Clock,
  CheckCircle2,
  Package,
  Layers,
  Ban,
  FileCheck2,
  ArrowRight,
  ArrowLeft,
  Camera,
  CameraOff,
  PauseCircle,
} from 'lucide-vue-next'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/authStore'
import { useDeliveryZoneStore } from '@/stores/deliveryZoneStore'
import { usePosStore, type CartItem, type CartTab, type StaffMember } from '@/stores/posStore'
import { useBrandingStore } from '@/stores/brandingStore'
import { type SalesChannel } from '@/stores/salesChannelStore'
import { useOfflineQueue } from '@/hooks/useOfflineQueue'
import { calculateLoyalty, getTierDetails } from '@/utils/loyalty'
import api from '@/api/axios'

// POS Modals
import PosVariantModal from '@/components/pos/PosVariantModal.vue'
import PosCheckoutModal from '@/components/pos/PosCheckoutModal.vue'
import PosReceiptModal from '@/components/pos/PosReceiptModal.vue'
import PosCustomerModal, { type Customer } from '@/components/pos/PosCustomerModal.vue'
import PosHoldOrdersModal from '@/components/pos/PosHoldOrdersModal.vue'
import PosItemNoteModal from '@/components/pos/PosItemNoteModal.vue'
import SellerPickerModal from '@/components/pos/SellerPickerModal.vue'
import SellerDailySummaryModal from '@/components/seller/SellerDailySummaryModal.vue'
import {
  Button,
  Badge,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Input,
} from '@/components/ui'

// ============================================================================
// Types
// ============================================================================

interface ProductVariant {
  id: string
  product_id?: string
  sku: string
  barcode?: string | null
  selling_price: number | string | null
  cost_price?: number | string | null
  quantity_on_hand: number
  is_active?: boolean
  attribute_values?: Array<{
    id?: string
    value_name?: string
    name?: string
    attribute?: { id?: string; name: string }
  }>
  attributeValues?: Array<{
    id?: string
    value_name?: string
    name?: string
    attribute?: { id?: string; name: string }
  }>
}

interface Product {
  id: string
  name: string
  selling_price?: number | string | null
  image_url?: string | null
  sku?: string | null
  barcode?: string | null
  category?: { id: string; name: string } | null
  variants?: ProductVariant[]
  description?: string | null
}

interface Category {
  id: string
  name: string
  product_count?: number
}

interface OrderResult {
  id: string
  order_number: string
  invoice_number?: string
  channel_name?: string
  channel_platform?: string
  created_at?: string
  subtotal?: number | string
  discount?: number | string
  tax_amount?: number | string
  tax_rate?: number | string
  delivery_fee?: number | string
  delivery_company?: string | null
  delivery_address?: string | null
  total_amount?: number | string
  payment_method?: string
  tendered_amount?: number | string
  change_amount?: number | string
  items?: any[]
  customer_info?: any
  seller?: any
  cashier?: any
}

// ============================================================================
// Stores & Services
// ============================================================================

const authStore = useAuthStore()
const toast = useToast()
const deliveryStore = useDeliveryZoneStore()
const posStore = usePosStore()
const brandingStore = useBrandingStore()

// ============================================================================
// State
// ============================================================================

// Catalog & Filter State
const products = ref<Product[]>([])
const categories = ref<Category[]>([])
const channels = ref<SalesChannel[]>([])
const staffMembers = ref<StaffMember[]>([])
const productsLoading = ref(false)

const searchQuery = ref('')
const selectedCategory = ref('')
const searchInputRef = ref<HTMLInputElement | null>(null)

// Modals State
const showVariantModal = ref(false)
const selectedVariantProduct = ref<Product | null>(null)

const showCheckoutModal = ref(false)
const showScannerInput = ref(false)
const barcodeInput = ref('')
const isMobileCartOpen = ref(false)
const isCameraScannerActive = ref(false)
const cameraVideoRef = ref<HTMLVideoElement | null>(null)
const lastScannedCode = ref('')
const isCameraSupported = computed(() => typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia)

const barcodeInputRef = ref<any>(null)

function focusBarcodeInput() {
  const el = barcodeInputRef.value as any
  if (!el) return
  if (typeof el.focus === 'function') {
    el.focus()
  } else if (el.$el?.querySelector) {
    el.$el.querySelector('input')?.focus()
  }
}

watch(
  () => showScannerInput.value,
  (open) => {
    if (open) {
      barcodeInput.value = ''
      nextTick(() => focusBarcodeInput())
    } else {
      stopCameraScanner()
    }
  }
)

const checkoutLoading = ref(false)

const showReceiptModal = ref(false)
const completedOrder = ref<OrderResult | null>(null)

const showCustomerModal = ref(false)
const showHoldOrdersModal = ref(false)
const showSellerModal = ref(false)
const showShiftSummaryModal = ref(false)
const showClearCartDialog = ref(false)

const showItemNoteModal = ref(false)
const selectedNoteItem = ref<CartItem | null>(null)

// Hardware Barcode Scanner Buffer State
let barcodeKeyBuffer = ''
let lastKeyTimestamp = 0
const isScanningActive = ref(false)

export interface ScannedSessionItem {
  id: string
  code: string
  name: string
  sku: string
  price: number
  time: string
  success: boolean
  error?: string
}

const sessionScans = ref<ScannedSessionItem[]>([])
const scannerErrorMsg = ref('')

function playScanBeep(success = true) {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    if (success) {
      osc.frequency.setValueAtTime(880, ctx.currentTime) // High tone A5 (880Hz)
      gain.gain.setValueAtTime(0.1, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.09)
    } else {
      osc.frequency.setValueAtTime(240, ctx.currentTime) // Low warning tone (240Hz)
      gain.gain.setValueAtTime(0.12, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.15)
    }
  } catch {}
}

// ============================================================================
// Computeds
// ============================================================================

// Category chip list with dynamic item counts
const categoryChips = computed(() => {
  const allCount = products.value.length
  const map: Record<string, number> = {}

  for (const p of products.value) {
    const catName = p.category?.name || 'Uncategorized'
    map[catName] = (map[catName] || 0) + 1
  }

  const chips: Array<{ id: string; name: string; count: number }> = [
    { id: 'all', name: 'All Products', count: allCount },
  ]

  for (const cat of categories.value) {
    chips.push({
      id: cat.id,
      name: cat.name,
      count: map[cat.name] || 0,
    })
  }

  return chips
})

// Filtered products based on search query & selected category
const filteredProducts = computed(() => {
  let result = products.value

  if (selectedCategory.value) {
    result = result.filter((p) => p.category?.name === selectedCategory.value)
  }

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase().trim()
    result = result.filter((p) => {
      const matchName = p.name.toLowerCase().includes(q)
      const matchSku = p.sku?.toLowerCase().includes(q)
      const matchBarcode = p.barcode?.toLowerCase().includes(q)
      const matchVariant = p.variants?.some(
        (v) => v.sku?.toLowerCase().includes(q) || v.barcode?.toLowerCase().includes(q)
      )
      return matchName || matchSku || matchBarcode || matchVariant
    })
  }

  return result
})

// Active channel display
const activeChannel = computed(() => {
  return channels.value.find((c) => c.id === posStore.activeChannelId) || channels.value[0] || null
})

// Active seller display
const isManager = computed(() => {
  if (!authStore.user?.role) return false
  const r = authStore.user.role.toUpperCase().trim()
  return r === 'SUPER_ADMIN' || r === 'SUPERADMIN' || r === 'ADMIN' || r === 'MANAGER'
})

const activeSeller = computed(() => {
  return posStore.activeSeller
})

const isSellingOnBehalf = computed(() => {
  if (!posStore.activeSeller || !authStore.user) return false
  return String(posStore.activeSeller.id) !== String(authStore.user.id)
})

// Cart item count for a specific product
function getProductCartCount(productId: string): number {
  return posStore.items
    .filter((i) => i.product_id === productId)
    .reduce((sum, i) => sum + i.quantity, 0)
}

function getProductStock(product: Product): number {
  if (!product.variants || product.variants.length === 0) return 0
  return product.variants.reduce((sum, v) => sum + (v.quantity_on_hand || 0), 0)
}

function formatMoney(amount: number | string | undefined | null): string {
  if (amount == null) return '$0.00'
  const val = typeof amount === 'string' ? parseFloat(amount) : amount
  return isNaN(val) ? '$0.00' : `$${val.toFixed(2)}`
}

// ============================================================================
// Actions & Handlers
// ============================================================================

function handleCategorySelect(catName: string) {
  selectedCategory.value = catName === 'All Products' || catName === 'all' ? '' : catName
}

function clearSearch() {
  searchQuery.value = ''
  if (searchInputRef.value) {
    searchInputRef.value.focus()
  }
}

function focusSearch() {
  isMobileCartOpen.value = false
  window.scrollTo({ top: 0, behavior: 'smooth' })
  nextTick(() => {
    searchInputRef.value?.focus()
  })
}

function handleOpenScannerPrompt() {
  isMobileCartOpen.value = false
  sessionScans.value = []
  scannerErrorMsg.value = ''
  barcodeInput.value = ''
  showScannerInput.value = true
  nextTick(() => {
    focusBarcodeInput()
  })
}

async function startCameraScanner() {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    toast.error('Camera is not supported on this browser')
    return
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
      audio: false,
    })
    if (cameraVideoRef.value) {
      cameraVideoRef.value.srcObject = stream
      await cameraVideoRef.value.play()
      isCameraScannerActive.value = true
      startBarcodeDetection()
    }
  } catch (err) {
    console.warn('Camera access denied or failed:', err)
    toast.error('Could not access camera. Please allow camera permissions.')
    isCameraScannerActive.value = false
  }
}

function stopCameraScanner() {
  if (cameraVideoRef.value?.srcObject) {
    const stream = cameraVideoRef.value.srcObject as MediaStream
    stream.getTracks().forEach((t) => t.stop())
    cameraVideoRef.value.srcObject = null
  }
  isCameraScannerActive.value = false
}

function toggleCameraScanner() {
  if (isCameraScannerActive.value) {
    stopCameraScanner()
  } else {
    nextTick(() => startCameraScanner())
  }
}

function startBarcodeDetection() {
  if (typeof window === 'undefined' || !('BarcodeDetector' in window)) {
    return
  }
  try {
    const detector = new (window as any).BarcodeDetector({
      formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'qr_code'],
    })
    const scanLoop = async () => {
      if (!isCameraScannerActive.value || !cameraVideoRef.value) return
      try {
        if (cameraVideoRef.value.readyState >= 2) {
          const detected = await detector.detect(cameraVideoRef.value)
          if (detected.length > 0 && detected[0].rawValue) {
            const code = String(detected[0].rawValue).trim()
            if (code && code !== lastScannedCode.value) {
              lastScannedCode.value = code
              await processBarcode(code)
              setTimeout(() => {
                lastScannedCode.value = ''
              }, 2000)
            }
          }
        }
      } catch {}
      if (isCameraScannerActive.value) {
        requestAnimationFrame(scanLoop)
      }
    }
    requestAnimationFrame(scanLoop)
  } catch {}
}

async function handleContinuousScanSubmit() {
  const code = barcodeInput.value.trim()
  if (!code) return

  barcodeInput.value = ''
  await processBarcode(code)

  // Keep input focused continuously for subsequent scans
  nextTick(() => {
    focusBarcodeInput()
  })
}

function handleProductClick(product: Product) {
  const variants = product.variants || []

  if (variants.length > 1) {
    // Open variant selector with in-cart awareness
    selectedVariantProduct.value = product
    showVariantModal.value = true
  } else {
    // Single variant or base product
    const variant = variants[0]
    const currentInCart = getProductCartCount(product.id)
    const stockOnHand = variant?.quantity_on_hand ?? (product.variants?.[0]?.quantity_on_hand ?? null)

    if (stockOnHand !== null && stockOnHand !== undefined) {
      if (stockOnHand <= 0) {
        toast.warning(`Cannot add ${product.name} — out of stock`)
        return
      }
      if (currentInCart >= stockOnHand) {
        toast.warning(`Cannot add more — ${product.name} is at maximum available stock (${stockOnHand} in stock)`)
        return
      }
    }

    posStore.addToCart(product, variant, 1)
    toast.success(`Added ${product.name} to cart`)
  }
}

function handleVariantSelect(product: Product, variant: ProductVariant, qty: number) {
  posStore.addToCart(product, variant, qty)
  toast.success(`Added ${product.name} (${variant.sku}) to cart`)
}

function handleIncrementCartItem(item: CartItem) {
  if (item.max_stock !== undefined && item.max_stock !== null && item.quantity >= item.max_stock) {
    toast.warning(`Cannot add more — ${item.name} is at maximum stock limit (${item.max_stock} available)`)
    return
  }
  const ok = posStore.updateQuantity(item.id, item.quantity + 1)
  if (!ok) {
    toast.warning(`Maximum stock limit (${item.max_stock}) reached for this item`)
  }
}

function handleOpenItemNote(item: CartItem) {
  selectedNoteItem.value = item
  showItemNoteModal.value = true
}

function handleSaveItemNote(
  itemId: string,
  discType: 'none' | 'percentage' | 'flat',
  discVal: number,
  noteText: string
) {
  posStore.applyLineDiscount(itemId, discType, discVal)
  posStore.updateLineNote(itemId, noteText)
  toast.success('Line item updated')
}

function handleOpenCustomerModal() {
  showCustomerModal.value = true
}

function handleCustomerSelect(cust: Customer) {
  posStore.setCustomer(cust)
  toast.success(`Customer ${cust.name} attached`)
}

function handleCustomerClear() {
  posStore.clearCustomer()
  toast.info('Customer detached')
}

function handleOpenSellerPicker() {
  if (!isManager.value) {
    toast.info(`Sales are automatically credited to your account (${authStore.user?.name || 'Seller'}).`)
    return
  }
  showSellerModal.value = true
}

function handleSellerSelect(staff: StaffMember) {
  posStore.setSeller(staff)
  showSellerModal.value = false
  toast.success(`Cashier assigned: ${staff.name}`)
}

function handleHoldActiveCart() {
  if (posStore.items.length === 0) {
    toast.warning('Cart is empty. Nothing to hold.')
    return
  }

  const held = posStore.holdCurrentOrder()
  if (held) {
    toast.success(`Order "${held.name}" placed on hold`)
  }
}

function handleResumeHeldOrder(heldId: string) {
  posStore.resumeHeldOrder(heldId)
  toast.success('Held order resumed')
}

function handleDeleteHeldOrder(heldId: string) {
  posStore.deleteHeldOrder(heldId)
  toast.info('Held order removed')
}

function handleClearActiveCart() {
  if (posStore.items.length === 0) return
  showClearCartDialog.value = true
}

function confirmClearCart() {
  posStore.clearCart()
  showClearCartDialog.value = false
  toast.info('Cart cleared')
}

// Cart Tab Deletion Management
const tabToDelete = ref<CartTab | null>(null)
const showDeleteTabDialog = ref(false)

function promptDeleteCartTab(tab: CartTab) {
  if (posStore.tabs.length <= 1) {
    if (tab.items.length > 0) {
      handleClearActiveCart()
    }
    return
  }

  if (tab.items.length > 0) {
    tabToDelete.value = tab
    showDeleteTabDialog.value = true
  } else {
    posStore.closeTab(tab.id)
    toast.info(`Closed ${tab.name}`)
  }
}

function confirmDeleteCartTab() {
  if (tabToDelete.value) {
    const name = tabToDelete.value.name
    posStore.closeTab(tabToDelete.value.id)
    toast.info(`Deleted ${name}`)
    tabToDelete.value = null
  }
  showDeleteTabDialog.value = false
}

function handleOpenCheckout() {
  if (posStore.items.length === 0) {
    toast.warning('Please add items to cart before proceeding to checkout')
    return
  }
  showCheckoutModal.value = true
}

// Checkout submission to backend with offline queue fallback
async function handleCompleteCheckout() {
  if (posStore.items.length === 0) return

  const channelId = posStore.activeChannelId || activeChannel.value?.id || channels.value[0]?.id
  if (!channelId) {
    toast.error('A sales channel is required to complete checkout.')
    return
  }

  checkoutLoading.value = true

  try {
    const mutationId = crypto.randomUUID()
    const payload = {
      client_mutation_id: mutationId,
      channel_id: channelId,
      seller_id: posStore.activeSeller?.id ?? null,
      customer: posStore.customer
        ? {
            name: posStore.customer.name || null,
            phone: posStore.customer.phone || null,
          }
        : null,
      customer_info: posStore.customer
        ? {
            name: posStore.customer.name || null,
            email: posStore.customer.email || null,
            phone: posStore.customer.phone || null,
            loyalty_tier: posStore.customer.loyalty_tier || null,
          }
        : null,
      is_delivery: posStore.isDelivery,
      delivery_address: posStore.isDelivery ? posStore.deliveryAddress : null,
      delivery_region: posStore.isDelivery ? posStore.deliveryRegion : null,
      region: posStore.isDelivery ? posStore.deliveryRegion : null,
      delivery_company_id: posStore.isDelivery ? posStore.deliveryCompanyId : null,
      delivery_zone_id: posStore.isDelivery ? posStore.deliveryZoneId : null,
      delivery_cost: posStore.isDelivery ? posStore.deliveryFee : 0,
      delivery_fee: posStore.isDelivery ? posStore.deliveryFee : 0,
      items: posStore.items.map((item) => ({
        product_id: item.product_id,
        variant_id: item.variant_id || item.product_id || item.sku,
        sku: item.sku,
        quantity: item.quantity,
        unit_price: item.price,
        discount: item.discount,
        discount_amount: item.discount,
        discount_type: item.discount_type,
        notes: item.notes,
      })),
      subtotal: posStore.subtotal,
      discount: posStore.orderDiscountAmount,
      discount_type: posStore.discountType,
      discount_value: posStore.discountValue,
      tax_type: 'percentage',
      tax_rate: posStore.taxRate,
      tax_amount: posStore.taxAmount,
      total_amount: posStore.total,
      payment_method: posStore.paymentMethod,
      payment_amount: posStore.total,
      tendered_amount: posStore.isCashPayment(posStore.paymentMethod) ? posStore.tenderedAmount : posStore.total,
      note: posStore.orderNotes || null,
      notes: posStore.orderNotes || null,
      status: 'paid',
    }

    // Try API first; if network fails, fall back to offline queue
    let res: any
    try {
      res = await api.post<any>('/orders/checkout', payload)
    } catch (apiError: any) {
      const isNetworkError =
        apiError?.isNetworkError === true ||
        apiError?.status === 0 ||
        apiError?.status === undefined ||
        apiError?.name === 'NetworkError' ||
        (typeof navigator !== 'undefined' && !navigator.onLine)

      if (isNetworkError) {
        // Enqueue mutation for offline retry and notify user
        const { enqueueMutation } = useOfflineQueue()
        enqueueMutation({
          id: mutationId,
          type: 'checkout',
          endpoint: '/orders/checkout',
          payload,
        })
        toast.error('Network unavailable. Sale saved offline — will sync when back online.')
        checkoutLoading.value = false
        return
      } else {
        const errorMsg = apiError?.message || apiError?.response?.data?.message || 'Failed to finalize transaction'
        toast.error(errorMsg)
        checkoutLoading.value = false
        return
      }
    }
    const orderData = res.data?.data || res.data

    if (orderData) {
      const matchedDeliveryCompany = deliveryStore.companies.find((c: any) => c.id === posStore.deliveryCompanyId)
      completedOrder.value = {
        id: orderData.id,
        order_number: orderData.order_number || orderData.invoice_number || `ORD-${Date.now().toString().slice(-6)}`,
        channel_name: activeChannel.value?.name || 'Store POS',
        channel_platform: activeChannel.value?.platform || 'pos',
        created_at: orderData.created_at || new Date().toISOString(),
        items: posStore.items.map((i) => ({
          product_name: i.name,
          variant_name: i.variant_name,
          sku: i.sku,
          quantity: i.quantity,
          unit_price: i.price,
          total_price: posStore.getLineTotal(i),
          discount: i.discount,
        })),
        subtotal: posStore.subtotal,
        discount: posStore.orderDiscountAmount,
        tax_amount: posStore.taxAmount,
        tax_rate: posStore.taxRate,
        delivery_fee: posStore.isDelivery ? posStore.deliveryFee : 0,
        delivery_company: matchedDeliveryCompany?.name || null,
        delivery_address: posStore.isDelivery ? posStore.deliveryAddress : null,
        total_amount: posStore.total,
        payment_method: posStore.paymentMethod,
        tendered_amount: posStore.isCashPayment(posStore.paymentMethod) ? posStore.tenderedAmount : posStore.total,
        change_amount: posStore.changeAmount,
        customer_info: posStore.customer,
        seller: posStore.activeSeller,
        cashier: authStore.user ? { name: authStore.user.name, role: authStore.user.role } : null,
      }

      showCheckoutModal.value = false
      showReceiptModal.value = true

      // Reset cart store
      posStore.resetTransaction()
      toast.success('Sale finalized successfully!')

      // Re-fetch products in background to sync live stock levels
      loadProducts(false)
    }
  } catch (err: any) {
    console.error('Checkout error:', err)
    toast.error(err?.response?.data?.message || 'Failed to finalize transaction')
  } finally {
    checkoutLoading.value = false
  }
}

function handleDeliveryZoneSelect(zoneId: string | null) {
  if (!zoneId) {
    posStore.setDelivery({ isDelivery: posStore.isDelivery, zoneId: null, fee: 0 })
    return
  }
  if (zoneId === 'custom') {
    posStore.setDelivery({
      isDelivery: posStore.isDelivery,
      zoneId: 'custom',
      region: 'Custom / Negotiated',
      fee: posStore.deliveryFee,
    })
    return
  }
  const zone = deliveryStore.zones.find((z: any) => z.id === zoneId)
  const fee = zone ? (parseFloat(String((zone as any).cost ?? (zone as any).fee ?? 0)) || 0) : 0
  const zoneName = zone ? ((zone as any).name || (zone as any).zone_name || '') : ''
  posStore.setDelivery({
    isDelivery: posStore.isDelivery,
    zoneId,
    fee,
    region: zoneName || posStore.deliveryRegion,
  })
}

// ============================================================================
// Hardware Barcode Scanner & Global Hotkeys Listener
// ============================================================================

async function processBarcode(code: string): Promise<boolean> {
  const cleanCode = code.trim()
  if (!cleanCode) return false

  isScanningActive.value = true
  scannerErrorMsg.value = ''
  try {
    const res = await api.get<{ data?: { type: string; product?: any; variant?: any; variants?: any[] } }>(
      `/inventory/scan?code=${encodeURIComponent(cleanCode)}`
    )

    const result = res.data?.data
    if (!result) {
      playScanBeep(false)
      const errorMsg = `Barcode "${cleanCode}" not found in inventory`
      scannerErrorMsg.value = errorMsg
      toast.error(errorMsg)
      sessionScans.value.unshift({
        id: String(Date.now()),
        code: cleanCode,
        name: `Unknown (${cleanCode})`,
        sku: cleanCode,
        price: 0,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        success: false,
        error: 'Not found in catalog',
      })
      return false
    }

    let targetProduct: Product | null = null
    let targetVariant: ProductVariant | undefined

    if (result.type === 'variant' && result.variant) {
      const v = result.variant
      targetProduct = {
        id: v.product?.id || v.product_id,
        name: v.product?.name || 'Product',
        selling_price: v.selling_price,
        sku: v.sku,
        variants: [v],
        category: v.product?.category,
        image_url: v.product?.image_url,
      }
      targetVariant = v
    } else if (result.type === 'product' && result.variants?.length) {
      targetProduct = {
        id: result.product.id,
        name: result.product.name,
        selling_price: result.variants[0].selling_price,
        sku: result.variants[0].sku,
        variants: result.variants,
        category: result.product.category,
        image_url: result.product.image_url,
      }
      targetVariant = result.variants[0]
    }

    if (targetProduct) {
      const stock = targetVariant?.quantity_on_hand ?? (targetProduct.variants?.[0]?.quantity_on_hand ?? null)
      const existingInCart = posStore.items.find(
        (i) => i.product_id === targetProduct!.id && (targetVariant ? i.variant_id === targetVariant.id : i.sku === targetProduct!.sku)
      )

      if (stock !== null && stock !== undefined) {
        if (stock <= 0) {
          playScanBeep(false)
          toast.warning(`Cannot add ${targetProduct.name} — out of stock`)
          return false
        }
        if (existingInCart && existingInCart.quantity >= stock) {
          playScanBeep(false)
          toast.warning(`Cannot add more — ${targetProduct.name} is at maximum stock limit (${stock} in stock)`)
          return false
        }
      }

      posStore.addToCart(targetProduct, targetVariant, 1)
      playScanBeep(true)
      const itemPrice = parseFloat(String(targetVariant?.selling_price || targetProduct.selling_price || 0))
      const displayName = targetProduct.name + (targetVariant?.sku && targetVariant.sku !== targetProduct.sku ? ` (${targetVariant.sku})` : '')
      sessionScans.value.unshift({
        id: String(Date.now()),
        code: cleanCode,
        name: displayName,
        sku: targetVariant?.sku || targetProduct.sku || cleanCode,
        price: itemPrice,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        success: true,
      })
      toast.success(`Scanned: ${displayName}`)
      return true
    } else {
      playScanBeep(false)
      const errorMsg = 'Could not resolve product from barcode'
      scannerErrorMsg.value = errorMsg
      toast.error(errorMsg)
      return false
    }
  } catch {
    playScanBeep(false)
    const errorMsg = 'Barcode lookup failed'
    scannerErrorMsg.value = errorMsg
    toast.error(errorMsg)
    return false
  } finally {
    isScanningActive.value = false
  }
}

function handleGlobalKeydown(e: KeyboardEvent) {
  const now = Date.now()
  const activeEl = document.activeElement as HTMLElement
  const isInputActive = activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA'

  // 1. POS Hotkeys (F1 - F8, Esc)
  if (e.key === 'F1') {
    e.preventDefault()
    searchInputRef.value?.focus()
    return
  }
  if (e.key === 'F2') {
    e.preventDefault()
    showScannerInput.value = true
    return
  }
  if (e.key === 'F3') {
    e.preventDefault()
    showCustomerModal.value = true
    return
  }
  if (e.key === 'F4') {
    e.preventDefault()
    handleHoldActiveCart()
    return
  }
  if (e.key === 'F6') {
    e.preventDefault()
    showHoldOrdersModal.value = true
    return
  }
  if (e.key === 'F8' || ((e.ctrlKey || e.metaKey) && e.key === 'Enter')) {
    e.preventDefault()
    if (!showCheckoutModal.value && !showReceiptModal.value && posStore.items.length > 0) {
      handleOpenCheckout()
    }
    return
  }

  // 2. Hardware Barcode Scanner Buffer (Captures fast stream of keys ending with Enter)
  if (!isInputActive) {
    if (e.key === 'Enter') {
      if (barcodeKeyBuffer.length >= 3) {
        e.preventDefault()
        const scanned = barcodeKeyBuffer
        barcodeKeyBuffer = ''
        processBarcode(scanned)
        return
      }
      barcodeKeyBuffer = ''
    } else if (e.key.length === 1) {
      // If typing speed is < 60ms between characters, it's a hardware scanner
      if (now - lastKeyTimestamp < 60 || barcodeKeyBuffer.length === 0) {
        barcodeKeyBuffer += e.key
      } else {
        barcodeKeyBuffer = e.key
      }
      lastKeyTimestamp = now
    }
  }
}

// ============================================================================
// Data Fetching
// ============================================================================

async function loadProducts(showLoader = true) {
  if (showLoader) productsLoading.value = true

  try {
    const [
      prodRes,
      catRes,
      chanRes,
      staffRes,
      deliveryCompaniesRes,
      deliveryZonesRes,
    ] = await Promise.allSettled([
      api.get<{ data: Product[] }>('/products?per_page=200'),
      api.get<{ data: Category[] }>('/categories'),
      api.get<{ data: SalesChannel[] }>('/sales-channels'),
      api.get<StaffMember[]>('/staff-members'),
      api.get('/delivery-companies'),
      api.get('/delivery-zones'),
    ])

    if (prodRes.status === 'fulfilled') {
      const rawProd = (prodRes.value.data as any)?.data ?? prodRes.value.data ?? []
      products.value = Array.isArray(rawProd) ? rawProd : []
    } else {
      console.error('Failed to fetch products:', prodRes.reason)
      toast.error('Failed to load product catalog')
    }

    if (catRes.status === 'fulfilled') {
      const rawCat = (catRes.value.data as any)?.data ?? catRes.value.data ?? []
      categories.value = Array.isArray(rawCat) ? rawCat : []
    }

    if (chanRes.status === 'fulfilled') {
      const rawChan = (chanRes.value.data as any)?.data ?? chanRes.value.data ?? []
      channels.value = (Array.isArray(rawChan) ? rawChan : []).filter((c: any) => c.is_active)

      // Set default channel if none selected
      if (channels.value.length && !posStore.activeChannelId) {
        const def = channels.value.find((c) => c.is_default) || channels.value[0]
        posStore.setChannel(def.id, def.name)
      }
    }

    if (staffRes.status === 'fulfilled') {
      const rawStaff = (staffRes.value.data as any)?.data ?? staffRes.value.data ?? []
      staffMembers.value = Array.isArray(rawStaff) ? rawStaff : []

      // Sync activeSeller with authStore.user:
      if (authStore.user) {
        if (!posStore.activeSeller || !isManager.value || String(posStore.activeSeller.id) === String(authStore.user.id)) {
          const found = staffMembers.value.find((s) => String(s.id) === String(authStore.user?.id))
          if (found) {
            posStore.setSeller(found)
          } else {
            posStore.setSeller({
              id: authStore.user.id,
              name: authStore.user.name,
              email: authStore.user.email,
              role: authStore.user.role,
              department: authStore.user.department || null,
              is_active: true,
            })
          }
        }
      }
    }

    if (deliveryCompaniesRes.status === 'fulfilled') {
      const rawDelCo = (deliveryCompaniesRes.value.data as any)?.data ?? deliveryCompaniesRes.value.data ?? []
      deliveryStore.companies = Array.isArray(rawDelCo) ? rawDelCo : []
    }

    if (deliveryZonesRes.status === 'fulfilled') {
      const rawDelZo = (deliveryZonesRes.value.data as any)?.data ?? deliveryZonesRes.value.data ?? []
      const list = Array.isArray(rawDelZo) ? rawDelZo : []
      deliveryStore.zones = list.map((z: any) => ({
        ...z,
        name: z.name || z.zone_name || 'Delivery Zone',
        zone_name: z.zone_name || z.name || 'Delivery Zone',
        cost: typeof z.cost === 'number' ? z.cost : (parseFloat(String(z.cost ?? z.fee ?? 0)) || 0),
        fee: typeof z.fee === 'number' ? z.fee : (parseFloat(String(z.fee ?? z.cost ?? 0)) || 0),
        estimated_days: z.estimated_days || '1-2',
        is_active: z.is_active ?? true,
      }))
    }
  } catch (e) {
    console.error('Failed to load POS catalog data:', e)
    toast.error('Failed to load catalog data')
  } finally {
    if (showLoader) productsLoading.value = false
  }
}

// Watch authStore.user so switching accounts immediately resets activeSeller to the new user
watch(
  () => authStore.user,
  (newUser) => {
    if (newUser) {
      const found = staffMembers.value.find((s) => String(s.id) === String(newUser.id))
      posStore.setSeller(found || {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        department: newUser.department || null,
        is_active: true,
      })
    }
  }
)

// ============================================================================
// Lifecycle
// ============================================================================

onMounted(() => {
  if (authStore.user) {
    posStore.setSeller({
      id: authStore.user.id,
      name: authStore.user.name,
      email: authStore.user.email,
      role: authStore.user.role,
      department: authStore.user.department || null,
      is_active: true,
    })
  }
  loadProducts()
  window.addEventListener('keydown', handleGlobalKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeydown)
})

defineExpose({
  processBarcode,
  playScanBeep,
  handleContinuousScanSubmit,
  handleManualBarcodeSubmit: handleContinuousScanSubmit,
})
</script>

<template>
  <div class="pos-screen w-full h-[calc(100vh-64px)] flex bg-background text-foreground overflow-hidden select-none font-sans">
    <!-- ======================================================================
         LEFT ZONE: Product Catalog & Fast Filter Matrix
         ====================================================================== -->
    <section class="pos-catalog-zone flex-1 flex flex-col min-w-0 border-r border-border bg-background overflow-hidden">
      <!-- Catalog Top Bar -->
      <header class="p-4 bg-card border-b border-border flex items-center justify-between gap-3 shrink-0 shadow-2xs">
        <!-- Fast Search Input -->
        <div class="relative flex-1 max-w-md">
          <Search class="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            ref="searchInputRef"
            v-model="searchQuery"
            type="text"
            placeholder="Search items by name, SKU, barcode... (F1)"
            class="w-full pl-9.5 pr-8 py-2.5 rounded-xl border border-input bg-surface-subtle text-sm text-foreground placeholder:text-muted-foreground/70 focus:bg-card focus:border-cta focus:ring-2 focus:ring-cta/20 outline-hidden transition-all"
          />
          <button
            v-if="searchQuery"
            type="button"
            @click="clearSearch"
            class="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground rounded-lg transition-colors"
          >
            <X class="w-4 h-4" />
          </button>
        </div>

        <!-- Terminal Status Pills (Channel, Staff, Barcode Scanner) -->
        <div class="flex items-center gap-2 shrink-0">
          <!-- Hardware Barcode Scanner Trigger Button -->
          <button
            type="button"
            @click="handleOpenScannerPrompt"
            class="px-3 py-2 rounded-xl border border-border bg-surface-subtle hover:bg-card text-xs font-bold text-foreground flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
            title="Scan Barcode (F2)"
          >
            <ScanBarcode class="w-4 h-4 text-primary" />
            <span class="hidden sm:inline">Scanner (F2)</span>
          </button>

          <!-- Active Cashier / Staff Pill -->
          <button
            type="button"
            @click="handleOpenSellerPicker"
            :class="[
              'px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer',
              isSellingOnBehalf
                ? 'bg-cta-muted border-cta text-primary ring-1 ring-cta/20'
                : 'bg-card border-border text-foreground hover:bg-surface-subtle'
            ]"
            :title="isSellingOnBehalf ? `Selling on behalf of ${activeSeller?.name}` : 'Click to assign sales representative'"
          >
            <User class="w-3.5 h-3.5 text-primary" />
            <span class="max-w-[120px] truncate">
              {{ isSellingOnBehalf ? `Rep: ${activeSeller?.name}` : (activeSeller?.name || authStore.user?.name || 'Staff') }}
            </span>
            <span
              v-if="isSellingOnBehalf"
              class="text-3xs uppercase font-bold px-1.5 py-0.5 rounded-md bg-cta text-cta-foreground shadow-2xs"
            >
              Assisted
            </span>
          </button>

          <!-- Shift Daily Summary Button -->
          <button
            type="button"
            @click="showShiftSummaryModal = true"
            class="px-3 py-2 rounded-xl border border-border bg-card hover:bg-surface-subtle text-xs font-bold text-foreground flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
            title="Daily Shift Settlement & Drawer Reconciliation"
          >
            <FileCheck2 class="w-3.5 h-3.5 text-primary" />
            <span class="hidden md:inline">Shift Summary</span>
          </button>
        </div>
      </header>

      <!-- Category Filter Chips (Horizontal Smooth Scroll) -->
      <div class="px-4 py-2.5 bg-surface-subtle border-b border-border flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
        <button
          v-for="chip in categoryChips"
          :key="chip.id"
          type="button"
          @click="handleCategorySelect(chip.name)"
          :class="[
            'px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shadow-2xs cursor-pointer shrink-0 flex items-center gap-1.5',
            (selectedCategory === chip.name || (chip.name === 'All Products' && !selectedCategory))
              ? 'bg-cta text-cta-foreground border border-cta ring-2 ring-cta/20'
              : 'bg-card text-muted-foreground border border-border hover:text-foreground hover:bg-accent'
          ]"
        >
          <span>{{ chip.name }}</span>
          <span
            :class="[
              'px-1.5 py-0.2 rounded-md text-3xs font-mono',
              (selectedCategory === chip.name || (chip.name === 'All Products' && !selectedCategory))
                ? 'bg-black/20 text-white dark:bg-black/40'
                : 'bg-surface-subtle text-muted-foreground'
            ]"
          >
            {{ chip.count }}
          </span>
        </button>
      </div>

      <!-- Product Catalog Grid -->
      <div class="flex-1 p-4 overflow-y-auto min-h-0 bg-background">
        <!-- Skeleton Loading State -->
        <div
          v-if="productsLoading"
          class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3"
        >
          <div
            v-for="n in 10"
            :key="n"
            class="h-52 rounded-2xl bg-card border border-border p-3 flex flex-col justify-between animate-pulse"
          >
            <div class="w-full h-28 rounded-xl bg-muted" />
            <div class="space-y-2 mt-2">
              <div class="h-3.5 bg-muted rounded-md w-3/4" />
              <div class="h-4 bg-muted rounded-md w-1/2" />
            </div>
          </div>
        </div>

        <!-- Empty Products State -->
        <div
          v-else-if="filteredProducts.length === 0"
          class="h-full flex flex-col items-center justify-center text-center p-8 space-y-3"
        >
          <div class="w-14 h-14 rounded-2xl bg-accent border border-border flex items-center justify-center text-primary">
            <Package class="w-7 h-7" />
          </div>
          <div>
            <h3 class="text-base font-bold text-foreground font-display">No products found</h3>
            <p class="text-xs text-muted-foreground max-w-sm mt-1">
              No products match "{{ searchQuery }}". Try adjusting your search query or selecting a different category.
            </p>
          </div>
          <button
            type="button"
            @click="clearSearch"
            class="px-4 py-2 rounded-xl bg-card border border-border text-xs font-bold text-foreground hover:bg-surface-subtle transition-colors"
          >
            Clear Filters
          </button>
        </div>

        <!-- High-Density Product Card Grid -->
        <div
          v-else
          class="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5 gap-3 items-stretch"
        >
          <div
            v-for="product in filteredProducts"
            :key="product.id"
            @click="handleProductClick(product)"
            :class="[
              'group relative rounded-xl bg-card border p-2.5 flex flex-col justify-between transition-all duration-150 shadow-xs hover:shadow-md hover:border-cta hover:-translate-y-0.5 cursor-pointer active:scale-[0.98]',
              getProductCartCount(product.id) > 0
                ? 'border-cta ring-2 ring-cta/25 bg-accent/30'
                : 'border-border',
              getProductStock(product) <= 0 ? 'opacity-75' : ''
            ]"
          >
            <!-- Product Image / Thumbnail Area -->
            <div class="relative w-full h-28 rounded-lg bg-surface-subtle border border-border/80 overflow-hidden shrink-0 mb-2">
              <img
                v-if="product.image_url"
                :src="product.image_url"
                :alt="product.name"
                class="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
              />
              <div
                v-else
                class="absolute inset-0 flex items-center justify-center text-muted-foreground/40 group-hover:text-primary/70 transition-colors"
              >
                <Package class="w-8 h-8 stroke-[1.25]" />
              </div>

              <!-- Top Left: Multi-variant Pill Indicator -->
              <Badge
                v-if="product.variants && product.variants.length > 1"
                variant="neutral"
                class="absolute top-2 left-2 z-20 text-xs font-bold shadow-xs backdrop-blur-md gap-1"
              >
                <Layers class="w-3.5 h-3.5 text-primary stroke-[2.2]" />
                <span class="font-mono font-bold text-primary">{{ product.variants.length }}</span>
                <span class="text-muted-foreground text-xs font-medium">Options</span>
              </Badge>

              <!-- Top Right: In-Cart Counter Pill (Cleanly inside thumbnail top-right) -->
              <div
                v-if="getProductCartCount(product.id) > 0"
                class="absolute top-2 right-2 z-20 px-2.5 py-0.5 rounded-full bg-cta text-cta-foreground font-black text-xs shadow-sm font-mono flex items-center gap-1 animate-in zoom-in-50"
              >
                <ShoppingBag :size="11" />
                <span>{{ getProductCartCount(product.id) }}</span>
              </div>

              <!-- Bottom Left: High Contrast Stock Status Badge (Overlaid on thumbnail with backdrop-blur) -->
              <Badge
                :variant="getProductStock(product) <= 0 ? 'destructive' : getProductStock(product) <= 5 ? 'warning' : 'success'"
                class="absolute bottom-2 left-2 z-20 text-xs font-mono font-semibold shadow-xs backdrop-blur-md"
              >
                <span>{{ getProductStock(product) <= 0 ? 'Out of Stock' : `${getProductStock(product)} in stock` }}</span>
              </Badge>
            </div>

            <!-- Product Metadata -->
            <div class="flex-1 flex flex-col justify-between min-h-0">
              <div class="space-y-1">
                <!-- Category Badge Row (Dedicated full width, no overlap) -->
                <div class="flex items-center gap-1.5 min-h-[18px]">
                  <Badge variant="primary" class="text-xs font-bold uppercase tracking-wider truncate max-w-full">
                    {{ product.category?.name || 'General' }}
                  </Badge>
                </div>

                <!-- Product Name with 2-line Uniform Box -->
                <h4
                  class="text-xs font-bold text-foreground line-clamp-2 leading-snug group-hover:text-primary transition-colors min-h-[2.4em] flex items-start"
                  :title="product.name"
                >
                  {{ product.name }}
                </h4>

                <!-- SKU Code (High-Contrast, Clear Monospace) -->
                <div class="text-[11px] font-mono text-muted-foreground truncate font-medium">
                  SKU: <span class="font-semibold text-foreground/80">{{ product.sku || product.variants?.[0]?.sku || '—' }}</span>
                </div>
              </div>

              <!-- Price & Contextual Action Footer (Uniform Bottom Pinned Alignment) -->
              <div class="pt-2 flex items-center justify-between border-t border-border mt-2">
                <div>
                  <div class="text-[9px] uppercase font-bold text-muted-foreground tracking-wider leading-none mb-0.5">Price</div>
                  <span class="text-sm font-bold font-display text-foreground tracking-tight">
                    {{ formatMoney(product.variants?.[0]?.selling_price ?? product.selling_price) }}
                  </span>
                </div>

                <!-- Action Button with Out-of-Stock and Variant Options States -->
                <button
                  v-if="getProductStock(product) <= 0"
                  type="button"
                  disabled
                  class="h-7 px-2.5 rounded-lg bg-muted text-muted-foreground font-medium text-[11px] border border-border cursor-not-allowed opacity-80 flex items-center gap-1"
                >
                  <Ban class="w-3 h-3 text-rose-500" />
                  <span>Out of stock</span>
                </button>
                <button
                  v-else-if="product.variants && product.variants.length > 1"
                  type="button"
                  class="h-7 px-2.5 rounded-lg bg-surface-subtle group-hover:bg-accent group-hover:border-primary/50 text-primary border border-border font-semibold text-[11px] flex items-center gap-1 transition-all shadow-xs"
                >
                  <Layers class="w-3 h-3 text-primary stroke-[2]" />
                  <span>Options</span>
                </button>
                <button
                  v-else
                  type="button"
                  class="h-7 px-2.5 rounded-lg bg-surface-subtle border border-border group-hover:bg-cta group-hover:border-cta group-hover:text-cta-foreground text-foreground font-semibold text-[11px] flex items-center gap-1 transition-all shadow-xs"
                >
                  <Plus class="w-3 h-3 stroke-[2.5]" />
                  <span>Add</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ======================================================================
         FLOATING BOTTOM ACTION DOCK FOR MOBILE / TABLET (< 1024px)
         ====================================================================== -->
    <!-- When Cart has items: High-contrast "View Cart & Pay" floating pill -->
    <div
      v-if="posStore.itemCount > 0"
      class="lg:hidden fixed bottom-3 left-3 right-3 z-40 bg-card text-foreground p-3 rounded-2xl shadow-2xl flex items-center justify-between border border-border backdrop-blur-md"
    >
      <div class="flex items-center gap-3 cursor-pointer" @click="isMobileCartOpen = true">
        <div class="w-10 h-10 rounded-xl bg-cta text-cta-foreground flex items-center justify-center font-black font-mono shadow-xs shrink-0">
          {{ posStore.itemCount }}
        </div>
        <div>
          <span class="text-3xs text-muted-foreground block uppercase font-bold tracking-wider">Active Cart</span>
          <span class="text-sm font-black font-mono text-foreground">{{ formatMoney(posStore.total) }}</span>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <button
          type="button"
          @click="handleOpenScannerPrompt"
          class="w-10 h-10 rounded-xl bg-surface-subtle hover:bg-accent text-foreground flex items-center justify-center transition-colors cursor-pointer border border-border"
          title="Scan Barcode"
        >
          <ScanBarcode class="w-5 h-5 text-primary" />
        </button>
        <button
          type="button"
          @click="isMobileCartOpen = true"
          class="px-4 py-2.5 rounded-xl bg-cta text-cta-foreground font-bold text-xs flex items-center gap-1.5 shadow-xs active:scale-95 transition-transform cursor-pointer"
        >
          <span>View Cart & Pay</span>
          <ArrowRight class="w-4 h-4" />
        </button>
      </div>
    </div>

    <!-- When Cart is empty: Ergonomic 4-action mobile quick dock -->
    <div
      v-else
      class="lg:hidden fixed bottom-3 left-3 right-3 z-30 bg-card/95 text-foreground p-1.5 px-3 rounded-2xl shadow-xl flex items-center justify-around border border-border backdrop-blur-md"
    >
      <button
        type="button"
        @click="focusSearch"
        class="flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl hover:bg-surface-subtle text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
      >
        <Search class="w-4 h-4 text-foreground/90" />
        <span class="text-[10px] font-bold">Catalog</span>
      </button>

      <button
        type="button"
        @click="handleOpenScannerPrompt"
        class="flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl bg-cta-muted text-primary border border-border-strong hover:bg-accent transition-colors cursor-pointer"
      >
        <ScanBarcode class="w-4 h-4" />
        <span class="text-[10px] font-bold">Scan Barcode</span>
      </button>

      <button
        type="button"
        @click="showHoldOrdersModal = true"
        class="relative flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl hover:bg-surface-subtle text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
      >
        <PauseCircle class="w-4 h-4 text-foreground/90" />
        <span class="text-[10px] font-bold">Held</span>
        <span
          v-if="posStore.heldOrders.length > 0"
          class="absolute -top-1 right-1 w-4 h-4 rounded-full bg-cta text-cta-foreground text-[10px] font-mono font-bold flex items-center justify-center shadow-xs"
        >
          {{ posStore.heldOrders.length }}
        </span>
      </button>

      <button
        type="button"
        @click="showShiftSummaryModal = true"
        class="flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl hover:bg-surface-subtle text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
      >
        <FileCheck2 class="w-4 h-4 text-foreground/90" />
        <span class="text-[10px] font-bold">My Shift</span>
      </button>

      <button
        type="button"
        @click="isMobileCartOpen = true"
        class="flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl hover:bg-surface-subtle text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
      >
        <ShoppingBag class="w-4 h-4 text-foreground/90" />
        <span class="text-[10px] font-bold">Cart (0)</span>
      </button>
    </div>

    <!-- Backdrop for Mobile Cart Drawer -->
    <div
      v-if="isMobileCartOpen"
      class="lg:hidden fixed inset-0 bg-black/60 z-40 backdrop-blur-xs transition-opacity"
      @click="isMobileCartOpen = false"
    />

    <!-- ======================================================================
         RIGHT ZONE: Persistent Transaction Cart & Checkout Engine
         ====================================================================== -->
    <aside
      :class="[
        'pos-cart-zone w-full sm:w-[410px] xl:w-[440px] flex flex-col bg-card border-l border-border h-full shrink-0 shadow-lg transition-transform duration-200',
        'lg:static lg:translate-x-0 lg:z-auto',
        isMobileCartOpen
          ? 'fixed inset-y-0 right-0 translate-x-0 z-40'
          : 'fixed inset-y-0 right-0 translate-x-full lg:translate-x-0 z-40'
      ]"
    >
      <!-- Mobile Back Navigation Bar (< 1024px) -->
      <div class="lg:hidden px-3.5 py-2.5 bg-card border-b border-border flex items-center justify-between shadow-2xs shrink-0">
        <button
          type="button"
          @click="isMobileCartOpen = false"
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-subtle hover:bg-accent text-foreground text-xs font-bold border border-border active:scale-95 transition-all cursor-pointer"
        >
          <ArrowLeft class="w-4 h-4 text-primary" />
          <span>Back to Products</span>
        </button>
        <span class="text-xs font-bold font-mono text-muted-foreground">
          {{ posStore.itemCount }} item{{ posStore.itemCount === 1 ? '' : 's' }}
        </span>
      </div>

      <!-- Cart Header & Tabs Bar -->
      <div class="p-3 bg-surface-subtle border-b border-border space-y-2.5 shrink-0">
        <!-- Multi-Cart Tabs & Mobile Close -->
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar flex-1">
            <div
              v-for="tab in posStore.tabs"
              :key="tab.id"
              @click="posStore.switchTab(tab.id)"
              :class="[
                'group relative px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer select-none',
                posStore.activeTabId === tab.id
                  ? 'bg-card text-primary border border-border shadow-2xs ring-1 ring-primary/20'
                  : 'bg-transparent text-muted-foreground hover:bg-card/60 hover:text-foreground'
              ]"
            >
              <span>{{ tab.name }}</span>
              <span
                v-if="tab.items.length > 0"
                class="w-4 h-4 rounded-full bg-cta text-cta-foreground text-3xs font-mono flex items-center justify-center font-bold"
              >
                {{ tab.items.reduce((s, i) => s + i.quantity, 0) }}
              </span>

              <!-- Delete / Close Tab Button -->
              <button
                v-if="posStore.tabs.length > 1"
                type="button"
                class="w-4 h-4 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors ml-0.5"
                :title="`Delete ${tab.name}`"
                @click.stop="promptDeleteCartTab(tab)"
              >
                <X class="w-3 h-3" />
              </button>
            </div>

            <!-- Add Cart Tab Button -->
            <button
              type="button"
              @click="posStore.createTab()"
              class="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-card border border-transparent hover:border-border transition-all cursor-pointer"
              title="Open new cart tab"
            >
              <Plus class="w-4 h-4" />
            </button>
          </div>

          <div class="flex items-center gap-1">
            <!-- Parked Orders Quick Trigger -->
            <button
              type="button"
              @click="showHoldOrdersModal = true"
              class="px-2.5 py-1.5 rounded-xl border border-border bg-card text-xs font-bold text-muted-foreground hover:text-primary flex items-center gap-1 shadow-2xs cursor-pointer transition-colors"
              title="View Parked Orders (F6)"
            >
              <Clock class="w-3.5 h-3.5 text-primary" />
              <span>Held ({{ posStore.heldOrders.length }})</span>
            </button>

            <!-- Close Drawer (Mobile only) -->
            <button
              type="button"
              @click="isMobileCartOpen = false"
              class="lg:hidden p-1.5 rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-surface-subtle cursor-pointer"
            >
              <X class="w-4 h-4" />
            </button>
          </div>
        </div>

        <!-- Customer Loyalty Chip Bar -->
        <div class="flex items-center justify-between p-2.5 rounded-xl bg-card border border-border shadow-2xs">
          <div
            v-if="posStore.customer"
            class="flex items-center gap-2.5 min-w-0"
          >
            <div class="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0 shadow-2xs">
              {{ (posStore.customer.name || 'C').charAt(0).toUpperCase() }}
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-1.5">
                <span class="text-xs font-bold text-foreground truncate">{{ posStore.customer.name || 'Valued Customer' }}</span>
                <Badge
                  :variant="getTierDetails(calculateLoyalty(posStore.customer).tier).variant"
                  class="text-xs font-mono font-semibold"
                >
                  {{ calculateLoyalty(posStore.customer).tier }}
                </Badge>
              </div>
              <span class="text-3xs text-muted-foreground font-mono">{{ posStore.customer.phone || 'Loyalty Member' }}</span>
            </div>
          </div>

          <div v-else class="flex items-center gap-2 text-xs text-muted-foreground">
            <User class="w-4 h-4 text-primary" />
            <span class="font-medium text-foreground">Walk-in Customer</span>
          </div>

          <button
            type="button"
            @click="handleOpenCustomerModal"
            class="px-2.5 py-1 rounded-lg text-xs font-bold text-primary bg-cta-muted hover:bg-accent border border-border-strong transition-colors cursor-pointer shrink-0"
          >
            {{ posStore.customer ? 'Change (F3)' : '+ Add Customer (F3)' }}
          </button>
        </div>
      </div>

      <!-- Cart Items Scrollable List -->
      <div class="flex-1 p-3 overflow-y-auto space-y-2 min-h-0 bg-background/50">
        <!-- Empty Cart State -->
        <div
          v-if="posStore.isCartEmpty"
          class="h-full flex flex-col items-center justify-center text-center p-6 space-y-2 text-muted-foreground"
        >
          <div class="w-12 h-12 rounded-2xl bg-surface-subtle border border-border flex items-center justify-center text-primary/40">
            <ShoppingBag class="w-6 h-6" />
          </div>
          <p class="text-sm font-bold text-foreground">Transaction Cart Empty</p>
          <p class="text-xs max-w-[220px]">
            Scan a barcode or tap products from catalog to start sale.
          </p>
        </div>

        <!-- Line Item Rows -->
        <div
          v-for="item in posStore.items"
          :key="item.id"
          class="p-2.5 rounded-xl border border-border bg-card hover:border-cta transition-all space-y-2 group shadow-2xs"
        >
          <!-- Top Row: Name, SKU, Total -->
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1.5 flex-wrap">
                <h5 class="text-xs font-bold text-foreground leading-snug break-words">
                  {{ item.name }}
                </h5>
                <span
                  v-if="item.max_stock !== undefined && item.max_stock !== null && item.quantity >= item.max_stock"
                  class="px-1.5 py-0.5 text-[9px] font-mono font-bold rounded-md bg-warning-bg text-warning-text border border-warning-border"
                >
                  Max ({{ item.max_stock }})
                </span>
              </div>
              <div class="flex items-center gap-2 text-3xs text-muted-foreground font-mono mt-0.5">
                <span>{{ formatMoney(item.price) }} each</span>
                <span v-if="item.variant_name" class="italic text-primary">· {{ item.variant_name }}</span>
              </div>
            </div>

            <!-- Line Total -->
            <div class="text-right shrink-0">
              <span class="text-sm font-bold font-display text-foreground">
                {{ formatMoney(posStore.getLineTotal(item)) }}
              </span>
            </div>
          </div>

          <!-- Bottom Row: Stepper, Discount Pill, Note Trigger, Remove -->
          <div class="flex items-center justify-between gap-2 pt-1 border-t border-border/70">
            <!-- Numeric Stepper -->
            <div class="flex items-center border border-border rounded-lg bg-surface-subtle p-0.5 shadow-2xs">
              <button
                type="button"
                class="w-6 h-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-card transition-colors cursor-pointer"
                @click="posStore.updateQuantity(item.id, item.quantity - 1)"
              >
                <Minus class="w-3 h-3" />
              </button>
              <span class="w-7 text-center text-xs font-bold font-mono text-foreground">
                {{ item.quantity }}
              </span>
              <button
                type="button"
                :disabled="item.max_stock !== undefined && item.max_stock !== null && item.quantity >= item.max_stock"
                class="w-6 h-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-card transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                :title="item.max_stock !== undefined && item.max_stock !== null && item.quantity >= item.max_stock ? `Max stock limit (${item.max_stock}) reached` : 'Increase quantity'"
                @click="handleIncrementCartItem(item)"
              >
                <Plus class="w-3 h-3" />
              </button>
            </div>

            <!-- Options (Discount & Note Pill) -->
            <div class="flex items-center gap-1.5">
              <button
                type="button"
                @click="handleOpenItemNote(item)"
                :class="[
                  'px-2 py-1 rounded-lg text-3xs font-bold border transition-colors flex items-center gap-1 cursor-pointer',
                  item.discount > 0
                    ? 'bg-cta-muted text-primary border-cta/30 dark:border-cta/50'
                    : 'bg-card text-muted-foreground border-border hover:bg-surface-subtle'
                ]"
                title="Edit item discount / note"
              >
                <Tag class="w-2.5 h-2.5" />
                <span v-if="item.discount > 0">-{{ item.discount }}{{ item.discount_type === 'flat' ? '$' : '%' }}</span>
                <span v-else>Disc</span>
              </button>

              <button
                v-if="item.notes"
                type="button"
                @click="handleOpenItemNote(item)"
                class="p-1 rounded-lg bg-cta-muted text-primary border border-cta/30 dark:border-cta/50 text-3xs font-bold"
                :title="item.notes"
              >
                <FileText class="w-3 h-3" />
              </button>

              <!-- Remove Item Button -->
              <button
                type="button"
                @click="posStore.removeItem(item.id)"
                class="p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors cursor-pointer"
                title="Remove item"
              >
                <Trash2 class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Cart Financial Summary & Checkout CTA -->
      <footer class="p-4 bg-card border-t border-border space-y-3 shrink-0">
        <!-- Breakdown Rows -->
        <div class="space-y-1.5 text-xs text-muted-foreground">
          <div class="flex justify-between">
            <span>Subtotal ({{ posStore.itemCount }} items)</span>
            <span class="font-mono text-foreground">{{ formatMoney(posStore.subtotal) }}</span>
          </div>

          <div v-if="posStore.orderDiscountAmount > 0" class="flex justify-between text-amber-700 dark:text-amber-400 font-medium">
            <span>Cart Discount</span>
            <span class="font-mono">-{{ formatMoney(posStore.orderDiscountAmount) }}</span>
          </div>

          <div v-if="posStore.taxAmount > 0" class="flex justify-between">
            <span>Estimated Tax ({{ posStore.taxRate }}%)</span>
            <span class="font-mono text-foreground">{{ formatMoney(posStore.taxAmount) }}</span>
          </div>

          <div v-if="posStore.isDelivery && posStore.deliveryFee > 0" class="flex justify-between">
            <span>Delivery Fee</span>
            <span class="font-mono text-foreground">{{ formatMoney(posStore.deliveryFee) }}</span>
          </div>

          <!-- Bold Grand Total -->
          <div class="flex justify-between items-baseline pt-2 border-t border-border">
            <span class="text-sm font-bold text-foreground font-display uppercase tracking-tight">Grand Total</span>
            <span class="text-2xl font-black text-foreground font-display">
              {{ formatMoney(posStore.total) }}
            </span>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="flex gap-2">
          <!-- Hold Order (F4) -->
          <button
            type="button"
            @click="handleHoldActiveCart"
            :disabled="posStore.isCartEmpty"
            class="px-3.5 py-3 rounded-xl border border-border bg-surface-subtle text-xs font-bold text-foreground hover:bg-card transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs flex items-center justify-center gap-1.5"
            title="Park current cart (F4)"
          >
            <Clock class="w-4 h-4 text-primary" />
            <span>Hold (F4)</span>
          </button>

          <!-- Clear Cart -->
          <button
            type="button"
            @click="handleClearActiveCart"
            :disabled="posStore.isCartEmpty"
            class="px-3 py-3 rounded-xl border border-border bg-surface-subtle text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs"
            title="Clear active cart"
          >
            <Trash2 class="w-4 h-4" />
          </button>

          <!-- Vibrant Retail Orange Checkout CTA -->
          <button
            type="button"
            @click="handleOpenCheckout"
            :disabled="posStore.isCartEmpty"
            class="flex-1 py-3 px-4 rounded-xl bg-cta text-cta-foreground font-bold text-sm hover:brightness-110 transition-all flex items-center justify-center gap-2 shadow-md disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer active:scale-98"
          >
            <CheckCircle2 class="w-4 h-4 stroke-[2.5]" />
            <span>Checkout (F8)</span>
          </button>
        </div>

        <!-- Mobile Back to Catalog Footer Button (< 1024px) -->
        <button
          type="button"
          @click="isMobileCartOpen = false"
          class="lg:hidden w-full py-2.5 rounded-xl border border-border bg-surface-subtle text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-card flex items-center justify-center gap-1.5 transition-colors cursor-pointer active:scale-98"
        >
          <ArrowLeft class="w-3.5 h-3.5" />
          <span>Continue Selling / Back to Catalog</span>
        </button>
      </footer>
    </aside>

    <!-- ======================================================================
         MODALS & OVERLAYS
         ====================================================================== -->

    <!-- 1. Product Variant Selector Modal -->
    <PosVariantModal
      v-model:open="showVariantModal"
      :product="selectedVariantProduct"
      :cart-items="posStore.items"
      @select="handleVariantSelect"
    />

    <!-- 2. Streamlined Fast Checkout Modal -->
    <PosCheckoutModal
      v-model:open="showCheckoutModal"
      :subtotal="posStore.subtotal"
      :discount-type="posStore.discountType"
      :discount-value="posStore.discountValue"
      :tax-rate="posStore.taxRate"
      :tax-amount="posStore.taxAmount"
      :delivery-fee="posStore.deliveryFee"
      :total="posStore.total"
      :change="posStore.changeAmount"
      :payment-method="posStore.paymentMethod"
      :selected-bank-account-id="posStore.selectedBankAccountId"
      :tendered-amount="posStore.tenderedAmount"
      :is-delivery="posStore.isDelivery"
      :delivery-address="posStore.deliveryAddress"
      :delivery-region="posStore.deliveryRegion"
      :customer-name="posStore.customer?.name"
      :customer-phone="posStore.customer?.phone"
      :customer-loyalty-tier="posStore.customer?.loyalty_tier"
      :delivery-company-id="posStore.deliveryCompanyId"
      :delivery-zone-id="posStore.deliveryZoneId"
      :companies="deliveryStore.companies"
      :zones="deliveryStore.zones"
      :channels="channels"
      :selected-channel-id="posStore.activeChannelId"
      :cart-items="posStore.items"
      :loading="checkoutLoading"
      :active-seller="posStore.activeSeller"
      :is-selling-on-behalf="isSellingOnBehalf"
      @open-seller-picker="handleOpenSellerPicker"
      @reset-seller="() => {
        if (authStore.user) {
          posStore.setSeller({
            id: authStore.user.id,
            name: authStore.user.name,
            email: authStore.user.email,
            role: authStore.user.role,
            department: authStore.user.department || null,
            is_active: true,
          })
          toast.info('Attribution reset to logged-in user')
        }
      }"
      @update:channel-id="(val) => {
        const found = channels.find((c) => c.id === val)
        posStore.setChannel(val, found?.name || '')
      }"
      @update:delivery="(val) => posStore.setDelivery({ isDelivery: val })"
      @update:delivery-address="(val) => posStore.setDelivery({ isDelivery: posStore.isDelivery, address: val })"
      @update:delivery-region="(val) => posStore.setDelivery({ isDelivery: posStore.isDelivery, region: val })"
      @update:delivery-company="(val) => posStore.setDelivery({ isDelivery: posStore.isDelivery, companyId: val })"
      @update:delivery-zone="handleDeliveryZoneSelect"
      @update:delivery-fee="(val) => posStore.setDelivery({ isDelivery: posStore.isDelivery, fee: val })"
      @update:customer-name="(val) => posStore.setCustomer({ ...(posStore.customer || { id: '', phone: '' }), name: val })"
      @update:customer-phone="(val) => posStore.setCustomer({ ...(posStore.customer || { id: '', name: '' }), phone: val })"
      @update:discount-type="(val) => posStore.setOrderDiscount(val, posStore.discountValue)"
      @update:discount-value="(val) => posStore.setOrderDiscount(posStore.discountType, val)"
      @update:tax-rate="(val) => posStore.setTaxRate(val)"
      @update:tendered="(val) => posStore.setTenderedAmount(val)"
      @update:payment-method="(val) => posStore.setPaymentMethod(val, posStore.selectedBankAccountId)"
      @update:bank-account-id="(val) => posStore.setPaymentMethod(posStore.paymentMethod, val)"
      @update:notes="(val) => posStore.setOrderNotes(val)"
      @complete="handleCompleteCheckout"
    />

    <!-- 3. In-App 80mm Thermal Receipt Preview Modal -->
    <PosReceiptModal
      v-model:open="showReceiptModal"
      :order="completedOrder"
      :store-name="brandingStore.branding.store_name"
      :store-tagline="brandingStore.branding.tagline"
      :store-phone="brandingStore.branding.store_phone"
      :store-address="brandingStore.branding.store_address"
      :receipt-header="brandingStore.branding.receipt_header"
      :footer-message="brandingStore.branding.receipt_footer"
      @new-sale="() => { showReceiptModal = false; }"
    />

    <!-- 4. Customer Loyalty & Registration Modal -->
    <PosCustomerModal
      v-model:open="showCustomerModal"
      :current-customer="posStore.customer"
      @select="handleCustomerSelect"
      @clear="handleCustomerClear"
    />

    <!-- 5. Parked / Held Orders Management Modal -->
    <PosHoldOrdersModal
      v-model:open="showHoldOrdersModal"
      :held-orders="posStore.heldOrders"
      @resume="handleResumeHeldOrder"
      @delete="handleDeleteHeldOrder"
    />

    <!-- 6. Line Item Note & Custom Discount Modal -->
    <PosItemNoteModal
      v-model:open="showItemNoteModal"
      :item="selectedNoteItem"
      @save="handleSaveItemNote"
    />

    <!-- 7. Staff / Cashier Picker Modal -->
    <SellerPickerModal
      v-model:open="showSellerModal"
      :staff-members="staffMembers"
      :selected-id="posStore.activeSeller?.id ?? authStore.user?.id ?? null"
      :current-user-id="authStore.user?.id"
      @select="handleSellerSelect"
    />

    <!-- 8. Clear Cart Confirmation Dialog -->
    <Dialog :open="showClearCartDialog" @update:open="(val) => showClearCartDialog = val">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle class="font-display flex items-center gap-2">
            <Trash2 class="text-destructive w-5 h-5" />
            <span>Clear Entire Cart</span>
          </DialogTitle>
          <DialogDescription class="text-sm text-muted-foreground mt-2">
            Are you sure you want to clear all items from the current active cart? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter class="gap-2 sm:gap-0 mt-4">
          <Button variant="outline" @click="showClearCartDialog = false">Cancel</Button>
          <Button variant="destructive" @click="confirmClearCart">
            Clear Cart
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- 8b. Delete Cart Tab Confirmation Dialog -->
    <Dialog :open="showDeleteTabDialog" @update:open="(val) => showDeleteTabDialog = val">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle class="font-display flex items-center gap-2">
            <Trash2 class="text-destructive w-5 h-5" />
            <span>Delete Cart Tab</span>
          </DialogTitle>
          <DialogDescription class="text-sm text-muted-foreground mt-2">
            Are you sure you want to delete <strong class="text-foreground">"{{ tabToDelete?.name }}"</strong>?
            <span v-if="tabToDelete && tabToDelete.items.length > 0" class="block mt-1 text-destructive font-medium">
              This will discard {{ tabToDelete.items.reduce((s, i) => s + i.quantity, 0) }} item(s) currently in this cart.
            </span>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter class="gap-2 sm:gap-0 mt-4">
          <Button variant="outline" @click="showDeleteTabDialog = false">Cancel</Button>
          <Button variant="destructive" @click="confirmDeleteCartTab">
            Delete Cart
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- 9. Continuous Barcode Scanner Modal (Uninterrupted Auto-Add Mode) -->
    <Dialog v-model:open="showScannerInput">
      <DialogContent class="sm:max-w-md p-0 overflow-hidden border border-border shadow-xl">
        <!-- Header -->
        <div class="px-5 py-4 border-b border-border bg-surface-subtle flex items-center justify-between pr-14">
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-9 h-9 rounded-xl bg-accent border border-border flex items-center justify-center text-primary shrink-0 shadow-2xs">
              <ScanBarcode class="w-4.5 h-4.5" />
            </div>
            <div class="min-w-0">
              <DialogTitle class="text-sm sm:text-base font-display font-bold text-foreground leading-snug">
                Continuous Barcode Scanner
              </DialogTitle>
              <DialogDescription class="text-xs text-muted-foreground mt-0.5 leading-tight">
                Scan items continuously · Each barcode auto-adds to the cart
              </DialogDescription>
            </div>
          </div>
          <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-3xs font-mono font-bold tracking-wide shrink-0">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>AUTO-ADD</span>
          </div>
        </div>

        <div class="p-5 flex flex-col gap-4">
          <!-- Camera Viewfinder (Live Video Stream & Scan Reticle) -->
          <div
            v-if="isCameraScannerActive"
            class="relative rounded-xl overflow-hidden bg-black aspect-video flex items-center justify-center border border-cta/50 shadow-inner"
          >
            <video
              ref="cameraVideoRef"
              class="w-full h-full object-cover"
              playsinline
              muted
            />
            <!-- Target Reticle Overlay -->
            <div class="absolute inset-0 border-2 border-cta/30 flex items-center justify-center pointer-events-none">
              <div class="w-48 h-24 border-2 border-cta rounded-xl relative shadow-[0_0_15px_rgba(255,148,26,0.3)]">
                <div class="absolute inset-x-0 top-1/2 h-0.5 bg-cta shadow-[0_0_8px_var(--color-cta)] animate-pulse"></div>
              </div>
            </div>
            <!-- Stop Camera Overlay Button -->
            <button
              type="button"
              @click="stopCameraScanner"
              class="absolute top-2 right-2 px-2.5 py-1 rounded-lg bg-black/70 hover:bg-black text-white text-3xs font-bold flex items-center gap-1 backdrop-blur-xs transition-colors cursor-pointer"
            >
              <CameraOff class="w-3.5 h-3.5 text-rose-400" />
              <span>Turn Off Camera</span>
            </button>
          </div>

          <!-- Continuous Scanner Input & Controls -->
          <div class="relative flex flex-col gap-1.5">
            <div class="flex items-center justify-between">
              <label class="text-xs font-semibold text-foreground">Scan Barcode</label>
              <button
                v-if="isCameraSupported"
                type="button"
                @click="toggleCameraScanner"
                :class="[
                  'px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs',
                  isCameraScannerActive
                    ? 'bg-rose-100 text-rose-800 border border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-900'
                    : 'bg-accent text-primary border border-border hover:bg-accent/80'
                ]"
              >
                <component :is="isCameraScannerActive ? CameraOff : Camera" class="w-3.5 h-3.5" />
                <span>{{ isCameraScannerActive ? 'Stop Camera' : 'Use Device Camera' }}</span>
              </button>
            </div>
            <div class="relative flex items-center">
              <Input
                v-model="barcodeInput"
                ref="barcodeInputRef"
                placeholder="Point scanner gun, camera, or type barcode…"
                class="h-10 text-xs font-mono bg-card pl-3 pr-10 border-input focus:border-cta focus:ring-1 focus:ring-cta shadow-2xs w-full"
                autofocus
                @keydown.enter.prevent="handleContinuousScanSubmit"
              />
              <div class="absolute right-3 pointer-events-none text-muted-foreground">
                <ScanBarcode class="w-4 h-4 text-cta" />
              </div>
            </div>
            <p v-if="scannerErrorMsg" class="text-xs text-destructive font-medium flex items-center gap-1">
              ⚠ {{ scannerErrorMsg }}
            </p>
          </div>

          <!-- Live Scan Session Stream -->
          <div class="flex flex-col gap-2">
            <div class="flex items-center justify-between text-xs font-bold text-muted-foreground">
              <span>Session Scanned Feed ({{ sessionScans.filter(s => s.success).length }})</span>
              <span v-if="sessionScans.length" class="text-3xs text-muted-foreground">Latest on top</span>
            </div>

            <div class="h-40 overflow-y-auto border border-border rounded-lg bg-surface-subtle/50 p-2 divide-y divide-border/60">
              <div
                v-if="sessionScans.length === 0"
                class="h-full flex flex-col items-center justify-center text-center p-3 text-xs text-muted-foreground"
              >
                <ScanBarcode class="w-7 h-7 text-muted-foreground/50 mb-1" />
                <p class="font-bold text-foreground">Ready for scans</p>
                <p class="text-3xs text-muted-foreground mt-0.5">Scan or type items continuously.</p>
              </div>

              <div
                v-for="item in sessionScans"
                :key="item.id"
                class="py-1.5 px-2 flex items-center justify-between gap-2 text-xs first:pt-0.5 last:pb-0.5 transition-colors"
                :class="item.success ? 'hover:bg-card rounded-md' : 'bg-destructive/5 rounded-md text-destructive'"
              >
                <div class="flex items-center gap-2 min-w-0">
                  <div
                    class="w-4.5 h-4.5 rounded-full flex items-center justify-center shrink-0 text-3xs font-bold font-mono"
                    :class="item.success ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-destructive/20 text-destructive'"
                  >
                    {{ item.success ? '✓' : '✕' }}
                  </div>
                  <div class="min-w-0">
                    <p class="font-bold text-foreground truncate">{{ item.name }}</p>
                    <p class="text-3xs text-muted-foreground font-mono">{{ item.sku }} · {{ item.time }}</p>
                  </div>
                </div>

                <div class="text-right shrink-0">
                  <span v-if="item.success" class="font-mono font-bold text-primary">{{ formatMoney(item.price) }}</span>
                  <span v-else class="text-3xs text-destructive font-semibold">{{ item.error }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="px-5 py-3 bg-surface-subtle border-t border-border flex items-center justify-between">
          <div class="text-xs text-muted-foreground">
            <span class="font-semibold text-foreground">Cart Total:</span> {{ posStore.items.reduce((s, i) => s + i.quantity, 0) }} item(s) · <span class="font-bold text-primary font-mono">{{ formatMoney(posStore.total) }}</span>
          </div>
          <Button
            variant="primary"
            size="sm"
            class="h-8 px-4 text-xs font-semibold gap-1.5"
            @click="showScannerInput = false"
          >
            <span>Done Scanning (Esc)</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    <!-- 10. Cashier Daily Shift Summary & Settlement Modal -->
    <SellerDailySummaryModal
      v-model:open="showShiftSummaryModal"
      :target-seller-id="posStore.activeSeller?.id ? String(posStore.activeSeller.id) : null"
    />
  </div>
</template>

<style scoped>
/* Utility for smooth scrolling chip bar without ugly scrollbar */
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>