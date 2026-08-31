<script setup lang="ts">
import { computed } from 'vue'
import {
  User,
  Phone,
  Tag,
  Search,
  Sparkles,
  ChevronRight,
  XCircle,
  Diamond,
  Award,
  Medal,
  Star,
} from 'lucide-vue-next'
import type { Customer, LookupStatus, CustomerLoyaltyInfo } from '@/composables/useCustomerLookup'
import { getTierDetails, calculateLoyalty } from '@/utils/loyalty'

interface Props {
  phone: string
  name: string
  matchedCustomer: Customer | null
  suggestions?: Customer[]
  status?: LookupStatus
  loyaltyInfo?: CustomerLoyaltyInfo | null
  phoneError?: string
  nameError?: string
}

const props = withDefaults(defineProps<Props>(), {
  suggestions: () => [],
  status: 'idle',
  loyaltyInfo: null,
  phoneError: '',
  nameError: '',
})

const emit = defineEmits<{
  'update:phone': [val: string]
  'update:name': [val: string]
  'select': [customer: Customer]
  'dismiss-suggestions': []
  'reset': []
}>()

const hasContent = computed(() => props.phone.length > 0 || props.name.length > 0)
const showSuggestions = computed(() => !props.matchedCustomer && props.suggestions.length > 0)

const resolvedLoyalty = computed(() => {
  if (props.loyaltyInfo) return props.loyaltyInfo
  if (props.matchedCustomer) return calculateLoyalty(props.matchedCustomer)
  return null
})

const tierDetails = computed(() => {
  if (!resolvedLoyalty.value) return null
  return getTierDetails(resolvedLoyalty.value.tier)
})

const pointsEstimate = computed(() => {
  if (!resolvedLoyalty.value) return 0
  return Math.floor(resolvedLoyalty.value.totalSpent)
})

function getTierIcon(tier: string) {
  const t = (tier || '').toLowerCase()
  if (t === 'platinum') return Diamond
  if (t === 'gold') return Award
  if (t === 'silver') return Medal
  return Star
}

function handlePhoneInput(e: Event) {
  const val = (e.target as HTMLInputElement).value
  emit('update:phone', val)
}

function handleNameInput(e: Event) {
  const val = (e.target as HTMLInputElement).value
  emit('update:name', val)
}

function selectSuggestion(cust: Customer) {
  emit('select', cust)
}

function dismiss() {
  emit('dismiss-suggestions')
}

function handleReset() {
  emit('reset')
}
</script>

