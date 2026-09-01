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
import Badge from '@/components/ui/Badge.vue'

interface Props {
  phone: string
  name: string
  matchedCustomer: Customer | null
  suggestions?: Customer[]
  status?: LookupStatus
  loyaltyInfo?: CustomerLoyaltyInfo | null
  phoneError?: string
  nameError?: string
  required?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  suggestions: () => [],
  status: 'idle',
  loyaltyInfo: null,
  phoneError: '',
  nameError: '',
  required: false,
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
  <div class="customer-lookup-row rounded-xl border border-border bg-card p-3.5 space-y-2.5 shadow-2xs">
    <!-- Header Bar: Title, Status/Tier Badge, and Reset Button -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <div class="w-6 h-6 rounded-lg bg-cta-muted border border-border-strong flex items-center justify-center text-primary">
          <User class="w-3.5 h-3.5" />
        </div>
        <span class="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1">
          Customer & Loyalty
          <span v-if="required" class="text-red-500 font-bold" title="Required for online sales channel">*</span>
        </span>
      </div>

      <div class="flex items-center gap-1.5">
        <span
          v-if="required && !matchedCustomer && !phone && !name"
          class="text-3xs font-bold text-warning-text bg-warning-bg border border-warning-border px-2 py-0.5 rounded-full"
        >
          Required
        </span>
        <!-- Lookup status indicator: Searching spinner -->
        <div
          v-if="status === 'searching'"
          class="flex items-center gap-1 px-2 py-0.5 rounded-full bg-cta-muted text-primary border border-border-strong text-[10px] font-bold animate-pulse"
        >
          <div class="w-2.5 h-2.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span>Searching...</span>
        </div>

        <!-- Matched Tier Badge -->
        <Badge
          v-if="matchedCustomer && tierDetails"
          :variant="tierDetails.variant"
          class="text-[10px] px-1.5 py-0.5 font-semibold gap-1 shadow-2xs"
        >
          <component :is="getTierIcon(tierDetails.tier)" class="w-3 h-3" />
          <span>{{ tierDetails.label }}</span>
        </Badge>

        <!-- + New Member Badge -->
        <div
          v-if="!matchedCustomer && suggestions.length === 0 && phone.trim().length >= 3 && status !== 'searching'"
          class="flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-subtle border border-border text-muted-foreground text-[10px] font-bold"
        >
          <Sparkles class="w-2.5 h-2.5 text-primary" />
          <span>+ New Member</span>
        </div>

