<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import {
  X,
  Banknote,
  Truck,
  Check,
  Receipt,
  Share2,
  AlertTriangle,
} from 'lucide-vue-next'
import api from '@/api/axios'
import { useToast } from '@/composables/useToast'
import type { CartItem } from '@/stores/posStore'
import DeliveryCompanyPickerModal from './DeliveryCompanyPickerModal.vue'
import DeliveryZonePickerModal from './DeliveryZonePickerModal.vue'
import CustomerLookupRow from './CustomerLookupRow.vue'
import SocialPlatformIcon, { getPlatformMeta } from './SocialPlatformIcon.vue'
import BankBrandIcon from './BankBrandIcon.vue'
import { calculateLoyalty } from '@/utils/loyalty'

export interface SalesChannel {
  id: string
  name: string
  platform: 'telegram' | 'facebook' | 'instagram' | 'tiktok' | 'pos' | 'web' | 'online' | string
  code?: string
  type?: string
  image_url?: string
  is_active?: boolean
  is_default?: boolean
}

export interface DeliveryCompany {
  id: string
  name: string
  phone?: string
  email?: string
  website?: string
  is_active: boolean
}

export interface DeliveryZone {
  id: string
  company_id?: string | null
  company_name?: string | null
  name?: string
  zone_name?: string
  cost?: number | string
  fee?: number | string
  estimated_days?: string
  is_active?: boolean
}

interface Props {
  open: boolean
  subtotal: number
  discountType?: 'none' | 'percentage' | 'flat'
  discountValue?: number
  taxRate?: number
  taxAmount?: number
  deliveryFee?: number
  total: number
  change?: number
  paymentMethod?: string
  selectedBankAccountId?: string | null
  tenderedAmount?: number
  isDelivery?: boolean
  deliveryAddress?: string
  deliveryRegion?: string
  customerName?: string
  customerPhone?: string
  customerLoyaltyTier?: string
  deliveryCompanyId?: string | null
  deliveryZoneId?: string | null
  companies?: DeliveryCompany[]
  zones?: DeliveryZone[]
  loading?: boolean
  activeSeller?: { id: number | string; name: string; role?: string } | null
  isSellingOnBehalf?: boolean
  channels?: SalesChannel[]
  selectedChannelId?: string | null
  cartItems?: CartItem[]
}

const props = withDefaults(defineProps<Props>(), {
  open: false,
  discountType: 'none',
  discountValue: 0,
  taxRate: 0,
  taxAmount: 0,
  deliveryFee: 0,
  change: 0,
  paymentMethod: 'Cash',
  selectedBankAccountId: null,
  tenderedAmount: 0,
  isDelivery: false,
  deliveryAddress: '',
  deliveryRegion: '',
  customerName: '',
  customerPhone: '',
  customerLoyaltyTier: '',
  companies: () => [],
  zones: () => [],
  loading: false,
  activeSeller: null,
  isSellingOnBehalf: false,
  channels: () => [],
  selectedChannelId: null,
  cartItems: () => [],
})

const emit = defineEmits<{
  'update:open': [value: boolean]
  'update:delivery': [value: boolean]
  'update:delivery-address': [value: string]
  'update:delivery-region': [value: string]
  'update:delivery-company': [value: string | null]
  'update:delivery-zone': [value: string | null]
  'update:delivery-fee': [value: number]
  'update:customer-name': [value: string]
  'update:customer-phone': [value: string]
  'update:discount-type': [value: 'none' | 'percentage' | 'flat']
  'update:discount-value': [value: number]
  'update:tax-rate': [value: number]
  'update:notes': [value: string]
  'update:tendered': [value: number]
  'update:payment-method': [value: string]
  'update:bank-account-id': [value: string | null]
  'update:channel-id': [value: string]
  'open-seller-picker': []
  'reset-seller': []
  'complete': []
  'cancel': []
}>()

export interface BankAccount {
  id: string
  bank_name: string
  account_name: string
  account_number: string
  qr_code_url?: string | null
  qr_image_url?: string | null
  is_active?: boolean
  is_default?: boolean
  currency?: string
  color?: string | null
  logo_icon?: string | null
}

export interface CustomerSuggestion {
  id: string
  name: string
  phone: string
  loyalty_tier?: string
  total_spent?: number | string
  address?: string
  delivery_address?: string
  region?: string
  email?: string
}

const toast = useToast()

// Local modal state
const localTendered = ref<number>(0)
const localNotes = ref<string>('')
const openCompanyPicker = ref(false)
const openZonePicker = ref(false)

// Sales Channels State & Helpers
const availableChannels = computed(() => {
  const list = Array.isArray(props.channels) ? props.channels : []
  return list.filter((c) => c.is_active !== false)
})

const currentSelectedChannel = computed(() => {
  if (props.selectedChannelId) {
    const found = availableChannels.value.find((c) => String(c.id) === String(props.selectedChannelId))
    if (found) return found
  }
  const def = availableChannels.value.find((c) => c.is_default)
  return def || availableChannels.value[0] || null
})

