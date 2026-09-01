<script setup lang="ts">
import { ref, watch } from 'vue'
import {
  X,
  Search,
  User,
  UserPlus,
  Phone,
  Mail,
  Check,
  Trash2,
  Sparkles
} from 'lucide-vue-next'
import api from '@/api/axios'
import { useToast } from '@/composables/useToast'

export interface Customer {
  id?: string | number
  name: string
  phone?: string
  email?: string
  address?: string
  loyalty_tier?: string
  loyalty_points?: number
  total_spent?: number | string
  preferred_delivery_company?: string
}

interface Props {
  open: boolean
  currentCustomer?: Customer | null
}

const props = withDefaults(defineProps<Props>(), {
  open: false,
  currentCustomer: null,
})

const emit = defineEmits<{
  'update:open': [value: boolean]
  select: [customer: Customer]
  clear: []
}>()

const toast = useToast()

const activeTab = ref<'lookup' | 'create'>('lookup')
const searchQuery = ref('')
const searchLoading = ref(false)
const searchResults = ref<Customer[]>([])
const hasSearched = ref(false)

// New customer form state
const newCustomer = ref({
  name: '',
  phone: '',
  email: '',
  address: '',
})
const creating = ref(false)

const LOYALTY_TIERS: Record<string, { bg: string; text: string; border: string; icon: string; discount: string }> = {
  Platinum: { bg: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800', text: 'text-indigo-700 dark:text-indigo-300', border: 'border-indigo-200 dark:border-indigo-800', icon: '✦', discount: '15% Member Discount' },
  Gold: { bg: 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800', text: 'text-amber-800 dark:text-amber-300', border: 'border-amber-300 dark:border-amber-800', icon: '★', discount: '10% Member Discount' },
  Silver: { bg: 'bg-slate-100 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700', text: 'text-slate-700 dark:text-slate-300', border: 'border-slate-300 dark:border-slate-700', icon: '▲', discount: '5% Member Discount' },
  Bronze: { bg: 'bg-orange-50 dark:bg-orange-950/40 text-orange-800 dark:text-orange-300 border-orange-200 dark:border-orange-800', text: 'text-orange-800 dark:text-orange-300', border: 'border-orange-200 dark:border-orange-800', icon: '●', discount: 'Standard Tier' },
}

function getTierStyle(tier?: string) {
  if (!tier) return LOYALTY_TIERS.Bronze
  return LOYALTY_TIERS[tier] || LOYALTY_TIERS.Bronze
}

async function searchCustomers() {
  const query = searchQuery.value.trim()
  if (!query) {
    searchResults.value = []
    hasSearched.value = false
    return
  }

  searchLoading.value = true
  hasSearched.value = true

  try {
    // Try both /customers/lookup and /customers search
    const isPhone = /^[\d\s+-]+$/.test(query)
    const url = isPhone
      ? `/customers/lookup?phone=${encodeURIComponent(query)}`
      : `/customers?search=${encodeURIComponent(query)}`

    const res = await api.get<any>(url)
    const data = res.data?.data || res.data

    if (Array.isArray(data)) {
      searchResults.value = data
    } else if (data && typeof data === 'object') {
      searchResults.value = [data]
    } else {
      searchResults.value = []
    }
  } catch (e) {
    console.error('Customer search error', e)
    searchResults.value = []
  } finally {
    searchLoading.value = false
  }
}

let debounceTimer: any = null
watch(searchQuery, (newVal) => {
  clearTimeout(debounceTimer)
  if (newVal.length >= 2) {
    debounceTimer = setTimeout(() => {
      searchCustomers()
    }, 250)
  } else {
    searchResults.value = []
    hasSearched.value = false
  }
})

function handleSelect(customer: Customer) {
  emit('select', customer)
  emit('update:open', false)
  searchQuery.value = ''
  searchResults.value = []
}

function handleClear() {
  emit('clear')
  emit('update:open', false)
}

async function handleCreateCustomer() {
  if (!newCustomer.value.name.trim()) {
    toast.warning('Please enter customer name')
    return
  }

  creating.value = true
  try {
    const res = await api.post<any>('/customers', {
      name: newCustomer.value.name.trim(),
      phone: newCustomer.value.phone.trim() || undefined,
      email: newCustomer.value.email.trim() || undefined,
      address: newCustomer.value.address.trim() || undefined,
    })

    const created = res.data?.data || res.data
    toast.success(`Customer ${created.name} created!`)

    emit('select', created)
    emit('update:open', false)

    // Reset form
    newCustomer.value = { name: '', phone: '', email: '', address: '' }
    activeTab.value = 'lookup'
  } catch {
    toast.error('Failed to create customer')
  } finally {
    creating.value = false
  }
}

function close() {
  emit('update:open', false)
}
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-100 flex items-center justify-center p-4">
    <!-- Backdrop -->
    <div
      class="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
      @click="close"
    />

    <!-- Dialog -->
    <div
      class="relative w-full max-w-lg rounded-2xl bg-card shadow-2xl border border-border overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in-0 zoom-in-95 duration-150 text-foreground"
    >
      <!-- Header -->
      <div class="px-5 py-3.5 bg-surface-subtle border-b border-border flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg bg-cta-muted border border-border-strong flex items-center justify-center text-primary shadow-2xs">
            <User class="w-4 h-4" />
          </div>
          <div>
            <h3 class="text-sm font-bold text-foreground font-display">Customer & Loyalty</h3>
            <p class="text-3xs text-muted-foreground">Search loyalty members or register new walk-in</p>
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

      <!-- Current Selected Customer Banner (if active) -->
      <div
        v-if="currentCustomer"
        class="px-5 py-2.5 bg-cta-muted/40 border-b border-border-strong flex items-center justify-between"
      >
        <div class="flex items-center gap-2.5">
          <div class="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs shrink-0">
            {{ currentCustomer.name.charAt(0).toUpperCase() }}
          </div>
          <div>
            <div class="flex items-center gap-2">
              <span class="text-xs font-bold text-foreground">{{ currentCustomer.name }}</span>
              <span
                :class="[
                  'px-1.5 py-0.2 text-3xs font-semibold rounded-full border',
                  getTierStyle(currentCustomer.loyalty_tier).bg
                ]"
              >
                {{ currentCustomer.loyalty_tier || 'Bronze' }}
              </span>
            </div>
            <span class="text-3xs text-muted-foreground font-mono">{{ currentCustomer.phone || 'No phone' }}</span>
          </div>
        </div>

        <button
          type="button"
          @click="handleClear"
          class="px-2 py-1 rounded-lg text-xs font-semibold text-destructive hover:bg-destructive/10 border border-destructive/20 transition-colors flex items-center gap-1 cursor-pointer"
        >
          <Trash2 class="w-3 h-3" />
          <span>Remove</span>
        </button>
      </div>

      <!-- Tabs (Lookup / Create) -->
      <div class="px-5 pt-2 flex gap-2 border-b border-border bg-card">
        <button
          type="button"
          @click="activeTab = 'lookup'"
          :class="[
            'px-3.5 py-1.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer',
            activeTab === 'lookup'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          ]"
        >
          <Search class="w-3.5 h-3.5" />
          <span>Search Customers</span>
        </button>
        <button
          type="button"
          @click="activeTab = 'create'"
          :class="[
            'px-3.5 py-1.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer',
            activeTab === 'create'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          ]"
        >
          <UserPlus class="w-3.5 h-3.5" />
          <span>New Customer</span>
        </button>
      </div>

      <!-- Tab Content Area -->
      <div class="p-4 sm:p-5 overflow-y-auto flex-1 bg-background">
        <!-- Lookup Tab -->
        <div v-if="activeTab === 'lookup'" class="space-y-3">
          <!-- Search Input -->
          <div class="relative">
            <Search class="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search by phone, name, or email..."
              class="w-full pl-8.5 pr-3 py-2 rounded-xl border border-input bg-surface-subtle text-xs text-foreground placeholder:text-muted-foreground/70 focus:bg-card focus:border-cta focus:ring-2 focus:ring-cta/20 outline-hidden transition-all font-mono"
              autofocus
            />
          </div>

          <!-- Loading Indicator -->
          <div v-if="searchLoading" class="py-6 text-center text-xs text-muted-foreground">
            <div class="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-1.5" />
            Searching customer database...
          </div>

          <!-- Search Results List -->
          <div v-else-if="searchResults.length > 0" class="space-y-2">
            <div
              v-for="cust in searchResults"
              :key="cust.id"
              @click="handleSelect(cust)"
              class="p-2.5 rounded-xl border border-border hover:border-cta bg-card hover:bg-surface-subtle transition-all cursor-pointer flex items-center justify-between group"
            >
              <div class="space-y-0.5">
                <div class="flex items-center gap-2">
                  <span class="text-xs font-bold text-foreground">{{ cust.name }}</span>
                  <span
                    :class="[
                      'px-1.5 py-0.2 text-3xs font-semibold rounded-full border',
                      getTierStyle(cust.loyalty_tier).bg
                    ]"
                  >
                    {{ cust.loyalty_tier || 'Bronze' }}
                  </span>
                </div>
                <div class="flex items-center gap-3 text-3xs text-muted-foreground font-mono">
                  <span v-if="cust.phone" class="flex items-center gap-1">
                    <Phone class="w-3 h-3 text-primary" />
                    {{ cust.phone }}
                  </span>
                  <span v-if="cust.email" class="flex items-center gap-1">
                    <Mail class="w-3 h-3 text-primary" />
                    {{ cust.email }}
                  </span>
                </div>
              </div>

              <div class="text-right">
                <button
                  type="button"
                  class="h-7 px-2.5 rounded-lg bg-cta text-cta-foreground font-bold text-xs hover:brightness-110 transition-colors shadow-2xs cursor-pointer"
                >
                  Select
                </button>
              </div>
            </div>
          </div>

          <!-- Empty State -->
          <div v-else-if="hasSearched" class="py-6 text-center space-y-1.5">
            <p class="text-xs font-bold text-foreground">No customer found</p>
            <p class="text-3xs text-muted-foreground">Would you like to register this customer?</p>
            <button
              type="button"
              @click="() => { activeTab = 'create'; newCustomer.phone = searchQuery; }"
              class="mt-1 px-3 py-1.5 rounded-lg bg-cta text-cta-foreground text-xs font-bold hover:brightness-110 transition-colors inline-flex items-center gap-1 cursor-pointer"
            >
              <UserPlus class="w-3.5 h-3.5" />
              <span>Create Customer</span>
            </button>
          </div>

          <!-- Initial Helper -->
          <div v-else class="py-6 text-center text-xs text-muted-foreground space-y-1">
            <Sparkles class="w-5 h-5 mx-auto text-primary/50 mb-1" />
            <p class="text-3xs">Type 2+ characters to search customer registry</p>
          </div>
        </div>

        <!-- Create Tab -->
        <form v-else-if="activeTab === 'create'" @submit.prevent="handleCreateCustomer" class="space-y-3">
          <div>
            <label class="block text-3xs font-bold text-foreground uppercase mb-1">Customer Full Name *</label>
            <input
              v-model="newCustomer.name"
              type="text"
              required
              placeholder="e.g. Jane Doe"
              class="w-full px-3 py-1.5 rounded-lg border border-input bg-surface-subtle text-xs text-foreground focus:bg-card focus:border-cta focus:ring-2 focus:ring-cta/20 outline-hidden transition-all"
            />
          </div>

          <div>
            <label class="block text-3xs font-bold text-foreground uppercase mb-1">Phone Number</label>
            <input
              v-model="newCustomer.phone"
              type="tel"
              placeholder="e.g. +1 555-0199"
              class="w-full px-3 py-1.5 rounded-lg border border-input bg-surface-subtle text-xs text-foreground focus:bg-card focus:border-cta focus:ring-2 focus:ring-cta/20 outline-hidden transition-all font-mono"
            />
          </div>

          <div>
            <label class="block text-3xs font-bold text-foreground uppercase mb-1">Email Address</label>
            <input
              v-model="newCustomer.email"
              type="email"
              placeholder="e.g. jane@example.com"
              class="w-full px-3 py-1.5 rounded-lg border border-input bg-surface-subtle text-xs text-foreground focus:bg-card focus:border-cta focus:ring-2 focus:ring-cta/20 outline-hidden transition-all"
            />
          </div>

          <div>
            <label class="block text-3xs font-bold text-foreground uppercase mb-1">Delivery / Street Address</label>
            <input
              v-model="newCustomer.address"
              type="text"
              placeholder="e.g. 123 Market St, Unit 4"
              class="w-full px-3 py-1.5 rounded-lg border border-input bg-surface-subtle text-xs text-foreground focus:bg-card focus:border-cta focus:ring-2 focus:ring-cta/20 outline-hidden transition-all"
            />
          </div>

          <div class="pt-2 flex justify-end gap-2">
            <button
              type="button"
              @click="activeTab = 'lookup'"
              class="h-8 px-3.5 rounded-lg border border-border bg-card text-xs font-bold text-foreground hover:bg-surface-subtle transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              :disabled="creating"
              class="h-8 px-4 rounded-lg bg-cta text-cta-foreground text-xs font-bold hover:brightness-110 transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Check class="w-3.5 h-3.5 stroke-[2.5]" />
              <span>{{ creating ? 'Creating...' : 'Save & Select' }}</span>
            </button>
          </div>
        </form>
      </div>

      <!-- Footer -->
      <div class="px-5 py-2.5 bg-surface-subtle border-t border-border flex items-center justify-between text-xs text-muted-foreground">
        <span>Press <kbd class="px-1.5 py-0.5 rounded bg-card border border-border font-mono text-3xs text-foreground">Esc</kbd> to close</span>
        <button
          type="button"
          @click="close"
          class="font-semibold hover:text-foreground transition-colors cursor-pointer text-xs"
        >
          Close
        </button>
      </div>
    </div>
  </div>
</template>