        <!-- Change / Clear Button -->
        <button
          v-if="hasContent"
          type="button"
          @click="handleReset"
          class="text-xs font-bold text-red-500 hover:text-red-400 hover:underline px-1.5 py-0.5 rounded transition-colors cursor-pointer"
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
            'flex items-center rounded-lg border bg-surface-subtle px-2.5 py-1.5 transition-all focus-within:bg-card focus-within:border-cta focus-within:ring-2 focus-within:ring-cta/20',
            phoneError ? 'border-red-500 bg-red-500/10' : 'border-input'
          ]"
        >
          <Phone class="w-3.5 h-3.5 text-muted-foreground mr-2 shrink-0" />
          <input
            data-testid="input-customer-phone"
            type="tel"
            :value="phone"
            @input="handlePhoneInput"
            placeholder="Customer phone..."
            class="w-full text-xs font-mono text-foreground placeholder:text-muted-foreground/60 bg-transparent outline-none"
          />
        </div>
        <p v-if="phoneError" class="text-[10px] text-red-500 mt-1 pl-1">{{ phoneError }}</p>
      </div>

      <!-- Customer Name Input -->
      <div>
        <div
          :class="[
            'flex items-center rounded-lg border bg-surface-subtle px-2.5 py-1.5 transition-all focus-within:bg-card focus-within:border-cta focus-within:ring-2 focus-within:ring-cta/20',
            nameError ? 'border-red-500 bg-red-500/10' : 'border-input'
          ]"
        >
          <Tag class="w-3.5 h-3.5 text-muted-foreground mr-2 shrink-0" />
          <input
            data-testid="input-customer-name"
            type="text"
            :value="name"
            @input="handleNameInput"
            placeholder="Customer name..."
            class="w-full text-xs text-foreground placeholder:text-muted-foreground/60 bg-transparent outline-none"
          />
        </div>
        <p v-if="nameError" class="text-[10px] text-red-500 mt-1 pl-1">{{ nameError }}</p>
      </div>
    </div>

    <!-- Suggestions Popover / Dropdown -->
    <div
      v-if="showSuggestions"
      class="rounded-xl border border-border-strong bg-card p-2.5 space-y-2 shadow-md animate-in fade-in-0 duration-150 relative z-20"
    >
      <div class="flex items-center justify-between pb-1.5 border-b border-border">
        <div class="flex items-center gap-1.5">
          <Search class="w-3 h-3 text-primary" />
          <span class="text-[11px] font-bold uppercase tracking-wider text-primary">
            Matching Customers ({{ suggestions.length }})
          </span>
        </div>
        <button
          type="button"
          @click="dismiss"
          class="text-muted-foreground hover:text-foreground p-0.5 rounded cursor-pointer transition-colors"
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
          class="p-2 rounded-lg border border-border bg-surface-subtle hover:bg-accent hover:border-cta transition-all cursor-pointer flex items-center justify-between group shadow-2xs"
        >
          <div class="space-y-0.5 min-w-0 flex-1 mr-2">
            <div class="flex items-center gap-1.5">
              <span class="text-xs font-bold text-foreground truncate">{{ cust.name }}</span>
              <Badge
                v-if="cust.loyalty_tier || cust.total_spent || cust.total_purchased"
                :variant="getTierDetails(calculateLoyalty(cust).tier).variant"
                class="text-[9px] px-1.5 py-0.5 font-semibold shrink-0"
              >
                {{ calculateLoyalty(cust).tier }}
              </Badge>
            </div>

            <div class="flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
              <span v-if="cust.phone">📞 {{ cust.phone }}</span>
              <span v-if="cust.delivery_address || cust.address" class="truncate">
                📍 {{ cust.delivery_address || cust.address }}
              </span>
            </div>

            <div class="text-[9.5px] text-muted-foreground font-mono">
              Spent ${{ (parseFloat(String(cust.total_spent || 0)) || 0).toFixed(2) }} • {{ cust.total_purchased ?? 0 }} {{ (cust.total_purchased ?? 0) === 1 ? 'order' : 'orders' }}
            </div>
          </div>

          <button
            type="button"
            class="px-2.5 py-1 rounded-full bg-cta-muted border border-border-strong text-primary text-[11px] font-bold group-hover:bg-cta group-hover:text-cta-foreground group-hover:border-cta transition-all flex items-center gap-0.5 shadow-2xs shrink-0 cursor-pointer"
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
      class="grid grid-cols-3 divide-x divide-border rounded-xl bg-surface-subtle border border-border py-2 px-3 text-center shadow-2xs animate-in fade-in-0 duration-150"
    >
      <div class="px-1">
        <div class="text-[9.5px] font-bold uppercase tracking-wider text-muted-foreground">POINTS</div>
        <div class="text-xs font-black text-primary font-mono mt-0.5">
          ⭐ {{ pointsEstimate.toLocaleString() }}
        </div>
      </div>

      <div class="px-1">
        <div class="text-[9.5px] font-bold uppercase tracking-wider text-muted-foreground">LIFETIME SPENT</div>
        <div class="text-xs font-black text-foreground font-mono mt-0.5">
          ${{ resolvedLoyalty.totalSpent.toFixed(2) }}
        </div>
      </div>

      <div class="px-1">
        <div class="text-[9.5px] font-bold uppercase tracking-wider text-muted-foreground">ORDERS</div>
        <div class="text-xs font-black text-foreground font-mono mt-0.5">
          {{ resolvedLoyalty.totalPurchased }} {{ resolvedLoyalty.totalPurchased === 1 ? 'sale' : 'sales' }}
        </div>
      </div>
    </div>
  </div>
</template>