const isWalkInChannel = computed(() => {
  const ch = currentSelectedChannel.value
  if (!ch) return true
  const platform = (ch.platform || ch.type || '').toLowerCase().trim()
  const name = (ch.name || '').toLowerCase().trim()
  return platform === 'pos' || name.includes('walk-in') || name.includes('in-store') || name.includes('counter')
})

function handleSelectChannel(channelId: string) {
  emit('update:channel-id', channelId)
  const ch = availableChannels.value.find((c) => String(c.id) === String(channelId))
  if (ch) {
    const platform = (ch.platform || ch.type || '').toLowerCase().trim()
    const name = (ch.name || '').toLowerCase().trim()
    const isWalkIn = platform === 'pos' || name.includes('walk-in') || name.includes('in-store') || name.includes('counter')
    if (isWalkIn) {
      emit('update:delivery', false)
    } else {
      emit('update:delivery', true)
    }
  }
}

// Watch for channel changes and automatically set delivery mode
watch(
  () => isWalkInChannel.value,
  (isWalkIn) => {
    if (isWalkIn) {
      emit('update:delivery', false)
    } else {
      emit('update:delivery', true)
    }
  }
)

// Stock Pre-flight Verification
const overStockedItems = computed(() => {
  const list = Array.isArray(props.cartItems) ? props.cartItems : []
  return list.filter((i) => i.max_stock !== undefined && i.max_stock !== null && i.quantity > i.max_stock)
})

// Dynamic Bank Accounts
const bankAccounts = ref<BankAccount[]>([])
const selectedBankId = ref<string>('')
const bankSearchQuery = ref<string>('')

const filteredBankAccounts = computed(() => {
  if (!bankSearchQuery.value.trim()) return bankAccounts.value
  const q = bankSearchQuery.value.toLowerCase().trim()
  return bankAccounts.value.filter(
    (b) =>
      b.bank_name.toLowerCase().includes(q) ||
      b.account_name?.toLowerCase().includes(q) ||
      b.account_number?.toLowerCase().includes(q)
  )
})

const selectedBank = computed<BankAccount | null>(() => {
  if (bankAccounts.value.length === 0) return null
  return bankAccounts.value.find((b) => b.id === selectedBankId.value) || bankAccounts.value[0] || null
})

function getBankCategory(b: BankAccount | null): 'CASH' | 'CARD' | 'QR' {
  if (!b) return 'CASH'
  const name = (b.bank_name || '').toLowerCase()
  const accName = (b.account_name || '').toLowerCase()
  if (name.includes('cash') || accName.includes('cash') || name.includes('drawer') || name.includes('register')) {
    return 'CASH'
  }
  if (name.includes('card') || name.includes('visa') || name.includes('mastercard') || name.includes('terminal') || name.includes('eft') || name.includes('pos')) {
    return 'CARD'
  }
  return 'QR'
}

const isCashSelected = computed(() => {
  return getBankCategory(selectedBank.value) === 'CASH'
})

function selectBankAccount(b: BankAccount) {
  selectedBankId.value = b.id
  emit('update:bank-account-id', b.id === 'cash' ? null : b.id)
  emit('update:payment-method', b.bank_name)
  if (getBankCategory(b) === 'CASH' && (localTendered.value === 0 || localTendered.value < props.total)) {
    localTendered.value = props.total
    emit('update:tendered', props.total)
  }
}

async function fetchBankAccounts() {
  const defaultCash: BankAccount = {
    id: 'cash',
    bank_name: 'Cash',
    account_name: 'Cash Drawer',
    account_number: '',
    is_active: true,
  }

  try {
    const res = await api.get('/bank-accounts')
    const list = res.data?.data || res.data || []
    const activeList = (Array.isArray(list) ? list : []).filter((b: any) => b.is_active !== false)
    
    // Ensure Cash is ALWAYS present as a payment option
    const hasCash = activeList.some((b: any) => {
      const name = (b.bank_name || '').toLowerCase()
      return name === 'cash' || name.includes('cash') || name.includes('drawer')
    })

    const combined = hasCash ? activeList : [defaultCash, ...activeList]
    bankAccounts.value = combined

    // 1. Highest priority: The account flagged as default in the payment methods data
    const defaultAccount = bankAccounts.value.find((b: any) => b.is_default || b.isDefault)

    // 2. Second priority: If an explicit bank account ID was selected
    const explicitIdMatch = props.selectedBankAccountId
      ? bankAccounts.value.find(b => b.id === props.selectedBankAccountId)
      : null

    // Determine target selection (default from DB takes priority)
    const target = defaultAccount || explicitIdMatch || (props.paymentMethod ? bankAccounts.value.find(b => b.bank_name.toLowerCase() === props.paymentMethod?.toLowerCase()) : null) || bankAccounts.value[0]

    if (target) {
      selectedBankId.value = target.id
      selectBankAccount(target)
    }
  } catch (e) {
    bankAccounts.value = [
      defaultCash,
      { id: 'aba-khqr', bank_name: 'ABA Bank', account_name: 'ABA PayWay KHQR', account_number: '000 123 456', is_default: false, is_active: true },
      { id: 'acleda-bank', bank_name: 'ACLEDA Bank', account_name: 'ACLEDA Mobile', account_number: '000 789 012', is_default: false, is_active: true },
      { id: 'wing-bank', bank_name: 'Wing Bank', account_name: 'Wing KHQR', account_number: '000 345 678', is_default: false, is_active: true },
      { id: 'card-pos', bank_name: 'Credit Card', account_name: 'Card Terminal EFT', account_number: 'EFT-01', is_default: false, is_active: true },
    ]
    const def = bankAccounts.value.find((b: any) => b.is_default || b.isDefault) || bankAccounts.value[0]
    if (def) {
      selectedBankId.value = def.id
      selectBankAccount(def)
    }
  }
}

