<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import {
  X,
  CreditCard,
  Banknote,
  QrCode,
  Truck,
  User,
  Check,
  Receipt,
} from 'lucide-vue-next'
import api from '@/api/axios'
import { useToast } from '@/composables/useToast'
import DeliveryCompanyPickerModal from './DeliveryCompanyPickerModal.vue'
import DeliveryZonePickerModal from './DeliveryZonePickerModal.vue'

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
  paymentMethod?: 'CASH' | 'CARD' | 'QR' | 'SPLIT'
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
  paymentMethod: 'CASH',
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
  'update:customer-name': [value: string]
  'update:customer-phone': [value: string]
  'update:discount-type': [value: 'none' | 'percentage' | 'flat']
  'update:discount-value': [value: number]
  'update:tax-rate': [value: number]
  'update:notes': [value: string]
  'update:tendered': [value: number]
  'update:payment-method': [value: 'CASH' | 'CARD' | 'QR' | 'SPLIT']
  'complete': []
  'cancel': []
}>()

export interface BankAccount {
  id: string
  bank_name: string
  account_name: string
  account_number: string
  qr_code_url?: string | null
  is_active: boolean
  currency?: string
}

export interface CustomerSuggestion {
  id: string
  name: string
  phone: string
  loyalty_tier?: string
  total_spent?: number | string
}

const toast = useToast()

// Local modal state
const localPaymentMethod = ref<'CASH' | 'CARD' | 'QR' | 'SPLIT'>('CASH')
const localTendered = ref<number>(0)
const localNotes = ref<string>('')
const cardRef = ref<string>('')
const openCompanyPicker = ref(false)
const openZonePicker = ref(false)

// Dynamic Bank Accounts
const bankAccounts = ref<BankAccount[]>([])
const selectedBankId = ref<string>('')

const selectedBank = computed(() => {
  return bankAccounts.value.find((b) => b.id === selectedBankId.value) || bankAccounts.value[0] || null
})

async function fetchBankAccounts() {
  try {
    const res = await api.get('/bank-accounts')
    const list = res.data?.data || res.data || []
    bankAccounts.value = (Array.isArray(list) ? list : []).filter((b: any) => b.is_active !== false)
    if (bankAccounts.value.length > 0 && !selectedBankId.value) {
      selectedBankId.value = bankAccounts.value[0].id
    }
  } catch (e) {
    // Ignore fallback
  }
}

// Inline Customer Search
const customerSearchQuery = ref(props.customerPhone || '')
const customerSuggestions = ref<CustomerSuggestion[]>([])
const showSuggestions = ref(false)
let customerSearchTimeout: ReturnType<typeof setTimeout> | null = null

function handleCustomerSearchInput(val: string) {
  customerSearchQuery.value = val
  emit('update:customer-phone', val)
  if (customerSearchTimeout) clearTimeout(customerSearchTimeout)
  if (!val.trim() || val.length < 2) {
    customerSuggestions.value = []
    showSuggestions.value = false
    return
  }
  customerSearchTimeout = setTimeout(async () => {
    try {
      const res = await api.get('/customers', { params: { search: val } })
      const list = res.data?.data || res.data || []
      customerSuggestions.value = Array.isArray(list) ? list : []
      showSuggestions.value = customerSuggestions.value.length > 0
    } catch {
      customerSuggestions.value = []
      showSuggestions.value = false
    }
  }, 250)
}

function selectCustomerSuggestion(c: CustomerSuggestion) {
  emit('update:customer-name', c.name)
  emit('update:customer-phone', c.phone)
  customerSearchQuery.value = c.phone
  showSuggestions.value = false
}

// Sync from props
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      localPaymentMethod.value = props.paymentMethod || 'CASH'
      localTendered.value = props.tenderedAmount > 0 ? props.tenderedAmount : props.total
      customerSearchQuery.value = props.customerPhone || ''
      fetchBankAccounts()
    }
  },
  { immediate: true }
)

watch(
  () => props.total,
  (newTotal) => {
    if (localPaymentMethod.value === 'CASH' && (localTendered.value === 0 || localTendered.value < newTotal)) {
      localTendered.value = newTotal
    }
  }
)

