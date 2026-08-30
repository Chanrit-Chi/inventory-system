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
  Store,
  Clock,
  CheckCircle2,
  Package,
} from 'lucide-vue-next'
import { useToast } from '@/composables/useToast'
import { useDeliveryZoneStore } from '@/stores/deliveryZoneStore'
import { usePosStore, type CartItem, type StaffMember } from '@/stores/posStore'
import { useOfflineQueue } from '@/hooks/useOfflineQueue'
import api from '@/api/axios'

// POS Modals
import PosVariantModal from '@/components/pos/PosVariantModal.vue'
import PosCheckoutModal from '@/components/pos/PosCheckoutModal.vue'
import PosReceiptModal from '@/components/pos/PosReceiptModal.vue'
import PosCustomerModal, { type Customer } from '@/components/pos/PosCustomerModal.vue'
import PosHoldOrdersModal from '@/components/pos/PosHoldOrdersModal.vue'
import PosItemNoteModal from '@/components/pos/PosItemNoteModal.vue'
import SellerPickerModal from '@/components/pos/SellerPickerModal.vue'
import {
  Button,
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

interface SalesChannel {
  id: string
  name: string
  is_active: boolean
  is_default: boolean
}

interface OrderResult {
  id: string
  order_number: string
  invoice_number?: string
  created_at?: string
  subtotal?: number | string
  discount?: number | string
  tax_amount?: number | string
  tax_rate?: number | string
  delivery_fee?: number | string
  total_amount?: number | string
  payment_method?: string
  tendered_amount?: number | string
  change_amount?: number | string
  items?: any[]
  customer_info?: any
  seller?: any
}

// ============================================================================
// Stores & Services
// ============================================================================

const toast = useToast()
const deliveryStore = useDeliveryZoneStore()
const posStore = usePosStore()

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

const barcodeInputRef = ref<HTMLInputElement | null>(null)

watch(
  () => showScannerInput.value,
  (open) => {
    if (open) {
      barcodeInput.value = ''
      nextTick(() => barcodeInputRef.value?.focus())
    }
  }
)

const checkoutLoading = ref(false)

const showReceiptModal = ref(false)
const completedOrder = ref<OrderResult | null>(null)

const showCustomerModal = ref(false)
const showHoldOrdersModal = ref(false)
const showSellerModal = ref(false)
const showClearCartDialog = ref(false)

const showItemNoteModal = ref(false)
const selectedNoteItem = ref<CartItem | null>(null)

// Hardware Barcode Scanner Buffer State
let barcodeKeyBuffer = ''
let lastKeyTimestamp = 0
const isScanningActive = ref(false)

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
const activeSeller = computed(() => {
  return posStore.activeSeller
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

function handleOpenScannerPrompt() {
  showScannerInput.value = true
}

async function handleManualBarcodeSubmit() {
  const code = barcodeInput.value
  if (!code || !code.trim()) {
    showScannerInput.value = false
    return
  }
  barcodeInput.value = ''
  showScannerInput.value = false
  await processBarcode(code)
}

function handleProductClick(product: Product) {
  const variants = product.variants || []

  if (variants.length > 1) {
    // Open variant selector
    selectedVariantProduct.value = product
    showVariantModal.value = true
  } else {
    // Single variant or base product
    const variant = variants[0]
    if (variant && variant.quantity_on_hand <= 0) {
      toast.warning(`Cannot add ${product.name} — out of stock`)
      return
    }
    posStore.addToCart(product, variant, 1)
    toast.success(`Added ${product.name} to cart`)
  }
}

function handleVariantSelect(product: Product, variant: ProductVariant, qty: number) {
  posStore.addToCart(product, variant, qty)
  toast.success(`Added ${product.name} (${variant.sku}) to cart`)
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

  checkoutLoading.value = true

  try {
    const payload = {
      channel_id: posStore.activeChannelId || (activeChannel.value?.id ?? null),
      seller_id: posStore.activeSeller?.id ?? null,
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
      delivery_company_id: posStore.isDelivery ? posStore.deliveryCompanyId : null,
      delivery_zone_id: posStore.isDelivery ? posStore.deliveryZoneId : null,
      items: posStore.items.map((item) => ({
        product_id: item.product_id,
        variant_id: item.variant_id || null,
        sku: item.sku,
        quantity: item.quantity,
        unit_price: item.price,
        discount: item.discount,
        discount_type: item.discount_type,
        notes: item.notes,
      })),
      subtotal: posStore.subtotal,
      discount_type: posStore.discountType,
      discount_value: posStore.discountValue,
      tax_rate: posStore.taxRate,
      tax_amount: posStore.taxAmount,
      delivery_fee: posStore.isDelivery ? posStore.deliveryFee : 0,
      total_amount: posStore.total,
      payment_method: posStore.paymentMethod,
      tendered_amount: posStore.paymentMethod === 'CASH' ? posStore.tenderedAmount : posStore.total,
      notes: posStore.orderNotes || null,
    }

    // Try API first; if network fails, fall back to offline queue
    let res: any
    try {
      res = await api.post<any>('/orders/checkout', payload)
    } catch (apiError) {
      // Enqueue mutation for offline retry and notify user
      const { enqueueMutation } = useOfflineQueue()
      const mutationId = crypto.randomUUID()
      enqueueMutation({
        id: mutationId,
        type: 'checkout',
        endpoint: '/orders/checkout',
        payload,
      })
      toast.error('Network unavailable. Sale saved offline — will sync when back online.')
      checkoutLoading.value = false
      return
    }
    const orderData = res.data?.data || res.data

    if (orderData) {
      completedOrder.value = {
        id: orderData.id,
        order_number: orderData.order_number || orderData.invoice_number || `ORD-${Date.now().toString().slice(-6)}`,
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
        total_amount: posStore.total,
        payment_method: posStore.paymentMethod,
        tendered_amount: posStore.paymentMethod === 'CASH' ? posStore.tenderedAmount : posStore.total,
        change_amount: posStore.changeAmount,
        customer_info: posStore.customer,
        seller: posStore.activeSeller,
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

// ============================================================================
// Hardware Barcode Scanner & Global Hotkeys Listener
// ============================================================================

async function processBarcode(code: string) {
  const cleanCode = code.trim()
  if (!cleanCode) return

  isScanningActive.value = true
  try {
    const res = await api.get<{ data?: { type: string; product?: any; variant?: any; variants?: any[] } }>(
      `/inventory/scan?code=${encodeURIComponent(cleanCode)}`
    )

    const result = res.data?.data
    if (!result) {
      toast.error(`Barcode "${cleanCode}" not found in inventory`)
      return
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
      posStore.addToCart(targetProduct, targetVariant, 1)
      toast.success(`Scanned: ${targetProduct.name}`)
    } else {
      toast.error('Could not resolve product from barcode')
    }
  } catch {
    toast.error('Barcode lookup failed')
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

      // Set default seller if none selected
      if (staffMembers.value.length && !posStore.activeSeller) {
        posStore.setSeller(staffMembers.value[0])
      }
    }

    if (deliveryCompaniesRes.status === 'fulfilled') {
      const rawDelCo = (deliveryCompaniesRes.value.data as any)?.data ?? deliveryCompaniesRes.value.data ?? []
      deliveryStore.companies = Array.isArray(rawDelCo) ? rawDelCo : []
    }

    if (deliveryZonesRes.status === 'fulfilled') {
      const rawDelZo = (deliveryZonesRes.value.data as any)?.data ?? deliveryZonesRes.value.data ?? []
      deliveryStore.zones = Array.isArray(rawDelZo) ? rawDelZo : []
    }
  } catch (e) {
    console.error('Failed to load POS catalog data:', e)
    toast.error('Failed to load catalog data')
  } finally {
    if (showLoader) productsLoading.value = false
  }
}

// ============================================================================
// Lifecycle
// ============================================================================

onMounted(() => {
  loadProducts()
  window.addEventListener('keydown', handleGlobalKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeydown)
})
</script>

<template>
  <div class="pos-screen w-full h-[calc(100vh-64px)] flex bg-[#FAF7F2] text-[#1A1C1C] overflow-hidden select-none font-sans">
    <!-- ======================================================================
         LEFT ZONE: Product Catalog & Fast Filter Matrix
         ====================================================================== -->
    <section class="pos-catalog-zone flex-1 flex flex-col min-w-0 border-r border-[#E8E2D9] bg-[#FAF7F2] overflow-hidden">
      <!-- Catalog Top Bar -->
      <header class="p-4 bg-white border-b border-[#E8E2D9] flex items-center justify-between gap-3 shrink-0 shadow-2xs">
        <!-- Fast Search Input -->
        <div class="relative flex-1 max-w-md">
          <Search class="w-4 h-4 text-[#6B6358] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            ref="searchInputRef"
            v-model="searchQuery"
            type="text"
            placeholder="Search items by name, SKU, barcode... (F1)"
            class="w-full pl-9.5 pr-8 py-2.5 rounded-xl border border-[#E8E2D9] bg-[#FAF7F2] text-sm text-[#1A1C1C] placeholder:text-[#6B6358]/70 focus:bg-white focus:border-[#FF8800] focus:ring-2 focus:ring-[#FF8800]/20 outline-hidden transition-all"
          />
          <button
            v-if="searchQuery"
            type="button"
            @click="clearSearch"
            class="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#6B6358] hover:text-[#1A1C1C] rounded-lg transition-colors"
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
            class="px-3 py-2 rounded-xl border border-[#E8E2D9] bg-[#FAF7F2] hover:bg-white text-xs font-bold text-[#1A1C1C] flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
            title="Scan Barcode (F2)"
          >
            <ScanBarcode class="w-4 h-4 text-[#924C00]" />
            <span class="hidden sm:inline">Scanner (F2)</span>
          </button>

          <!-- Active Channel Pill -->
          <div
            class="px-3 py-2 rounded-xl border border-[#FFDCC4] bg-[#FFF9F2] text-xs font-bold text-[#924C00] flex items-center gap-1.5 shadow-2xs"
          >
            <Store class="w-3.5 h-3.5" />
            <span class="max-w-[120px] truncate">{{ activeChannel?.name || 'POS Register' }}</span>
          </div>

          <!-- Active Cashier / Staff Pill -->
          <button
            type="button"
            @click="handleOpenSellerPicker"
            class="px-3 py-2 rounded-xl border border-[#E8E2D9] bg-white hover:bg-[#FAF7F2] text-xs font-bold text-[#1A1C1C] flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
            title="Click to switch cashier / staff"
          >
            <User class="w-3.5 h-3.5 text-[#924C00]" />
            <span class="max-w-[100px] truncate">{{ activeSeller?.name || 'Staff' }}</span>
          </button>
        </div>
      </header>

      <!-- Category Filter Chips (Horizontal Smooth Scroll) -->
      <div class="px-4 py-2.5 bg-[#FAF7F2] border-b border-[#E8E2D9] flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
        <button
          v-for="chip in categoryChips"
          :key="chip.id"
          type="button"
          @click="handleCategorySelect(chip.name)"
          :class="[
            'px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shadow-2xs cursor-pointer shrink-0 flex items-center gap-1.5',
            (selectedCategory === chip.name || (chip.name === 'All Products' && !selectedCategory))
              ? 'bg-[#924C00] text-white border border-[#924C00] ring-2 ring-[#924C00]/20'
              : 'bg-white text-[#6B6358] border border-[#E8E2D9] hover:text-[#1A1C1C] hover:bg-[#FFF9F2]'
          ]"
        >
          <span>{{ chip.name }}</span>
          <span
            :class="[
              'px-1.5 py-0.2 rounded-md text-3xs font-mono',
              (selectedCategory === chip.name || (chip.name === 'All Products' && !selectedCategory))
                ? 'bg-white/20 text-white'
                : 'bg-[#FAF7F2] text-[#8C827A]'
            ]"
          >
            {{ chip.count }}
          </span>
        </button>
      </div>

      <!-- Product Catalog Grid -->
      <div class="flex-1 p-4 overflow-y-auto min-h-0">
        <!-- Skeleton Loading State -->
        <div
          v-if="productsLoading"
          class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3"
        >
          <div
            v-for="n in 10"
            :key="n"
            class="h-52 rounded-2xl bg-white border border-[#E8E2D9] p-3 flex flex-col justify-between animate-pulse"
          >
            <div class="w-full h-28 rounded-xl bg-[#F0EAE1]" />
            <div class="space-y-2 mt-2">
              <div class="h-3.5 bg-[#F0EAE1] rounded-md w-3/4" />
              <div class="h-4 bg-[#F0EAE1] rounded-md w-1/2" />
            </div>
          </div>
        </div>

        <!-- Empty Products State -->
        <div
          v-else-if="filteredProducts.length === 0"
          class="h-full flex flex-col items-center justify-center text-center p-8 space-y-3"
        >
          <div class="w-14 h-14 rounded-2xl bg-[#FFF3E0] border border-[#FFDCC4] flex items-center justify-center text-[#924C00]">
            <Package class="w-7 h-7" />
          </div>
          <div>
            <h3 class="text-base font-bold text-[#1A1C1C] font-display">No products found</h3>
            <p class="text-xs text-[#6B6358] max-w-sm mt-1">
              No products match "{{ searchQuery }}". Try adjusting your search query or selecting a different category.
            </p>
          </div>
          <button
            type="button"
            @click="clearSearch"
            class="px-4 py-2 rounded-xl bg-white border border-[#E8E2D9] text-xs font-bold text-[#1A1C1C] hover:bg-[#FAF7F2] transition-colors"
          >
            Clear Filters
          </button>
        </div>

        <!-- High-Density Product Card Grid -->
        <div
          v-else
          class="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5 gap-3"
        >
          <div
            v-for="product in filteredProducts"
            :key="product.id"
            @click="handleProductClick(product)"
            :class="[
              'group relative rounded-xl bg-white border p-2.5 flex flex-col justify-between transition-all duration-150 shadow-xs hover:shadow-md hover:border-cta hover:-translate-y-0.5 cursor-pointer active:scale-[0.98]',
              getProductCartCount(product.id) > 0
                ? 'border-cta ring-2 ring-cta/25 bg-[#FFFDF9]'
                : 'border-border',
              getProductStock(product) <= 0 ? 'opacity-60 grayscale-[30%]' : ''
            ]"
          >
            <!-- In-Cart Badge Pill (Floating Top-Right) -->
            <div
              v-if="getProductCartCount(product.id) > 0"
              class="absolute -top-1.5 -right-1.5 z-20 px-2 py-0.5 rounded-full bg-cta text-[#1A1C1C] font-black text-[10px] shadow-sm border-2 border-white font-mono flex items-center gap-1 animate-in zoom-in-50"
            >
              <ShoppingBag :size="10" />
              <span>{{ getProductCartCount(product.id) }}</span>
            </div>

            <!-- Product Image / Thumbnail Area -->
            <div class="relative w-full h-26 rounded-lg bg-gradient-to-b from-[#FAF7F2] to-[#F3ECE2] border border-border/80 overflow-hidden flex items-center justify-center shrink-0 mb-2">
              <img
                v-if="product.image_url"
                :src="product.image_url"
                :alt="product.name"
                class="w-full h-full object-cover group-hover:scale-108 transition-transform duration-300"
                loading="lazy"
              />
              <div v-else class="flex flex-col items-center justify-center gap-0.5 text-primary/60 group-hover:scale-108 transition-transform duration-300">
                <Package class="w-7 h-7 stroke-[1.5]" />
                <span class="text-[9px] font-bold font-mono tracking-wider uppercase text-muted-foreground/80">
                  {{ product.name.slice(0, 3) }}
                </span>
              </div>

              <!-- Top Left: Multi-variant Pill Indicator -->
              <span
                v-if="product.variants && product.variants.length > 1"
                class="absolute top-1.5 left-1.5 px-1.5 py-0.5 text-[9.5px] font-bold rounded bg-white/95 backdrop-blur-xs text-primary border border-[#FFDCC4] shadow-xs flex items-center gap-0.5"
              >
                <span>{{ product.variants.length }}</span>
                <span>Variants</span>
              </span>

              <!-- Bottom Left: Stock Pill Indicator -->
              <span
                :class="[
                  'absolute bottom-1.5 left-1.5 px-1.5 py-0.5 text-[9.5px] font-semibold rounded shadow-xs flex items-center gap-1',
                  getProductStock(product) <= 0
                    ? 'bg-red-50 text-red-700 border border-red-200'
                    : getProductStock(product) <= 5
                      ? 'bg-amber-50 text-amber-800 border border-amber-200'
                      : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                ]"
              >
                <span
                  class="w-1.5 h-1.5 rounded-full shrink-0"
                  :class="[
                    getProductStock(product) <= 0
                      ? 'bg-red-500'
                      : getProductStock(product) <= 5
                        ? 'bg-amber-500 animate-pulse'
                        : 'bg-emerald-500'
                  ]"
                />
                <span class="font-mono">{{ getProductStock(product) <= 0 ? 'Out of stock' : `${getProductStock(product)} in stock` }}</span>
              </span>
            </div>

            <!-- Product Metadata -->
            <div class="flex-1 flex flex-col justify-between">
              <div>
                <div v-if="product.category?.name" class="text-[9px] font-bold uppercase tracking-wider text-muted-foreground truncate">
                  {{ product.category.name }}
                </div>
                <h4 class="text-xs font-bold text-foreground line-clamp-2 leading-snug group-hover:text-primary transition-colors mt-0.5">
                  {{ product.name }}
                </h4>
                <div class="text-[10px] font-mono text-muted-foreground/80 mt-0.5 truncate">
                  SKU: {{ product.sku || product.variants?.[0]?.sku || 'N/A' }}
                </div>
              </div>

              <!-- Price & Tactile Add Action Footer -->
              <div class="pt-2 flex items-center justify-between border-t border-border/70 mt-2">
                <div>
                  <div class="text-[8.5px] uppercase font-bold text-muted-foreground/80 leading-none">Price</div>
                  <span class="text-sm font-bold font-display text-foreground tracking-tight">
                    {{ formatMoney(product.variants?.[0]?.selling_price ?? product.selling_price) }}
                  </span>
                </div>

                <button
                  type="button"
                  class="h-7 px-2.5 rounded-md bg-surface border border-border group-hover:bg-cta group-hover:border-cta group-hover:text-[#1A1C1C] text-foreground font-semibold text-[11px] flex items-center gap-1 transition-all shadow-xs"
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
         RIGHT ZONE: Persistent Transaction Cart & Checkout Engine
         ====================================================================== -->
    <aside class="pos-cart-zone w-[410px] xl:w-[440px] flex flex-col bg-white border-l border-[#E8E2D9] h-full shrink-0 shadow-lg">
      <!-- Cart Header & Tabs Bar -->
      <div class="p-3 bg-[#FAF7F2] border-b border-[#E8E2D9] space-y-2.5 shrink-0">
        <!-- Multi-Cart Tabs -->
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar flex-1">
            <button
              v-for="tab in posStore.tabs"
              :key="tab.id"
              type="button"
              @click="posStore.switchTab(tab.id)"
              :class="[
                'px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer',
                posStore.activeTabId === tab.id
                  ? 'bg-white text-[#924C00] border border-[#E8E2D9] shadow-2xs ring-1 ring-[#924C00]/20'
                  : 'bg-transparent text-[#6B6358] hover:bg-white/50'
              ]"
            >
              <span>{{ tab.name }}</span>
              <span
                v-if="tab.items.length > 0"
                class="w-4 h-4 rounded-full bg-[#924C00] text-white text-3xs font-mono flex items-center justify-center font-bold"
              >
                {{ tab.items.reduce((s, i) => s + i.quantity, 0) }}
              </span>
            </button>

            <!-- Add Cart Tab Button -->
            <button
              type="button"
              @click="posStore.createTab()"
              class="p-1.5 rounded-xl text-[#6B6358] hover:text-[#1A1C1C] hover:bg-white border border-transparent hover:border-[#E8E2D9] transition-all cursor-pointer"
              title="Open new cart tab"
            >
              <Plus class="w-4 h-4" />
            </button>
          </div>

          <!-- Parked Orders Quick Trigger -->
          <button
            type="button"
            @click="showHoldOrdersModal = true"
            class="px-2.5 py-1.5 rounded-xl border border-[#E8E2D9] bg-white text-xs font-bold text-[#6B6358] hover:text-[#924C00] flex items-center gap-1 shadow-2xs cursor-pointer transition-colors"
            title="View Parked Orders (F6)"
          >
            <Clock class="w-3.5 h-3.5 text-[#924C00]" />
            <span>Held ({{ posStore.heldOrders.length }})</span>
          </button>
        </div>

        <!-- Customer Loyalty Chip Bar -->
        <div class="flex items-center justify-between p-2 rounded-xl bg-white border border-[#E8E2D9] shadow-2xs">
          <div
            v-if="posStore.customer"
            class="flex items-center gap-2 min-w-0"
          >
            <div class="w-7 h-7 rounded-full bg-[#924C00] text-white flex items-center justify-center text-xs font-bold shrink-0">
              {{ posStore.customer.name.charAt(0).toUpperCase() }}
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-1.5">
                <span class="text-xs font-bold text-[#1A1C1C] truncate">{{ posStore.customer.name }}</span>
                <span class="px-1.5 py-0.2 text-3xs font-semibold rounded-full bg-amber-50 text-amber-800 border border-amber-200 shrink-0">
                  {{ posStore.customer.loyalty_tier || 'Bronze' }}
                </span>
              </div>
              <span class="text-3xs text-[#6B6358] font-mono">{{ posStore.customer.phone || 'Member' }}</span>
            </div>
          </div>

          <div v-else class="flex items-center gap-2 text-xs text-[#6B6358]">
            <User class="w-4 h-4 text-[#924C00]" />
            <span>Walk-in Customer</span>
          </div>

          <button
            type="button"
            @click="handleOpenCustomerModal"
            class="px-2.5 py-1 rounded-lg text-xs font-bold text-[#924C00] bg-[#FFF3E0] hover:bg-[#FFE7D1] border border-[#FFDCC4] transition-colors cursor-pointer shrink-0"
          >
            {{ posStore.customer ? 'Change (F3)' : '+ Add Customer (F3)' }}
          </button>
        </div>
      </div>

      <!-- Cart Items Scrollable List -->
      <div class="flex-1 p-3 overflow-y-auto space-y-2 min-h-0">
        <!-- Empty Cart State -->
        <div
          v-if="posStore.isCartEmpty"
          class="h-full flex flex-col items-center justify-center text-center p-6 space-y-2 text-[#6B6358]"
        >
          <div class="w-12 h-12 rounded-2xl bg-[#FAF7F2] border border-[#E8E2D9] flex items-center justify-center text-[#924C00]/40">
            <ShoppingBag class="w-6 h-6" />
          </div>
          <p class="text-sm font-bold text-[#1A1C1C]">Transaction Cart Empty</p>
          <p class="text-xs max-w-[220px]">
            Scan a barcode or tap products from catalog to start sale.
          </p>
        </div>

        <!-- Line Item Rows -->
        <div
          v-for="item in posStore.items"
          :key="item.id"
          class="p-2.5 rounded-xl border border-[#E8E2D9] bg-[#FAF7F2] hover:bg-white hover:border-[#FF8800] transition-all space-y-2 group shadow-2xs"
        >
          <!-- Top Row: Name, SKU, Total -->
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0 flex-1">
              <h5 class="text-xs font-bold text-[#1A1C1C] leading-snug break-words">
                {{ item.name }}
              </h5>
              <div class="flex items-center gap-2 text-3xs text-[#6B6358] font-mono mt-0.5">
                <span>{{ formatMoney(item.price) }} each</span>
                <span v-if="item.variant_name" class="italic text-[#924C00]">· {{ item.variant_name }}</span>
              </div>
            </div>

            <!-- Line Total -->
            <div class="text-right shrink-0">
              <span class="text-sm font-bold font-display text-[#1A1C1C]">
                {{ formatMoney(posStore.getLineTotal(item)) }}
              </span>
            </div>
          </div>

          <!-- Bottom Row: Stepper, Discount Pill, Note Trigger, Remove -->
          <div class="flex items-center justify-between gap-2 pt-1 border-t border-[#E8E2D9]/70">
            <!-- Numeric Stepper -->
            <div class="flex items-center border border-[#E8E2D9] rounded-lg bg-white p-0.5 shadow-2xs">
              <button
                type="button"
                class="w-6 h-6 flex items-center justify-center rounded-md text-[#6B6358] hover:text-[#1A1C1C] hover:bg-[#FAF7F2] transition-colors cursor-pointer"
                @click="posStore.updateQuantity(item.id, item.quantity - 1)"
              >
                <Minus class="w-3 h-3" />
              </button>
              <span class="w-7 text-center text-xs font-bold font-mono text-[#1A1C1C]">
                {{ item.quantity }}
              </span>
              <button
                type="button"
                class="w-6 h-6 flex items-center justify-center rounded-md text-[#6B6358] hover:text-[#1A1C1C] hover:bg-[#FAF7F2] transition-colors cursor-pointer"
                @click="posStore.updateQuantity(item.id, item.quantity + 1)"
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
                    ? 'bg-[#FFF3E0] text-[#924C00] border-[#FFDCC4]'
                    : 'bg-white text-[#6B6358] border-[#E8E2D9] hover:bg-[#FAF7F2]'
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
                class="p-1 rounded-lg bg-[#FFF3E0] text-[#924C00] border border-[#FFDCC4] text-3xs font-bold"
                :title="item.notes"
              >
                <FileText class="w-3 h-3" />
              </button>

              <!-- Remove Item Button -->
              <button
                type="button"
                @click="posStore.removeItem(item.id)"
                class="p-1 text-[#6B6358] hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                title="Remove item"
              >
                <Trash2 class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Cart Financial Summary & Checkout CTA -->
      <footer class="p-4 bg-[#FAF7F2] border-t border-[#E8E2D9] space-y-3 shrink-0">
        <!-- Breakdown Rows -->
        <div class="space-y-1.5 text-xs text-[#6B6358]">
          <div class="flex justify-between">
            <span>Subtotal ({{ posStore.itemCount }} items)</span>
            <span class="font-mono text-[#1A1C1C]">{{ formatMoney(posStore.subtotal) }}</span>
          </div>

          <div v-if="posStore.orderDiscountAmount > 0" class="flex justify-between text-amber-800 font-medium">
            <span>Cart Discount</span>
            <span class="font-mono">-{{ formatMoney(posStore.orderDiscountAmount) }}</span>
          </div>

          <div v-if="posStore.taxAmount > 0" class="flex justify-between">
            <span>Estimated Tax ({{ posStore.taxRate }}%)</span>
            <span class="font-mono text-[#1A1C1C]">{{ formatMoney(posStore.taxAmount) }}</span>
          </div>

          <div v-if="posStore.isDelivery && posStore.deliveryFee > 0" class="flex justify-between">
            <span>Delivery Fee</span>
            <span class="font-mono text-[#1A1C1C]">{{ formatMoney(posStore.deliveryFee) }}</span>
          </div>

          <!-- Bold Grand Total -->
          <div class="flex justify-between items-baseline pt-2 border-t border-[#E8E2D9]">
            <span class="text-sm font-bold text-[#1A1C1C] font-display uppercase tracking-tight">Grand Total</span>
            <span class="text-2xl font-black text-[#1A1C1C] font-display">
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
            class="px-3.5 py-3 rounded-xl border border-[#E8E2D9] bg-white text-xs font-bold text-[#1A1C1C] hover:bg-[#FAF7F2] transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs flex items-center justify-center gap-1.5"
            title="Park current cart (F4)"
          >
            <Clock class="w-4 h-4 text-[#924C00]" />
            <span>Hold (F4)</span>
          </button>

          <!-- Clear Cart -->
          <button
            type="button"
            @click="handleClearActiveCart"
            :disabled="posStore.isCartEmpty"
            class="px-3 py-3 rounded-xl border border-[#E8E2D9] bg-white text-[#6B6358] hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs"
            title="Clear active cart"
          >
            <Trash2 class="w-4 h-4" />
          </button>

          <!-- Vibrant Retail Orange Checkout CTA -->
          <button
            type="button"
            @click="handleOpenCheckout"
            :disabled="posStore.isCartEmpty"
            class="flex-1 py-3 px-4 rounded-xl bg-[#FF8800] text-[#1A1C1C] font-bold text-sm hover:bg-[#E67A00] transition-all flex items-center justify-center gap-2 shadow-md disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer active:scale-98"
          >
            <CheckCircle2 class="w-4 h-4 stroke-[2.5]" />
            <span>Checkout (F8)</span>
          </button>
        </div>
      </footer>
    </aside>

    <!-- ======================================================================
         MODALS & OVERLAYS
         ====================================================================== -->

    <!-- 1. Product Variant Selector Modal -->
    <PosVariantModal
      v-model:open="showVariantModal"
      :product="selectedVariantProduct"
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
      :loading="checkoutLoading"
      @update:delivery="(val) => posStore.setDelivery({ isDelivery: val })"
      @update:delivery-address="(val) => posStore.setDelivery({ isDelivery: posStore.isDelivery, address: val })"
      @update:delivery-region="(val) => posStore.setDelivery({ isDelivery: posStore.isDelivery, region: val })"
      @update:delivery-company="(val) => posStore.setDelivery({ isDelivery: posStore.isDelivery, companyId: val })"
      @update:delivery-zone="(val) => posStore.setDelivery({ isDelivery: posStore.isDelivery, zoneId: val })"
      @update:discount-type="(val) => posStore.setOrderDiscount(val, posStore.discountValue)"
      @update:discount-value="(val) => posStore.setOrderDiscount(posStore.discountType, val)"
      @update:tax-rate="(val) => posStore.setTaxRate(val)"
      @update:tendered="(val) => posStore.setTenderedAmount(val)"
      @update:payment-method="(val) => posStore.setPaymentMethod(val)"
      @update:notes="(val) => posStore.setOrderNotes(val)"
      @complete="handleCompleteCheckout"
    />

    <!-- 3. In-App 80mm Thermal Receipt Preview Modal -->
    <PosReceiptModal
      v-model:open="showReceiptModal"
      :order="completedOrder"
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
      :selected-id="posStore.activeSeller?.id ?? null"
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

    <!-- 9. Barcode Scanner Input Modal -->
    <Dialog v-model:open="showScannerInput">
      <DialogContent class="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Scan / Enter Barcode</DialogTitle>
        </DialogHeader>
        <Input
          v-model="barcodeInput"
          ref="barcodeInputRef"
          placeholder="Type or scan barcode…"
          autofocus
          @keydown.enter="handleManualBarcodeSubmit"
        />
        <DialogFooter>
          <Button variant="outline" @click="showScannerInput = false">Cancel</Button>
          <Button @click="handleManualBarcodeSubmit">Add to Cart</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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