// Customer Option Mode: 'walk-in' | 'existing' | 'custom'
const customerOption = ref<'walk-in' | 'existing' | 'custom'>('walk-in')
const customerSearchText = ref('')


function setCustomerOption(opt: 'walk-in' | 'existing' | 'custom') {
  customerOption.value = opt
  if (opt === 'walk-in') {
    customerPhoneInput.value = ''
    customerNameInput.value = ''
    customerSearchText.value = ''
    emit('update:customer-phone', '')
    emit('update:customer-name', '')
  } else if (opt === 'existing') {
    customerSearchText.value = customerPhoneInput.value || customerNameInput.value || ''
  }
}

// Inline Customer Search (Phone first, auto-populates Name and Address)
const customerPhoneInput = ref(props.customerPhone || '')
const customerNameInput = ref(props.customerName || '')
const customerSuggestions = ref<CustomerSuggestion[]>([])
const showSuggestions = ref(false)
const matchedCustomer = ref<any>(null)
const lookupStatus = ref<'idle' | 'searching' | 'found' | 'not_found' | 'error'>('idle')
let customerSearchTimeout: ReturnType<typeof setTimeout> | null = null

function handlePhoneSearchInput(val: string) {
  customerPhoneInput.value = val
  emit('update:customer-phone', val)
  if (matchedCustomer.value && matchedCustomer.value.phone !== val) {
    matchedCustomer.value = null
  }
  if (customerSearchTimeout) clearTimeout(customerSearchTimeout)
  if (!val.trim() || val.length < 2) {
    customerSuggestions.value = []
    showSuggestions.value = false
    lookupStatus.value = 'idle'
    return
  }
  lookupStatus.value = 'searching'
  customerSearchTimeout = setTimeout(async () => {
    try {
      const res = await api.get('/customers', { params: { search: val, limit: 8 } })
      const list = res.data?.data || res.data || []
      customerSuggestions.value = Array.isArray(list) ? list : []
      showSuggestions.value = customerSuggestions.value.length > 0
      lookupStatus.value = customerSuggestions.value.length > 0 ? 'found' : 'not_found'
    } catch {
      customerSuggestions.value = []
      showSuggestions.value = false
      lookupStatus.value = 'error'
    }
  }, 250)
}

function handleNameInput(val: string) {
  customerNameInput.value = val
  emit('update:customer-name', val)
  if (matchedCustomer.value && matchedCustomer.value.name !== val) {
    matchedCustomer.value = null
  }
  if (customerSearchTimeout) clearTimeout(customerSearchTimeout)
  if (!val.trim() || val.length < 2) {
    if (!customerPhoneInput.value) {
      customerSuggestions.value = []
      showSuggestions.value = false
      lookupStatus.value = 'idle'
    }
    return
  }
  lookupStatus.value = 'searching'
  customerSearchTimeout = setTimeout(async () => {
    try {
      const res = await api.get('/customers', { params: { search: val, limit: 8 } })
      const list = res.data?.data || res.data || []
      customerSuggestions.value = Array.isArray(list) ? list : []
      showSuggestions.value = customerSuggestions.value.length > 0
      lookupStatus.value = customerSuggestions.value.length > 0 ? 'found' : 'not_found'
    } catch {
      customerSuggestions.value = []
      showSuggestions.value = false
      lookupStatus.value = 'error'
    }
  }, 250)
}

function selectCustomerSuggestion(c: CustomerSuggestion | any) {
  matchedCustomer.value = c
  customerPhoneInput.value = c.phone || ''
  customerNameInput.value = c.name || ''
  customerSearchText.value = `${c.name} (${c.phone || ''})`
  customerOption.value = 'existing'
  lookupStatus.value = 'found'
  emit('update:customer-phone', c.phone || '')
  emit('update:customer-name', c.name || '')

  const savedAddress = c.delivery_address || c.address || ''
  if (savedAddress) {
    emit('update:delivery-address', savedAddress)
  }
  if (c.region) {
    emit('update:delivery-region', c.region)
  }
  showSuggestions.value = false
  customerSuggestions.value = []
  toast.success(`Loaded customer: ${c.name}`)
}