function formatMoney(amount: number | string | undefined | null): string {
  if (amount == null) return '$0.00'
  const val = typeof amount === 'string' ? parseFloat(amount) : amount
  return isNaN(val) ? '$0.00' : `$${val.toFixed(2)}`
}

function setMethod(m: 'CASH' | 'CARD' | 'QR' | 'SPLIT') {
  localPaymentMethod.value = m
  emit('update:payment-method', m)
  if (m === 'CASH' && localTendered.value < props.total) {
    localTendered.value = props.total
    emit('update:tendered', props.total)
  }
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
  if (localPaymentMethod.value === 'CASH') {
    return Math.max(0, localTendered.value - props.total)
  }
  return 0
})

const canComplete = computed(() => {
  if (props.loading) return false
  if (props.total <= 0) return false
  if (localPaymentMethod.value === 'CASH' && localTendered.value < props.total) {
    return false
  }
  if (props.isDelivery && !props.deliveryAddress.trim()) {
    return false
  }
  return true
})

function handleComplete() {
  if (!canComplete.value) {
    if (localPaymentMethod.value === 'CASH' && localTendered.value < props.total) {
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
  } else if (e.key === '1' && e.altKey) {
    setMethod('CASH')
  } else if (e.key === '2' && e.altKey) {
    setMethod('CARD')
  } else if (e.key === '3' && e.altKey) {
    setMethod('QR')
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
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <!-- Backdrop -->
    <div
      class="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
      @click="close"
    />

    <!-- Modal Dialog -->
    <div
      class="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-[#E8E2D9] overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in-0 zoom-in-95 duration-150"
    >
      <!-- Modal Header -->
      <div class="px-6 py-4 bg-[#FAF7F2] border-b border-[#E8E2D9] flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-[#FFF3E0] border border-[#FFDCC4] flex items-center justify-center text-[#924C00] shadow-2xs">
            <Receipt class="w-5 h-5" />
          </div>
          <div>
            <h3 class="text-lg font-bold text-[#1A1C1C] font-display">Tender & Fast Checkout</h3>
            <p class="text-2xs text-[#6B6358]">Select payment method and finalize transaction</p>
          </div>
        </div>

        <button
          type="button"
          @click="close"
          class="p-2 rounded-xl text-[#6B6358] hover:text-[#1A1C1C] hover:bg-[#F0EAE1] transition-colors"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Modal Body -->
      <div class="p-6 overflow-y-auto space-y-5 flex-1">
        <!-- Prominent Total & Customer Banner -->
        <div class="p-4 rounded-xl bg-[#FAF7F2] border border-[#E8E2D9] space-y-3">
          <div class="flex items-center justify-between">
            <div>
              <span class="text-xs font-bold text-[#6B6358] uppercase tracking-wider">Total Amount Due</span>
              <div class="text-3xl font-black text-[#1A1C1C] font-display mt-0.5">
                {{ formatMoney(total) }}
              </div>
            </div>

            <!-- Customer Chip -->
            <div class="text-right">
              <span class="text-2xs text-[#6B6358] block mb-1">Linked Customer</span>
              <div
                v-if="customerName"
                class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-[#E8E2D9] text-xs font-bold text-[#1A1C1C]"
              >
                <User class="w-3.5 h-3.5 text-[#924C00]" />
                <span>{{ customerName }}</span>
                <span
                  v-if="customerLoyaltyTier"
                  class="px-1.5 py-0.2 text-3xs font-semibold rounded-full bg-amber-50 text-amber-800 border border-amber-200"
                >
                  {{ customerLoyaltyTier }}
                </span>
              </div>
              <div v-else class="text-xs text-[#8C827A] italic">
                Walk-in Guest
              </div>
            </div>
          </div>

          <!-- Inline Customer Phone Quick Autocomplete Search -->
          <div class="relative pt-1 border-t border-[#E8E2D9]">
            <label class="block text-2xs font-bold text-[#6B6358] uppercase tracking-wider mb-1">
              Customer Phone / Quick Search
            </label>
            <input
              :value="customerSearchQuery"
              @input="handleCustomerSearchInput(($event.target as HTMLInputElement).value)"
              placeholder="Search or enter customer phone (e.g. 012 345 678)..."
              class="w-full px-3 py-1.5 rounded-lg border border-[#E8E2D9] bg-white text-xs text-[#1A1C1C] focus:border-[#FF8800] outline-hidden font-mono"
            />

            <!-- Autocomplete Suggestions Dropdown -->
            <div
              v-if="showSuggestions && customerSuggestions.length > 0"
              class="absolute left-0 right-0 top-full mt-1 z-30 bg-white border border-[#E8E2D9] rounded-xl shadow-lg divide-y divide-[#E8E2D9] max-h-48 overflow-y-auto"
            >
              <div
                v-for="sug in customerSuggestions"
                :key="sug.id"
                @click="selectCustomerSuggestion(sug)"
                class="p-2.5 hover:bg-[#FAF7F2] cursor-pointer flex items-center justify-between transition-colors"
              >
                <div>
                  <div class="flex items-center gap-1.5">
                    <span class="font-bold text-xs text-[#1A1C1C]">{{ sug.name }}</span>
                    <span
                      v-if="sug.loyalty_tier"
                      class="px-1.5 py-0.2 text-3xs font-semibold rounded-full bg-amber-50 text-amber-800 border border-amber-200"
                    >
                      {{ sug.loyalty_tier }}
                    </span>
                  </div>
                  <span class="text-3xs text-[#6B6358] font-mono">{{ sug.phone }}</span>
                </div>
                <span class="text-3xs text-emerald-600 font-mono font-bold">
                  {{ sug.total_spent ? `$${parseFloat(String(sug.total_spent)).toFixed(2)}` : '' }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Payment Tender Method Tabs -->
        <div>
          <label class="block text-xs font-bold text-[#1A1C1C] mb-2">Select Payment Method</label>
          <div class="grid grid-cols-3 gap-2.5">
            <!-- Cash -->
            <button
              type="button"
              @click="setMethod('CASH')"
              :class="[
                'p-3.5 rounded-xl border font-bold text-xs flex flex-col items-center gap-1.5 transition-all cursor-pointer shadow-2xs',
                localPaymentMethod === 'CASH'
                  ? 'bg-[#FFF3E0] border-[#FF8800] text-[#924C00] ring-2 ring-[#FF8800]/20'
                  : 'bg-white border-[#E8E2D9] text-[#6B6358] hover:bg-[#FAF7F2] hover:text-[#1A1C1C]'
              ]"
            >
              <Banknote class="w-5 h-5" />
              <span>Cash (Alt+1)</span>
            </button>

            <!-- Card -->
            <button
              type="button"
              @click="setMethod('CARD')"
              :class="[
                'p-3.5 rounded-xl border font-bold text-xs flex flex-col items-center gap-1.5 transition-all cursor-pointer shadow-2xs',
                localPaymentMethod === 'CARD'
                  ? 'bg-[#FFF3E0] border-[#FF8800] text-[#924C00] ring-2 ring-[#FF8800]/20'
                  : 'bg-white border-[#E8E2D9] text-[#6B6358] hover:bg-[#FAF7F2] hover:text-[#1A1C1C]'
              ]"
            >
              <CreditCard class="w-5 h-5" />
              <span>Credit Card (Alt+2)</span>
            </button>

            <!-- QR / Transfer -->
            <button
              type="button"
              @click="setMethod('QR')"
              :class="[
                'p-3.5 rounded-xl border font-bold text-xs flex flex-col items-center gap-1.5 transition-all cursor-pointer shadow-2xs',
                localPaymentMethod === 'QR'
                  ? 'bg-[#FFF3E0] border-[#FF8800] text-[#924C00] ring-2 ring-[#FF8800]/20'
                  : 'bg-white border-[#E8E2D9] text-[#6B6358] hover:bg-[#FAF7F2] hover:text-[#1A1C1C]'
              ]"
            >
              <QrCode class="w-5 h-5" />
              <span>QR Code (Alt+3)</span>
            </button>
          </div>
        </div>

        <!-- Dynamic Tender Inputs Based on Selected Method -->
        <!-- 1. Cash Tender -->
        <div v-if="localPaymentMethod === 'CASH'" class="p-4 rounded-xl border border-[#E8E2D9] bg-[#FAF7F2] space-y-3">
          <div>
            <label class="block text-xs font-bold text-[#1A1C1C] mb-1.5">Tendered Cash Amount ($)</label>
            <div class="relative">
              <span class="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-[#6B6358]">$</span>
              <input
                :value="localTendered"
                @input="setTendered(parseFloat(($event.target as HTMLInputElement).value) || 0)"
                type="number"
                min="0"
                step="any"
                class="w-full pl-8 pr-4 py-2.5 rounded-xl border border-[#E8E2D9] bg-white text-lg font-bold font-mono text-[#1A1C1C] focus:border-[#FF8800] focus:ring-2 focus:ring-[#FF8800]/20 outline-hidden transition-all"
              />
            </div>
          </div>

          <!-- Quick Cash Pill Presets -->
          <div>
            <span class="text-2xs font-bold text-[#6B6358] uppercase tracking-wider block mb-1.5">1-Click Quick Cash</span>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="preset in quickCashPresets"
                :key="preset.value"
                type="button"
                @click="setTendered(preset.value)"
                :class="[
                  'px-3.5 py-2 rounded-xl text-xs font-bold font-mono transition-all border shadow-2xs cursor-pointer',
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
                class="px-3 py-2 rounded-xl text-xs font-bold font-mono bg-white text-[#6B6358] border border-[#E8E2D9] hover:bg-[#FAF7F2]"
              >
                +$10
              </button>
              <button
                type="button"
                @click="addTendered(20)"
                class="px-3 py-2 rounded-xl text-xs font-bold font-mono bg-white text-[#6B6358] border border-[#E8E2D9] hover:bg-[#FAF7F2]"
              >
                +$20
              </button>
              <button
                type="button"
                @click="addTendered(50)"
                class="px-3 py-2 rounded-xl text-xs font-bold font-mono bg-white text-[#6B6358] border border-[#E8E2D9] hover:bg-[#FAF7F2]"
              >
                +$50
              </button>
            </div>
          </div>

          <!-- Change Due Display -->
          <div class="pt-2 border-t border-[#E8E2D9] flex items-center justify-between">
            <span class="text-xs font-bold text-[#6B6358]">Change Due to Customer:</span>
            <span
              :class="[
                'text-lg font-black font-display px-3 py-1 rounded-lg',
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
        <div v-else-if="localPaymentMethod === 'CARD'" class="p-5 rounded-xl bg-[#FAF7F2] border border-[#E8E2D9] text-center space-y-3">
          <CreditCard class="w-10 h-10 mx-auto text-[#924C00]" />
          <div>
            <h4 class="text-sm font-bold text-[#1A1C1C]">Card Terminal Ready</h4>
            <p class="text-xs text-[#6B6358]">Swipe, tap, or insert chip on external EFT POS card terminal</p>
          </div>
          <div class="max-w-xs mx-auto">
            <input
              v-model="cardRef"
              type="text"
              placeholder="Authorization / Reference code (Optional)"
              class="w-full px-3 py-2 rounded-xl border border-[#E8E2D9] bg-white text-xs text-[#1A1C1C] focus:border-[#FF8800] outline-hidden text-center"
            />
          </div>
        </div>

        <!-- 3. Dynamic QR Code / Mobile Bank Payment -->
        <div v-else-if="localPaymentMethod === 'QR'" class="p-5 rounded-xl bg-[#FAF7F2] border border-[#E8E2D9] text-center space-y-3">
          <!-- Dynamic Bank Account Selection Tabs -->
          <div v-if="bankAccounts.length > 0" class="flex items-center justify-center gap-2 flex-wrap">
            <button
              v-for="b in bankAccounts"
              :key="b.id"
              type="button"
              @click="selectedBankId = b.id"
              :class="[
                'px-3 py-1.5 rounded-lg text-xs font-bold transition-all border cursor-pointer',
                selectedBank?.id === b.id
                  ? 'bg-[#924C00] text-white border-[#924C00] shadow-xs'
                  : 'bg-white text-[#1A1C1C] border-[#E8E2D9] hover:bg-[#FAF7F2]'
              ]"
            >
              {{ b.bank_name }}
            </button>
          </div>

          <div class="w-36 h-36 mx-auto bg-white p-2.5 rounded-xl border border-[#E8E2D9] shadow-xs flex flex-col items-center justify-center">
            <QrCode class="w-24 h-24 text-[#1A1C1C]" />
            <span class="text-[9px] font-bold text-[#924C00] mt-1 font-mono uppercase">
              {{ selectedBank ? selectedBank.bank_name : 'KHQR' }}
            </span>
          </div>

          <div>
            <h4 class="text-sm font-bold text-[#1A1C1C]">Scan with Mobile Banking</h4>
            <div v-if="selectedBank" class="text-xs text-[#6B6358] mt-1 space-y-0.5">
              <p class="font-bold text-[#1A1C1C]">{{ selectedBank.account_name }}</p>
              <p class="font-mono text-3xs text-[#6B6358]">{{ selectedBank.account_number }}</p>
            </div>
            <p v-else class="text-xs text-[#6B6358] mt-1">Scan QR code using any Mobile Banking app</p>
          </div>
        </div>

        <!-- Delivery & Fulfillment Option (Collapsible Toggle) -->
        <div class="p-4 rounded-xl border border-[#E8E2D9] bg-white space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2.5">
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
              <div class="w-9 h-5 bg-[#E8E2D9] peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#924C00]"></div>
            </label>
          </div>

          <div v-if="isDelivery" class="space-y-3 pt-2 border-t border-[#E8E2D9]">
            <div>
              <label class="block text-2xs font-bold text-[#1A1C1C] mb-1">Delivery Address *</label>
              <input
                :value="deliveryAddress"
                @input="emit('update:delivery-address', ($event.target as HTMLInputElement).value)"
                type="text"
                placeholder="Full delivery street address..."
                class="w-full px-3 py-2 rounded-xl border border-[#E8E2D9] bg-[#FAF7F2] text-xs text-[#1A1C1C] focus:bg-white focus:border-[#FF8800] outline-hidden"
              />
            </div>

            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="block text-2xs font-bold text-[#1A1C1C] mb-1">Delivery Carrier</label>
                <button
                  type="button"
                  @click="openCompanyPicker = true"
                  class="w-full px-3 py-2 rounded-xl border border-[#E8E2D9] bg-[#FAF7F2] text-xs text-left font-medium text-[#1A1C1C] hover:bg-white truncate"
                >
                  {{ selectedCompanyName || 'Select Company...' }}
                </button>
              </div>

              <div>
                <label class="block text-2xs font-bold text-[#1A1C1C] mb-1">Delivery Zone</label>
                <button
                  type="button"
                  @click="openZonePicker = true"
                  class="w-full px-3 py-2 rounded-xl border border-[#E8E2D9] bg-[#FAF7F2] text-xs text-left font-medium text-[#1A1C1C] hover:bg-white truncate"
                >
                  {{ selectedZoneLabel || 'Select Zone...' }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Order Notes -->
        <div>
          <label class="block text-xs font-bold text-[#1A1C1C] mb-1">Order Notes (Optional)</label>
          <input
            v-model="localNotes"
            type="text"
            placeholder="e.g. Rush delivery, VIP customer, special packaging..."
            class="w-full px-3.5 py-2 rounded-xl border border-[#E8E2D9] bg-[#FAF7F2] text-xs text-[#1A1C1C] focus:bg-white focus:border-[#FF8800] outline-hidden"
          />
        </div>
      </div>

      <!-- Footer CTA -->
      <div class="px-6 py-4 bg-[#FAF7F2] border-t border-[#E8E2D9] flex items-center justify-between gap-3">
        <button
          type="button"
          @click="close"
          class="px-5 py-3 rounded-xl border border-[#E8E2D9] bg-white text-[#1A1C1C] font-bold text-xs hover:bg-[#FAF7F2] transition-colors cursor-pointer"
        >
          Cancel (Esc)
        </button>

        <button
          type="button"
          @click="handleComplete"
          :disabled="!canComplete"
          class="flex-1 py-3 px-6 rounded-xl bg-[#FF8800] text-[#1A1C1C] font-bold text-sm hover:bg-[#E67A00] transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-98"
        >
          <div v-if="loading" class="w-4 h-4 border-2 border-[#1A1C1C] border-t-transparent rounded-full animate-spin" />
          <Check v-else class="w-5 h-5 stroke-[2.5]" />
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
      @select="(z) => emit('update:delivery-zone', z.id)"
    />
  </div>
</template>
