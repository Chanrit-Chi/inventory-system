<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import {
  X,
  CreditCard,
  Banknote,
  QrCode,
  Truck,
  Check,
  Receipt,
} from 'lucide-vue-next'
import api from '@/api/axios'
import { useToast } from '@/composables/useToast'
import DeliveryCompanyPickerModal from './DeliveryCompanyPickerModal.vue'
import DeliveryZonePickerModal from './DeliveryZonePickerModal.vue'
import CustomerLookupRow from './CustomerLookupRow.vue'
import { calculateLoyalty } from '@/utils/loyalty'

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
const cardRef = ref<string>('')
const openCompanyPicker = ref(false)
const openZonePicker = ref(false)

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

function getBankIcon(b: BankAccount | null) {
  const cat = getBankCategory(b)
  if (cat === 'CASH') return Banknote
  if (cat === 'CARD') return CreditCard
  return QrCode
}

const isCashSelected = computed(() => {
  return getBankCategory(selectedBank.value) === 'CASH'
})

function selectBankAccount(b: BankAccount) {
  selectedBankId.value = b.id
  emit('update:bank-account-id', b.id)
  emit('update:payment-method', b.bank_name)
  if (getBankCategory(b) === 'CASH' && (localTendered.value === 0 || localTendered.value < props.total)) {
    localTendered.value = props.total
    emit('update:tendered', props.total)
  }
}