function handleResetCustomer() {
  customerPhoneInput.value = ''
  customerNameInput.value = ''
  matchedCustomer.value = null
  customerSuggestions.value = []
  showSuggestions.value = false
  lookupStatus.value = 'idle'
  customerSearchText.value = ''
  customerOption.value = 'walk-in'
  emit('update:customer-phone', '')
  emit('update:customer-name', '')
}

// Sync from props
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      localTendered.value = props.tenderedAmount > 0 ? props.tenderedAmount : props.total
      customerPhoneInput.value = props.customerPhone || ''
      customerNameInput.value = props.customerName || ''
      
      // Ensure the selected channel is properly in sync
      if (!props.selectedChannelId && currentSelectedChannel.value) {
        emit('update:channel-id', currentSelectedChannel.value.id)
      }

      // Ensure delivery mode corresponds to the selected sales channel
      if (!isWalkInChannel.value) {
        emit('update:delivery', true)
      }

      if (props.customerPhone || props.customerName) {
        if (props.customerLoyaltyTier) {
          customerOption.value = 'existing'
          customerSearchText.value = props.customerPhone || props.customerName || ''
        } else {
          customerOption.value = 'custom'
        }
      } else {
        customerOption.value = 'walk-in'
        customerSearchText.value = ''
      }
      bankSearchQuery.value = ''
      fetchBankAccounts()
    }
  },
  { immediate: true }
)

watch(
  () => props.customerPhone,
  (newPhone) => {
    customerPhoneInput.value = newPhone || ''
    if (newPhone && customerOption.value === 'walk-in') {
      customerOption.value = 'custom'
    }
  }
)

watch(
  () => props.customerName,
  (newName) => {
    customerNameInput.value = newName || ''
    if (newName && customerOption.value === 'walk-in') {
      customerOption.value = 'custom'
    }
  }
)

watch(
  () => props.total,
  (newTotal) => {
    if (isCashSelected.value && (localTendered.value === 0 || localTendered.value < newTotal)) {
      localTendered.value = newTotal
    }
  }
)

function formatMoney(amount: number | string | undefined | null): string {
  if (amount == null) return '$0.00'
  const val = typeof amount === 'string' ? parseFloat(amount) : amount
  return isNaN(val) ? '$0.00' : `$${val.toFixed(2)}`
}

function setTendered(val: number) {
  localTendered.value = Math.max(0, val)
  emit('update:tendered', localTendered.value)
}

function addTendered(delta: number) {
  setTendered(localTendered.value + delta)
}

// Smart Quick Cash Preset Calculation
const quickCashPresets = computed(() => {
  const t = Math.ceil(props.total)
  const exact = props.total
  const presets: { label: string; value: number }[] = []

  presets.push({ label: `Exact (${formatMoney(exact)})`, value: exact })

  // Standard retail denominations
  const standardBills = [5, 10, 20, 50, 100, 200, 500]
  for (const bill of standardBills) {
    if (bill >= t && bill !== exact && !presets.some((p) => p.value === bill)) {
      presets.push({ label: `$${bill}`, value: bill })
    }
  }

  // Next round 10 or 20
  const next10 = Math.ceil(t / 10) * 10
  if (next10 > exact && !presets.some((p) => p.value === next10)) {
    presets.push({ label: `$${next10}`, value: next10 })
  }

  const next50 = Math.ceil(t / 50) * 50
  if (next50 > exact && !presets.some((p) => p.value === next50)) {
    presets.push({ label: `$${next50}`, value: next50 })
  }

  return presets.slice(0, 5)
})

const changeDue = computed(() => {
  if (isCashSelected.value) {
    return Math.max(0, localTendered.value - props.total)
  }
  return 0
})

const hasCustomerInfo = computed(() => {
  return !!(
    customerPhoneInput.value.trim() ||
    customerNameInput.value.trim() ||
    matchedCustomer.value ||
    props.customerPhone?.trim() ||
    props.customerName?.trim()
  )
})

const canComplete = computed(() => {
  if (props.loading) return false
  if (props.total <= 0) return false
  if (overStockedItems.value.length > 0) return false
  if (isCashSelected.value && localTendered.value < props.total) {
    return false
  }
  if (!isWalkInChannel.value) {
    // 100% need Customer & Loyalty input for online sales channel
    if (!hasCustomerInfo.value) return false
    // Need delivery for sure
    if (!props.isDelivery) return false
    if (!props.deliveryAddress.trim()) return false
  } else {
    // Walk-in: delivery is optional, but if delivery is checked, address is required
    if (props.isDelivery && !props.deliveryAddress.trim()) {
      return false
    }
  }
  return true
})