<template>
  <div class="customer-lookup-row rounded-xl border border-[#E8E2D9] bg-white p-3.5 space-y-2.5 shadow-2xs">
    <!-- Header Bar: Title, Status/Tier Badge, and Reset Button -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <div class="w-6 h-6 rounded-lg bg-[#FFF3E0] border border-[#FFDCC4] flex items-center justify-center text-[#924C00]">
          <User class="w-3.5 h-3.5" />
        </div>
        <span class="text-xs font-bold uppercase tracking-wider text-[#924C00]">Customer & Loyalty</span>
      </div>

      <div class="flex items-center gap-1.5">
        <!-- Lookup status indicator: Searching spinner -->
        <div
          v-if="status === 'searching'"
          class="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FFF3E0] text-[#924C00] border border-[#FFDCC4] text-[10px] font-bold animate-pulse"
        >
          <div class="w-2.5 h-2.5 border-2 border-[#924C00] border-t-transparent rounded-full animate-spin" />
          <span>Searching...</span>
        </div>

        <!-- Matched Tier Badge -->
        <div
          v-if="matchedCustomer && tierDetails"
          :class="[
            'flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold tracking-wide transition-all shadow-2xs',
            tierDetails.bg,
            tierDetails.text,
            tierDetails.border
          ]"
        >
          <component :is="getTierIcon(tierDetails.tier)" class="w-3 h-3" />
          <span>{{ tierDetails.label }}</span>
        </div>

        <!-- + New Member Badge -->
        <div
          v-if="!matchedCustomer && suggestions.length === 0 && phone.trim().length >= 3 && status !== 'searching'"
          class="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FAF7F2] border border-[#E8E2D9] text-[#6B6358] text-[10px] font-bold"
        >
          <Sparkles class="w-2.5 h-2.5 text-[#924C00]" />
          <span>+ New Member</span>
        </div>

        <!-- Change / Clear Button -->
        <button
          v-if="hasContent"
          type="button"
          @click="handleReset"
          class="text-xs font-bold text-red-600 hover:text-red-700 hover:underline px-1.5 py-0.5 rounded transition-colors cursor-pointer"
        >
          {{ matchedCustomer ? 'Change' : 'Clear' }}
        </button>
      </div>
    </div>

    <!-- Input Row: Phone and Name -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
      <!-- Phone Input -->
      <div>
        <div
          :class="[
            'flex items-center rounded-lg border bg-[#FAF7F2] px-2.5 py-1.5 transition-all focus-within:bg-white focus-within:border-[#FF8800] focus-within:ring-2 focus-within:ring-[#FF8800]/20',
            phoneError ? 'border-red-500 bg-red-50/20' : 'border-[#E8E2D9]'
          ]"
        >
          <Phone class="w-3.5 h-3.5 text-[#6B6358] mr-2 shrink-0" />
          <input
            data-testid="input-customer-phone"
            type="tel"
            :value="phone"
            @input="handlePhoneInput"
            placeholder="Customer phone..."
            class="w-full text-xs font-mono text-[#1A1C1C] placeholder:text-[#6B6358]/60 bg-transparent outline-none"
          />
        </div>
        <p v-if="phoneError" class="text-[10px] text-red-600 mt-1 pl-1">{{ phoneError }}</p>
      </div>

      <!-- Customer Name Input -->
      <div>
        <div
          :class="[
            'flex items-center rounded-lg border bg-[#FAF7F2] px-2.5 py-1.5 transition-all focus-within:bg-white focus-within:border-[#FF8800] focus-within:ring-2 focus-within:ring-[#FF8800]/20',
            nameError ? 'border-red-500 bg-red-50/20' : 'border-[#E8E2D9]'
          ]"
        >
          <Tag class="w-3.5 h-3.5 text-[#6B6358] mr-2 shrink-0" />
          <input
            data-testid="input-customer-name"
            type="text"
            :value="name"
            @input="handleNameInput"
            placeholder="Customer name..."
            class="w-full text-xs text-[#1A1C1C] placeholder:text-[#6B6358]/60 bg-transparent outline-none"
          />
        </div>
        <p v-if="nameError" class="text-[10px] text-red-600 mt-1 pl-1">{{ nameError }}</p>
      </div>
    </div>

    <!-- Suggestions Popover / Dropdown -->
    <div
      v-if="showSuggestions"
      class="rounded-xl border border-[#FFDCC4] bg-[#FFFDF9] p-2.5 space-y-2 shadow-md animate-in fade-in-0 duration-150 relative z-20"
    >
      <div class="flex items-center justify-between pb-1.5 border-b border-[#E8E2D9]">
        <div class="flex items-center gap-1.5">
          <Search class="w-3 h-3 text-[#924C00]" />
          <span class="text-[11px] font-bold uppercase tracking-wider text-[#924C00]">
            Matching Customers ({{ suggestions.length }})
          </span>
        </div>
        <button
          type="button"
          @click="dismiss"
          class="text-[#6B6358] hover:text-[#1A1C1C] p-0.5 rounded cursor-pointer transition-colors"
          title="Dismiss suggestions"
        >
          <XCircle class="w-4 h-4" />
        </button>
      </div>

      <div class="max-h-48 overflow-y-auto space-y-1.5 pr-1">
        <div
          v-for="cust in suggestions"
          :key="cust.id || cust.phone"
          @click="selectSuggestion(cust)"
          class="p-2 rounded-lg border border-[#E8E2D9] bg-white hover:bg-[#FFF9F2] hover:border-[#FF8800] transition-all cursor-pointer flex items-center justify-between group shadow-2xs"
        >
          <div class="space-y-0.5 min-w-0 flex-1 mr-2">
            <div class="flex items-center gap-1.5">
              <span class="text-xs font-bold text-[#1A1C1C] truncate">{{ cust.name }}</span>
              <span
                v-if="cust.loyalty_tier || cust.total_spent || cust.total_purchased"
                :class="[
                  'px-1.5 py-0.2 rounded text-[9px] font-bold border shrink-0',
                  getTierDetails(calculateLoyalty(cust).tier).bg,
                  getTierDetails(calculateLoyalty(cust).tier).text,
                  getTierDetails(calculateLoyalty(cust).tier).border
                ]"
              >
                {{ calculateLoyalty(cust).tier }}
              </span>
            </div>

            <div class="flex items-center gap-2 text-[10px] text-[#6B6358] font-mono">
              <span v-if="cust.phone">📞 {{ cust.phone }}</span>
              <span v-if="cust.delivery_address || cust.address" class="truncate">
                📍 {{ cust.delivery_address || cust.address }}
              </span>
            </div>

            <div class="text-[9.5px] text-[#8C827A] font-mono">
              Spent ${{ (parseFloat(String(cust.total_spent || 0)) || 0).toFixed(2) }} • {{ cust.total_purchased ?? 0 }} {{ (cust.total_purchased ?? 0) === 1 ? 'order' : 'orders' }}
            </div>
          </div>

          <button
            type="button"
            class="px-2.5 py-1 rounded-full bg-[#FFF3E0] border border-[#FFDCC4] text-[#924C00] text-[11px] font-bold group-hover:bg-[#FF8800] group-hover:text-white group-hover:border-[#FF8800] transition-all flex items-center gap-0.5 shadow-2xs shrink-0 cursor-pointer"
          >
            <span>Select</span>
            <ChevronRight class="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>

    <!-- Matched Customer Loyalty Stats Card (3 Columns) -->
    <div
      v-if="matchedCustomer && resolvedLoyalty"
      class="grid grid-cols-3 divide-x divide-[#E8E2D9] rounded-xl bg-[#FAF7F2] border border-[#E8E2D9] py-2 px-3 text-center shadow-2xs animate-in fade-in-0 duration-150"
    >
      <div class="px-1">
        <div class="text-[9.5px] font-bold uppercase tracking-wider text-[#6B6358]">POINTS</div>
        <div class="text-xs font-black text-[#924C00] font-mono mt-0.5">
          ⭐ {{ pointsEstimate.toLocaleString() }}
        </div>
      </div>

      <div class="px-1">
        <div class="text-[9.5px] font-bold uppercase tracking-wider text-[#6B6358]">LIFETIME SPENT</div>
        <div class="text-xs font-black text-[#1A1C1C] font-mono mt-0.5">
          ${{ resolvedLoyalty.totalSpent.toFixed(2) }}
        </div>
      </div>

      <div class="px-1">
        <div class="text-[9.5px] font-bold uppercase tracking-wider text-[#6B6358]">ORDERS</div>
        <div class="text-xs font-black text-[#1A1C1C] font-mono mt-0.5">
          {{ resolvedLoyalty.totalPurchased }} {{ resolvedLoyalty.totalPurchased === 1 ? 'sale' : 'sales' }}
        </div>
      </div>
    </div>
  </div>
</template>