async function fetchBankAccounts() {
  try {
    const res = await api.get('/bank-accounts')
    const list = res.data?.data || res.data || []
    const activeList = (Array.isArray(list) ? list : []).filter((b: any) => b.is_active !== false)
    
    if (activeList.length > 0) {
      bankAccounts.value = activeList
    } else {
      bankAccounts.value = [
        { id: 'cash-drawer', bank_name: 'Cash Drawer', account_name: 'Cash Register', account_number: 'POS-01', is_default: true, is_active: true },
        { id: 'aba-khqr', bank_name: 'ABA Bank', account_name: 'ABA PayWay KHQR', account_number: '000 123 456', is_default: false, is_active: true },
        { id: 'card-pos', bank_name: 'Credit Card', account_name: 'Card Terminal EFT', account_number: 'EFT-01', is_default: false, is_active: true },
      ]
    }

    if (props.selectedBankAccountId) {
      const match = bankAccounts.value.find(b => b.id === props.selectedBankAccountId)
      if (match) {
        selectedBankId.value = match.id
        return
      }
    }

    if (props.paymentMethod) {
      const match = bankAccounts.value.find(b => b.bank_name.toLowerCase() === props.paymentMethod?.toLowerCase())
      if (match) {
        selectedBankId.value = match.id
        return
      }
    }

    if (!selectedBankId.value && bankAccounts.value.length > 0) {
      const def = bankAccounts.value.find(b => b.is_default) || bankAccounts.value[0]
      selectedBankId.value = def.id
      selectBankAccount(def)
    }
  } catch (e) {
    bankAccounts.value = [
      { id: 'cash-drawer', bank_name: 'Cash Drawer', account_name: 'Cash Register', account_number: 'POS-01', is_default: true, is_active: true },
      { id: 'aba-khqr', bank_name: 'ABA Bank', account_name: 'ABA PayWay KHQR', account_number: '000 123 456', is_default: false, is_active: true },
      { id: 'card-pos', bank_name: 'Credit Card', account_name: 'Card Terminal EFT', account_number: 'EFT-01', is_default: false, is_active: true },
    ]
    if (!selectedBankId.value) {
      selectedBankId.value = bankAccounts.value[0].id
      selectBankAccount(bankAccounts.value[0])
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

const canComplete = computed(() => {
  if (props.loading) return false
  if (props.total <= 0) return false
  if (isCashSelected.value && localTendered.value < props.total) {
    return false
  }
  if (props.isDelivery && !props.deliveryAddress.trim()) {
    return false
  }
  return true
})

function handleComplete() {
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
  const z = props.zones.find((item) => item.id === props.deliveryZoneId)
  if (!z) return ''
  const zoneName = z.name || z.zone_name || 'Delivery Zone'
  const feeVal = parseFloat(String(z.cost ?? z.fee ?? 0)) || 0
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
      class="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
      @click="close"
    />

    <!-- Modal Dialog -->
    <div
      class="relative w-full max-w-xl rounded-2xl bg-white shadow-2xl border border-[#E8E2D9] overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in-0 zoom-in-95 duration-150"
    >
      <!-- Modal Header -->
      <div class="px-5 py-3.5 bg-[#FAF7F2] border-b border-[#E8E2D9] flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg bg-[#FFF3E0] border border-[#FFDCC4] flex items-center justify-center text-[#924C00] shadow-2xs">
            <Receipt class="w-4 h-4" />
          </div>
          <div>
            <h3 class="text-sm font-bold text-[#1A1C1C] font-display">Tender & Fast Checkout</h3>
            <p class="text-3xs text-[#6B6358]">Select payment method and finalize transaction</p>
          </div>
        </div>

        <button
          type="button"
          @click="close"
          class="p-1.5 rounded-lg text-[#6B6358] hover:text-[#1A1C1C] hover:bg-[#F0EAE1] transition-colors cursor-pointer"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Scrollable Content -->
      <div class="p-5 overflow-y-auto space-y-4 flex-1">
        <!-- Amount Breakdown Card -->
        <div class="p-3.5 rounded-xl bg-[#FAF7F2] border border-[#E8E2D9] space-y-2">
          <div class="flex items-center justify-between text-xs text-[#6B6358]">
            <span>Subtotal</span>
            <span class="font-mono font-bold text-[#1A1C1C]">{{ formatMoney(subtotal) }}</span>
          </div>

          <div v-if="discountValue && discountValue > 0" class="flex items-center justify-between text-xs text-amber-900">
            <span>Order Discount</span>
            <span class="font-mono font-bold">
              -{{ formatMoney(subtotal * (discountValue / 100)) }} ({{ discountValue }}%)
            </span>
          </div>

          <div v-if="taxRate && taxRate > 0" class="flex items-center justify-between text-xs text-[#6B6358]">
            <span>Tax ({{ taxRate }}%)</span>
            <span class="font-mono font-bold text-[#1A1C1C]">+{{ formatMoney(taxAmount) }}</span>
          </div>

          <div v-if="isDelivery && deliveryFee && deliveryFee > 0" class="flex items-center justify-between text-xs text-[#6B6358]">
            <span>Delivery Fee</span>
            <span class="font-mono font-bold text-[#1A1C1C]">+{{ formatMoney(deliveryFee) }}</span>
          </div>

          <div class="pt-2 border-t border-[#E8E2D9] flex items-center justify-between">
            <span class="font-bold text-sm text-[#1A1C1C]">Total Due</span>
            <span class="text-xl font-bold font-mono text-[#924C00]">{{ formatMoney(total) }}</span>
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
          @update:phone="handlePhoneSearchInput"
          @update:name="handleNameInput"
          @select="selectCustomerSuggestion"
          @dismiss-suggestions="showSuggestions = false"
          @reset="handleResetCustomer"
        />

        <!-- Payment Tender Method (Scrollable Bank Accounts Selector) -->
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <label class="block text-xs font-bold text-[#1A1C1C]">Select Payment Method (Bank Accounts)</label>
            <span class="text-[10px] text-[#6B6358] font-mono">
              {{ filteredBankAccounts.length }} / {{ bankAccounts.length }} Account{{ bankAccounts.length === 1 ? '' : 's' }}
            </span>
          </div>

          <!-- Quick Search Filter if multiple bank accounts exist -->
          <div v-if="bankAccounts.length > 3" class="relative">
            <input
              v-model="bankSearchQuery"
              type="text"
              placeholder="Search bank name or account..."
              class="w-full px-3 py-1 rounded-lg border border-[#E8E2D9] bg-[#FAF7F2] text-2xs text-[#1A1C1C] focus:bg-white focus:border-[#FF8800] outline-hidden font-sans"
            />
          </div>

          <!-- Scrollable Bank Accounts Grid -->
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
            <button
              v-for="(b, idx) in filteredBankAccounts"
              :key="b.id"
              type="button"
              @click="selectBankAccount(b)"
              :class="[
                'p-2.5 rounded-xl border text-xs flex flex-col items-center gap-1 transition-all cursor-pointer shadow-2xs relative text-center',
                selectedBank?.id === b.id
                  ? 'bg-[#FFF3E0] border-[#FF8800] text-[#924C00] ring-2 ring-[#FF8800]/20 font-bold'
                  : 'bg-white border-[#E8E2D9] text-[#6B6358] hover:bg-[#FAF7F2] hover:text-[#1A1C1C] font-semibold'
              ]"
            >
              <component :is="getBankIcon(b)" class="w-4 h-4" />
              <span class="truncate max-w-full text-xs">{{ b.bank_name }}</span>
              <span class="text-[10px] font-mono text-[#8C827A] truncate max-w-full font-normal">
                {{ b.account_name || b.account_number }}
              </span>
              <span v-if="idx < 9 && !bankSearchQuery" class="text-[9px] font-mono text-[#8C827A]/80 absolute bottom-1 right-1.5 opacity-60">
                Alt+{{ idx + 1 }}
              </span>
              <span v-if="b.is_default" class="absolute top-1 right-1 px-1 py-0.2 rounded bg-amber-500/10 text-[#924C00] text-[8px] font-bold">
                DEF
              </span>
            </button>
          </div>
        </div>

        <!-- Dynamic Tender Inputs Based on Selected Bank Account Category -->
        <!-- 1. Cash Tender -->
        <div v-if="isCashSelected" class="p-3.5 rounded-xl border border-[#E8E2D9] bg-[#FAF7F2] space-y-2.5">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-1.5">
              <Banknote class="w-4 h-4 text-[#924C00]" />
              <span class="text-xs font-bold text-[#1A1C1C]">{{ selectedBank?.bank_name || 'Cash' }}</span>
              <span class="text-[10px] font-mono text-[#6B6358]">({{ selectedBank?.account_name || 'Register' }})</span>
            </div>
            <span class="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-mono font-bold">
              Cash Drawer
            </span>
          </div>

          <div>
            <label class="block text-xs font-bold text-[#1A1C1C] mb-1">Tendered Cash Amount ($)</label>
            <div class="relative">
              <span class="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-[#6B6358]">$</span>
              <input
                :value="localTendered"
                @input="setTendered(parseFloat(($event.target as HTMLInputElement).value) || 0)"
                type="number"
                min="0"
                step="any"
                class="w-full pl-7 pr-3 py-2 rounded-xl border border-[#E8E2D9] bg-white text-base font-bold font-mono text-[#1A1C1C] focus:border-[#FF8800] focus:ring-2 focus:ring-[#FF8800]/20 outline-hidden transition-all"
              />
            </div>
          </div>

          <!-- Quick Cash Pill Presets -->
          <div>
            <span class="text-3xs font-bold text-[#6B6358] uppercase tracking-wider block mb-1">1-Click Quick Cash</span>
            <div class="flex flex-wrap gap-1.5">
              <button
                v-for="preset in quickCashPresets"
                :key="preset.value"
                type="button"
                @click="setTendered(preset.value)"
                :class="[
                  'px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition-all border shadow-2xs cursor-pointer',
                  localTendered === preset.value
                    ? 'bg-[#924C00] text-white border-[#924C00]'
                    : 'bg-white text-[#1A1C1C] border-[#E8E2D9] hover:bg-[#FFF3E0] hover:border-[#FF8800]'
                ]"
              >
                {{ preset.label }}
              </button>
              <button
                type="button"
                @click="addTendered(10)"
                class="px-2.5 py-1.5 rounded-lg text-xs font-bold font-mono bg-white text-[#6B6358] border border-[#E8E2D9] hover:bg-[#FAF7F2] cursor-pointer"
              >
                +$10
              </button>
              <button
                type="button"
                @click="addTendered(20)"
                class="px-2.5 py-1.5 rounded-lg text-xs font-bold font-mono bg-white text-[#6B6358] border border-[#E8E2D9] hover:bg-[#FAF7F2] cursor-pointer"
              >
                +$20
              </button>
              <button
                type="button"
                @click="addTendered(50)"
                class="px-2.5 py-1.5 rounded-lg text-xs font-bold font-mono bg-white text-[#6B6358] border border-[#E8E2D9] hover:bg-[#FAF7F2] cursor-pointer"
              >
                +$50
              </button>
            </div>
          </div>

          <!-- Change Due Display -->
          <div class="pt-2 border-t border-[#E8E2D9] flex items-center justify-between">
            <span class="text-xs font-bold text-[#6B6358]">Change Due:</span>
            <span
              :class="[
                'text-base font-bold font-mono px-2.5 py-0.5 rounded-lg',
                changeDue > 0
                  ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                  : 'text-[#1A1C1C]'
              ]"
            >
              {{ formatMoney(changeDue) }}
            </span>
          </div>
        </div>

        <!-- 2. Card Tender -->
        <div v-else-if="getBankCategory(selectedBank) === 'CARD'" class="p-4 rounded-xl bg-[#FAF7F2] border border-[#E8E2D9] text-center space-y-2.5">
          <CreditCard class="w-8 h-8 mx-auto text-[#924C00]" />
          <div>
            <h4 class="text-xs font-bold text-[#1A1C1C]">{{ selectedBank?.bank_name || 'Card Terminal' }}</h4>
            <p class="text-3xs text-[#6B6358]">Swipe, tap, or insert chip on {{ selectedBank?.account_name || 'card terminal' }}</p>
            <p v-if="selectedBank?.account_number" class="text-3xs font-mono text-[#8C827A] mt-0.5">Terminal / Acc: {{ selectedBank.account_number }}</p>
          </div>
          <div class="max-w-xs mx-auto pt-1">
            <input
              v-model="cardRef"
              type="text"
              placeholder="Authorization / Reference code (Optional)"
              class="w-full px-3 py-1.5 rounded-lg border border-[#E8E2D9] bg-white text-xs text-[#1A1C1C] focus:border-[#FF8800] outline-hidden text-center"
            />
          </div>
        </div>

        <!-- 3. Dynamic QR Code / Mobile Bank Payment -->
        <div v-else class="p-4 rounded-xl bg-[#FAF7F2] border border-[#E8E2D9] text-center space-y-2.5">
          <div class="w-28 h-28 mx-auto bg-white p-2 rounded-xl border border-[#E8E2D9] shadow-2xs flex flex-col items-center justify-center overflow-hidden">
            <img
              v-if="selectedBank?.qr_image_url || selectedBank?.qr_code_url"
              :src="selectedBank.qr_image_url || selectedBank.qr_code_url!"
              alt="Bank QR Code"
              class="w-full h-full object-contain"
            />
            <template v-else>
              <QrCode class="w-18 h-18 text-[#1A1C1C]" />
              <span class="text-[9px] font-bold text-[#924C00] font-mono uppercase truncate max-w-full">
                {{ selectedBank ? selectedBank.bank_name : 'KHQR' }}
              </span>
            </template>
          </div>

          <div>
            <h4 class="text-xs font-bold text-[#1A1C1C]">Scan with {{ selectedBank?.bank_name || 'Mobile Banking' }}</h4>
            <div v-if="selectedBank" class="text-xs text-[#6B6358] mt-0.5 space-y-0.5">
              <p class="font-bold text-[#1A1C1C] text-xs">{{ selectedBank.account_name }}</p>
              <p class="font-mono text-3xs text-[#6B6358]">{{ selectedBank.account_number }}</p>
              <span v-if="selectedBank.currency" class="inline-block mt-0.5 px-1.5 py-0.2 rounded bg-[#FAF7F2] border border-[#E8E2D9] text-[9px] font-mono font-bold text-[#924C00]">
                Currency: {{ selectedBank.currency }}
              </span>
            </div>
            <p v-else class="text-3xs text-[#6B6358] mt-0.5">Scan QR code using any Mobile Banking app</p>
          </div>

          <div class="max-w-xs mx-auto pt-1">
            <input
              v-model="cardRef"
              type="text"
              placeholder="Transaction Slip Ref (Optional)"
              class="w-full px-3 py-1.5 rounded-lg border border-[#E8E2D9] bg-white text-xs text-[#1A1C1C] focus:border-[#FF8800] outline-hidden text-center"
            />
          </div>
        </div>

        <!-- Delivery & Fulfillment Option (Collapsible Toggle) -->
        <div class="p-3.5 rounded-xl border border-[#E8E2D9] bg-white space-y-2.5">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <Truck class="w-4 h-4 text-[#924C00]" />
              <div>
                <span class="text-xs font-bold text-[#1A1C1C]">Delivery / Shipping Order</span>
                <p class="text-3xs text-[#6B6358]">Attach carrier, destination zone, and shipping address</p>
              </div>
            </div>

            <label class="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                :checked="isDelivery"
                @change="emit('update:delivery', ($event.target as HTMLInputElement).checked)"
                class="sr-only peer"
              />
              <div class="w-8 h-4.5 bg-[#E8E2D9] peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-[#924C00]"></div>
            </label>
          </div>

          <div v-if="isDelivery" class="space-y-2.5 pt-2 border-t border-[#E8E2D9]">
            <div>
              <label class="block text-3xs font-bold text-[#1A1C1C] mb-1">Delivery Address *</label>
              <input
                :value="deliveryAddress"
                @input="emit('update:delivery-address', ($event.target as HTMLInputElement).value)"
                type="text"
                placeholder="Full delivery street address (Auto-filled from customer or edit for this order)..."
                class="w-full px-3 py-1.5 rounded-lg border border-[#E8E2D9] bg-[#FAF7F2] text-xs text-[#1A1C1C] focus:bg-white focus:border-[#FF8800] outline-hidden"
              />
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label class="block text-3xs font-bold text-[#1A1C1C] mb-1">Delivery Carrier</label>
                <button
                  type="button"
                  @click="openCompanyPicker = true"
                  class="w-full px-2.5 py-1.5 rounded-lg border border-[#E8E2D9] bg-[#FAF7F2] text-xs text-left font-medium text-[#1A1C1C] hover:bg-white truncate cursor-pointer"
                >
                  {{ selectedCompanyName || 'Select Company...' }}
                </button>
              </div>

              <div>
                <label class="block text-3xs font-bold text-[#1A1C1C] mb-1">Delivery Zone & Fee</label>
                <button
                  type="button"
                  @click="openZonePicker = true"
                  class="w-full px-2.5 py-1.5 rounded-lg border border-[#E8E2D9] bg-[#FAF7F2] text-xs text-left font-medium text-[#1A1C1C] hover:bg-white truncate cursor-pointer"
                >
                  {{ selectedZoneLabel || 'Select Zone...' }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Order Notes -->
        <div>
          <label class="block text-3xs font-bold text-[#1A1C1C] uppercase mb-1">Order Notes (Optional)</label>
          <input
            v-model="localNotes"
            type="text"
            placeholder="e.g. Rush delivery, VIP customer, special packaging..."
            class="w-full px-3 py-1.5 rounded-lg border border-[#E8E2D9] bg-[#FAF7F2] text-xs text-[#1A1C1C] focus:bg-white focus:border-[#FF8800] outline-hidden"
          />
        </div>
      </div>

      <!-- Footer CTA -->
      <div class="px-5 py-3 bg-[#FAF7F2] border-t border-[#E8E2D9] flex items-center justify-between gap-2.5">
        <button
          type="button"
          @click="close"
          class="h-9 px-4 rounded-xl border border-[#E8E2D9] bg-white text-[#1A1C1C] font-bold text-xs hover:bg-[#FAF7F2] transition-colors cursor-pointer"
        >
          Cancel (Esc)
        </button>

        <button
          type="button"
          @click="handleComplete"
          :disabled="!canComplete"
          class="flex-1 h-9 px-5 rounded-xl bg-[#FF8800] text-white font-bold text-xs hover:bg-[#E67A00] transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-98"
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