function handleComplete() {
  if (overStockedItems.value.length > 0) {
    toast.error('Cannot complete checkout: one or more items exceed available stock')
    return
  }

  if (!isWalkInChannel.value) {
    if (!hasCustomerInfo.value) {
      toast.warning('Customer name or phone is required for online sales channels')
      return
    }
    if (!props.isDelivery) {
      toast.warning('Delivery is required for online sales channels')
      return
    }
    if (!props.deliveryAddress.trim()) {
      toast.warning('Please enter a delivery address for the order')
      return
    }
  }

  if (!canComplete.value) {
    if (isCashSelected.value && localTendered.value < props.total) {
      toast.warning('Tendered amount must be at least the total amount')
    } else if (props.isDelivery && !props.deliveryAddress.trim()) {
      toast.warning('Please enter a delivery address')
    }
    return
  }

  emit('update:notes', localNotes.value)
  emit('update:tendered', localTendered.value)
  emit('complete')
}

function close() {
  emit('update:open', false)
  emit('cancel')
}

function handleKeydown(e: KeyboardEvent) {
  if (!props.open) return
  if (e.key === 'Escape') {
    e.preventDefault()
    close()
  } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey || (e.target as HTMLElement)?.tagName !== 'TEXTAREA')) {
    e.preventDefault()
    if (canComplete.value) {
      handleComplete()
    }
  } else if (e.altKey && !isNaN(parseInt(e.key))) {
    const num = parseInt(e.key)
    if (num >= 1 && num <= bankAccounts.value.length) {
      e.preventDefault()
      selectBankAccount(bankAccounts.value[num - 1])
    }
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})

const selectedCompanyName = computed(() => {
  if (!props.deliveryCompanyId) return ''
  const c = props.companies.find((item) => item.id === props.deliveryCompanyId)
  return c?.name || ''
})

const selectedZoneLabel = computed(() => {
  if (!props.deliveryZoneId) return ''
  if (props.deliveryZoneId === 'custom') {
    const feeVal = props.deliveryFee || 0
    return `Custom / Negotiated (${feeVal > 0 ? `$${feeVal.toFixed(2)}` : 'Free'})`
  }
  const z = props.zones.find((item) => item.id === props.deliveryZoneId)
  if (!z) return ''
  const zoneName = z.name || z.zone_name || 'Delivery Zone'
  const feeVal = props.deliveryFee !== undefined && props.deliveryFee !== null
    ? props.deliveryFee
    : (parseFloat(String(z.cost ?? z.fee ?? 0)) || 0)
  return `${zoneName} (${feeVal > 0 ? `$${feeVal.toFixed(2)}` : 'Free'})`
})

defineExpose({
  bankAccounts,
  selectedBankId,
  selectedBank,
  quickCashPresets,
  changeDue,
  canComplete,
  isCashSelected,
  selectBankAccount,
  handleComplete,
  close,
  customerPhoneInput,
  customerNameInput,
  selectCustomerSuggestion,
  customerOption,
  setCustomerOption,
  customerSuggestions,
  showSuggestions,
  matchedCustomer,
  lookupStatus,
})
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-100 flex items-center justify-center p-4">
    <!-- Backdrop -->
    <div
      class="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
      @click="close"
    />

    <!-- Modal Dialog -->
    <div
      class="relative w-full max-w-xl rounded-2xl bg-card shadow-2xl border border-border overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in-0 zoom-in-95 duration-150 text-foreground"
    >
      <!-- Modal Header -->
      <div class="px-5 py-3.5 bg-surface-subtle border-b border-border flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg bg-cta-muted border border-border-strong flex items-center justify-center text-primary shadow-2xs">
            <Receipt class="w-4 h-4" />
          </div>
          <div>
            <h3 class="text-sm font-bold text-foreground font-display">Tender & Fast Checkout</h3>
            <p class="text-3xs text-muted-foreground">Select payment method and finalize transaction</p>
          </div>
        </div>

        <button
          type="button"
          @click="close"
          class="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-subtle transition-colors cursor-pointer"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Scrollable Content -->
      <div class="p-5 overflow-y-auto space-y-4 flex-1">
        <!-- Overstock Alert Banner -->
        <div v-if="overStockedItems.length > 0" class="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-300 space-y-1">
          <div class="flex items-center gap-2 font-bold text-xs">
            <AlertTriangle class="w-4 h-4 text-red-500 shrink-0" />
            <span>Stock Limit Exceeded</span>
          </div>
          <p class="text-3xs text-red-600 dark:text-red-400">
            One or more items in cart exceed available inventory. Please adjust quantities before checkout:
          </p>
          <ul class="text-3xs font-mono space-y-0.5 pt-1">
            <li v-for="item in overStockedItems" :key="item.id" class="text-red-700 dark:text-red-300">
              • <strong>{{ item.name }}</strong><span v-if="item.variant_name"> ({{ item.variant_name }})</span>: {{ item.quantity }} in cart, only {{ item.max_stock }} in stock.
            </li>
          </ul>
        </div>

        <!-- Amount Breakdown Card -->
        <div class="p-3.5 rounded-xl bg-surface-subtle border border-border space-y-2">
          <div class="flex items-center justify-between text-xs text-muted-foreground">
            <span>Subtotal</span>
            <span class="font-mono font-bold text-foreground">{{ formatMoney(subtotal) }}</span>
          </div>

          <div v-if="discountValue && discountValue > 0" class="flex items-center justify-between text-xs text-amber-700 dark:text-amber-300">
            <span>Order Discount</span>
            <span class="font-mono font-bold">
              -{{ formatMoney(subtotal * (discountValue / 100)) }} ({{ discountValue }}%)
            </span>
          </div>

          <div v-if="taxRate && taxRate > 0" class="flex items-center justify-between text-xs text-muted-foreground">
            <span>Tax ({{ taxRate }}%)</span>
            <span class="font-mono font-bold text-foreground">+{{ formatMoney(taxAmount) }}</span>
          </div>

          <div v-if="isDelivery && deliveryFee && deliveryFee > 0" class="flex items-center justify-between text-xs text-muted-foreground">
            <span>Delivery Fee</span>
            <span class="font-mono font-bold text-foreground">+{{ formatMoney(deliveryFee) }}</span>
          </div>

          <div class="pt-2 border-t border-border flex items-center justify-between">
            <span class="font-bold text-sm text-foreground">Total Due</span>
            <span class="text-xl font-bold font-mono text-primary">{{ formatMoney(total) }}</span>
          </div>
        </div>

        <!-- Sales Channel (Source Platform / Stream) Selector -->
        <div v-if="availableChannels.length > 0" class="p-3.5 rounded-xl border border-border bg-card space-y-2.5 shadow-2xs">
          <div class="flex items-center gap-2">
            <div class="w-7 h-7 rounded-lg bg-surface-subtle border border-border flex items-center justify-center text-primary">
              <Share2 class="w-3.5 h-3.5" />
            </div>
            <div>
              <span class="text-xs font-bold text-foreground">Sales Channel</span>
              <span class="text-3xs text-muted-foreground block">Order origin platform or stream</span>
            </div>
          </div>

          <!-- Channel Selection Chips -->
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <button
              v-for="chan in availableChannels"
              :key="chan.id"
              type="button"
              @click="handleSelectChannel(chan.id)"
              :class="[
                'p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition-all cursor-pointer shadow-2xs relative',
                String(selectedChannelId || currentSelectedChannel?.id) === String(chan.id)
                  ? 'bg-cta-muted border-cta ring-2 ring-cta/25'
                  : 'bg-surface-subtle border-border hover:bg-card hover:border-border-strong'
              ]"
            >
              <!-- Real Brand Icon in Platform-Tinted Container -->
              <div
                class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border"
                :style="{
                  backgroundColor: getPlatformMeta(chan.platform, chan.name).bg,
                  borderColor: getPlatformMeta(chan.platform, chan.name).border,
                }"
              >
                <SocialPlatformIcon :platform="chan.platform" :name="chan.name" :size="18" />
              </div>

              <div class="min-w-0 flex-1">
                <span class="text-xs font-bold text-foreground truncate block leading-tight">
                  {{ chan.name }}
                </span>
              </div>

              <span v-if="chan.is_default" class="text-[8px] bg-amber-500/20 text-amber-700 dark:text-amber-300 px-1 py-0.5 rounded font-mono font-bold shrink-0">
                DEF
              </span>
            </button>
          </div>
        </div>

        <!-- Sales Representative Attribution (Seller Credit) -->
        <div class="p-3 rounded-xl border border-border bg-card flex items-center justify-between gap-2.5 shadow-2xs">
          <div class="flex items-center gap-2.5 min-w-0">
            <div class="w-8 h-8 rounded-lg bg-cta-muted border border-border-strong flex items-center justify-center text-primary shrink-0 font-bold text-xs uppercase">
              {{ activeSeller?.name ? activeSeller.name.charAt(0) : 'S' }}
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-1.5">
                <span class="text-3xs uppercase font-bold text-muted-foreground tracking-wider">Credited Seller:</span>
                <span
                  v-if="isSellingOnBehalf"
                  class="px-2 py-0.5 rounded-full bg-cta text-cta-foreground text-3xs font-bold uppercase tracking-wider"
                >
                  On Behalf
                </span>
                <span
                  v-else
                  class="px-2 py-0.5 rounded-full bg-success-bg text-success-text border border-success-border text-3xs font-bold uppercase tracking-wider"
                >
                  Direct
                </span>
              </div>
              <span class="text-xs font-bold text-foreground truncate block mt-0.5">
                {{ activeSeller?.name || 'Current User' }}
                <span v-if="activeSeller?.role" class="text-3xs font-normal text-muted-foreground">({{ activeSeller.role }})</span>
              </span>
            </div>
          </div>

          <div class="flex items-center gap-1.5 shrink-0">
            <button
              v-if="isSellingOnBehalf"
              type="button"
              @click="emit('reset-seller')"
              class="px-2 py-1 rounded-lg text-3xs font-bold text-primary bg-cta-muted hover:bg-accent border border-border-strong transition-colors cursor-pointer"
              title="Reset attribution to logged-in user"
            >
              Reset to Me
            </button>
            <button
              type="button"
              @click="emit('open-seller-picker')"
              class="px-2.5 py-1 rounded-lg text-xs font-bold text-foreground bg-surface-subtle hover:bg-card border border-border transition-colors cursor-pointer"
            >
              Change
            </button>
          </div>
        </div>

        <!-- Customer Identification & Loyalty (Mobile Parity) -->
        <CustomerLookupRow
          :phone="customerPhoneInput"
          :name="customerNameInput"
          :matched-customer="matchedCustomer"
          :suggestions="customerSuggestions"
          :status="lookupStatus"
          :loyalty-info="matchedCustomer ? calculateLoyalty(matchedCustomer) : null"
          :required="!isWalkInChannel"
          @update:phone="handlePhoneSearchInput"
          @update:name="handleNameInput"
          @select="selectCustomerSuggestion"
          @dismiss-suggestions="showSuggestions = false"
          @reset="handleResetCustomer"
        />

        <!-- Payment Method Selection -->
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <label class="block text-xs font-bold text-foreground">Select Payment Method</label>
            <span class="text-[10px] text-muted-foreground font-mono">
              {{ filteredBankAccounts.length }} / {{ bankAccounts.length }} Method{{ bankAccounts.length === 1 ? '' : 's' }}
            </span>
          </div>

          <!-- Quick Search Filter if multiple bank accounts exist -->
          <div v-if="bankAccounts.length > 6" class="relative">
            <input
              v-model="bankSearchQuery"
              type="text"
              placeholder="Search payment method..."
              class="w-full px-3 py-1 rounded-lg border border-input bg-surface-subtle text-2xs text-foreground focus:bg-card focus:border-cta outline-hidden font-sans"
            />
          </div>

          <!-- Payment Selection Grid: Logo + Name Aligned -->
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
            <button
              v-for="b in filteredBankAccounts"
              :key="b.id"
              type="button"
              @click="selectBankAccount(b)"
              :class="[
                'p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition-all cursor-pointer shadow-2xs relative',
                selectedBank?.id === b.id
                  ? 'bg-cta-muted border-cta ring-2 ring-cta/25'
                  : 'bg-surface-subtle border-border hover:bg-card hover:border-border-strong'
              ]"
            >
              <BankBrandIcon :bank-name="b.bank_name" :logo-url="b.logo_icon || (b as any).logo_url" :size="18" />

              <div class="min-w-0 flex-1">
                <span class="text-xs font-bold truncate block leading-tight text-foreground">
                  {{ b.bank_name }}
                </span>
              </div>

              <span v-if="b.is_default" class="text-[8px] bg-amber-500/20 text-amber-700 dark:text-amber-300 px-1 py-0.5 rounded font-mono font-bold shrink-0">
                DEF
              </span>
            </button>
          </div>
        </div>

        <!-- Cash Tender Inputs (Only shown when Cash is selected) -->
        <div v-if="isCashSelected" class="p-3.5 rounded-xl border border-border bg-surface-subtle space-y-2.5">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-1.5">
              <Banknote class="w-4 h-4 text-primary" />
              <span class="text-xs font-bold text-foreground">Cash Received</span>
            </div>
            <span class="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[10px] font-mono font-bold">
              Cash Drawer
            </span>
          </div>

          <div>
            <label class="block text-xs font-bold text-foreground mb-1">Tendered Cash Amount ($)</label>
            <div class="relative">
              <span class="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">$</span>
              <input
                :value="localTendered"
                @input="setTendered(parseFloat(($event.target as HTMLInputElement).value) || 0)"
                type="number"
                min="0"
                step="any"
                class="w-full pl-7 pr-3 py-2 rounded-xl border border-input bg-card text-base font-bold font-mono text-foreground focus:border-cta focus:ring-2 focus:ring-cta/20 outline-hidden transition-all"
              />
            </div>
          </div>

          <!-- Quick Cash Pill Presets -->
          <div>
            <span class="text-3xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">1-Click Quick Cash</span>
            <div class="flex flex-wrap gap-1.5">
              <button
                v-for="preset in quickCashPresets"
                :key="preset.value"
                type="button"
                @click="setTendered(preset.value)"
                :class="[
                  'px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition-all border shadow-2xs cursor-pointer',
                  localTendered === preset.value
                    ? 'bg-cta text-cta-foreground border-cta'
                    : 'bg-card text-foreground border-border hover:bg-accent hover:border-cta'
                ]"
              >
                {{ preset.label }}
              </button>
              <button
                type="button"
                @click="addTendered(10)"
                class="px-2.5 py-1.5 rounded-lg text-xs font-bold font-mono bg-card text-muted-foreground border border-border hover:bg-surface-subtle cursor-pointer"
              >
                +$10
              </button>
              <button
                type="button"
                @click="addTendered(20)"
                class="px-2.5 py-1.5 rounded-lg text-xs font-bold font-mono bg-card text-muted-foreground border border-border hover:bg-surface-subtle cursor-pointer"
              >
                +$20
              </button>
              <button
                type="button"
                @click="addTendered(50)"
                class="px-2.5 py-1.5 rounded-lg text-xs font-bold font-mono bg-card text-muted-foreground border border-border hover:bg-surface-subtle cursor-pointer"
              >
                +$50
              </button>
            </div>
          </div>

          <!-- Change Due Display -->
          <div class="pt-2 border-t border-border flex items-center justify-between">
            <span class="text-xs font-bold text-muted-foreground">Change Due:</span>
            <span
              :class="[
                'text-base font-bold font-mono px-2.5 py-0.5 rounded-lg',
                changeDue > 0
                  ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                  : 'text-foreground'
              ]"
            >
              {{ formatMoney(changeDue) }}
            </span>
          </div>
        </div>

        <!-- Delivery & Fulfillment Option (Collapsible Toggle) -->
        <div class="p-3.5 rounded-xl border border-border bg-card space-y-2.5">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <Truck class="w-4 h-4 text-primary" />
              <div>
                <span class="text-xs font-bold text-foreground">Delivery / Shipping Order</span>
                <p class="text-3xs text-muted-foreground">Attach carrier, destination zone, and shipping address</p>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <span
                v-if="!isWalkInChannel"
                class="text-3xs font-bold text-warning-text bg-warning-bg border border-warning-border px-2 py-0.5 rounded-full"
              >
                Required for Online
              </span>
              <label class="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  :checked="isDelivery"
                  :disabled="!isWalkInChannel"
                  @change="emit('update:delivery', ($event.target as HTMLInputElement).checked)"
                  class="sr-only peer"
                />
                <div class="w-8 h-4.5 bg-muted peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-cta peer-disabled:opacity-80"></div>
              </label>
            </div>
          </div>

          <div v-if="isDelivery" class="space-y-2.5 pt-2 border-t border-border">
            <div>
              <label class="block text-3xs font-bold text-foreground mb-1">Delivery Address *</label>
              <input
                :value="deliveryAddress"
                @input="emit('update:delivery-address', ($event.target as HTMLInputElement).value)"
                type="text"
                placeholder="Full delivery street address (Auto-filled from customer or edit for this order)..."
                class="w-full px-3 py-1.5 rounded-lg border border-input bg-surface-subtle text-xs text-foreground focus:bg-card focus:border-cta outline-hidden"
              />
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label class="block text-3xs font-bold text-foreground mb-1">Delivery Carrier</label>
                <button
                  type="button"
                  @click="openCompanyPicker = true"
                  class="w-full px-2.5 py-1.5 rounded-lg border border-border bg-surface-subtle text-xs text-left font-medium text-foreground hover:bg-card truncate cursor-pointer"
                >
                  {{ selectedCompanyName || 'Select Company...' }}
                </button>
              </div>

              <div>
                <label class="block text-3xs font-bold text-foreground mb-1">Delivery Zone & Fee</label>
                <button
                  type="button"
                  @click="openZonePicker = true"
                  class="w-full px-2.5 py-1.5 rounded-lg border border-border bg-surface-subtle text-xs text-left font-medium text-foreground hover:bg-card truncate cursor-pointer"
                >
                  {{ selectedZoneLabel || 'Select Zone...' }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Order Notes -->
        <div>
          <label class="block text-3xs font-bold text-foreground uppercase mb-1">Order Notes (Optional)</label>
          <input
            v-model="localNotes"
            type="text"
            placeholder="e.g. Rush delivery, VIP customer, special packaging..."
            class="w-full px-3 py-1.5 rounded-lg border border-input bg-surface-subtle text-xs text-foreground focus:bg-card focus:border-cta outline-hidden"
          />
        </div>
      </div>

      <!-- Footer CTA -->
      <div class="px-5 py-3 bg-surface-subtle border-t border-border flex items-center justify-between gap-2.5">
        <button
          type="button"
          @click="close"
          class="h-9 px-4 rounded-xl border border-border bg-card text-foreground font-bold text-xs hover:bg-surface-subtle transition-colors cursor-pointer"
        >
          Cancel (Esc)
        </button>

        <button
          type="button"
          @click="handleComplete"
          :disabled="!canComplete"
          class="flex-1 h-9 px-5 rounded-xl bg-cta text-cta-foreground font-bold text-xs hover:brightness-110 transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-98"
        >
          <div v-if="loading" class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          <Check v-else class="w-4 h-4 stroke-[2.5]" />
          <span>Charge {{ formatMoney(total) }} (↵)</span>
        </button>
      </div>
    </div>

    <!-- Sub-pickers for Delivery -->
    <DeliveryCompanyPickerModal
      v-model:open="openCompanyPicker"
      :companies="companies"
      :selected-id="deliveryCompanyId"
      @select="(c) => emit('update:delivery-company', c.id)"
    />

    <DeliveryZonePickerModal
      v-model:open="openZonePicker"
      :zones="zones"
      :selected-id="deliveryZoneId"
      :initial-cost="deliveryFee"
      @select="(z, customCost) => {
        emit('update:delivery-zone', z.id)
        if (customCost !== undefined) {
          emit('update:delivery-fee', customCost)
        }
      }"
    />
  </div>
</template>
