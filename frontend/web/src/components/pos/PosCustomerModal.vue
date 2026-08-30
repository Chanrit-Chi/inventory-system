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
  Platinum: { bg: 'bg-indigo-50 text-indigo-700 border-indigo-200', text: 'text-indigo-700', border: 'border-indigo-200', icon: '✦', discount: '15% Member Discount' },
  Gold: { bg: 'bg-amber-50 text-amber-800 border-amber-300', text: 'text-amber-800', border: 'border-amber-300', icon: '★', discount: '10% Member Discount' },
  Silver: { bg: 'bg-slate-100 text-slate-700 border-slate-300', text: 'text-slate-700', border: 'border-slate-300', icon: '▲', discount: '5% Member Discount' },
  Bronze: { bg: 'bg-orange-50 text-orange-800 border-orange-200', text: 'text-orange-800', border: 'border-orange-200', icon: '●', discount: 'Standard Tier' },
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
  <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <!-- Backdrop -->
    <div
      class="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
      @click="close"
    />

    <!-- Dialog -->
    <div
      class="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-[#E8E2D9] overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in-0 zoom-in-95 duration-150"
    >
      <!-- Header -->
      <div class="px-6 py-4 bg-[#FAF7F2] border-b border-[#E8E2D9] flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <div class="w-9 h-9 rounded-xl bg-[#FFF3E0] border border-[#FFDCC4] flex items-center justify-center text-[#924C00]">
            <User class="w-5 h-5" />
          </div>
          <div>
            <h3 class="text-base font-bold text-[#1A1C1C] font-display">Customer & Loyalty</h3>
            <p class="text-2xs text-[#6B6358]">Search loyalty members or register new walk-in</p>
          </div>
        </div>

        <button
          type="button"
          @click="close"
          class="p-1.5 rounded-xl text-[#6B6358] hover:text-[#1A1C1C] hover:bg-[#F0EAE1] transition-colors"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Current Selected Customer Banner (if active) -->
      <div
        v-if="currentCustomer"
        class="px-6 py-3 bg-[#FFF9F2] border-b border-[#FFDCC4] flex items-center justify-between"
      >
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-full bg-[#924C00] text-white flex items-center justify-center font-bold text-xs">
            {{ currentCustomer.name.charAt(0).toUpperCase() }}
          </div>
          <div>
            <div class="flex items-center gap-2">
              <span class="text-xs font-bold text-[#1A1C1C]">{{ currentCustomer.name }}</span>
              <span
                :class="[
                  'px-1.5 py-0.2 text-3xs font-semibold rounded-full border',
                  getTierStyle(currentCustomer.loyalty_tier).bg
                ]"
              >
                {{ currentCustomer.loyalty_tier || 'Bronze' }}
              </span>
            </div>
            <span class="text-2xs text-[#6B6358] font-mono">{{ currentCustomer.phone || 'No phone' }}</span>
          </div>
        </div>

        <button
          type="button"
          @click="handleClear"
          class="px-2.5 py-1 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50 border border-red-200 transition-colors flex items-center gap-1"
        >
          <Trash2 class="w-3 h-3" />
          <span>Remove</span>
        </button>
      </div>

      <!-- Tabs (Lookup / Create) -->
      <div class="px-6 pt-3 flex gap-2 border-b border-[#E8E2D9] bg-white">
        <button
          type="button"
          @click="activeTab = 'lookup'"
          :class="[
            'px-4 py-2 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer',
            activeTab === 'lookup'
              ? 'border-[#924C00] text-[#924C00]'
              : 'border-transparent text-[#6B6358] hover:text-[#1A1C1C]'
          ]"
        >
          <Search class="w-3.5 h-3.5" />
          <span>Search Customers</span>
        </button>
        <button
          type="button"
          @click="activeTab = 'create'"
          :class="[
            'px-4 py-2 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer',
            activeTab === 'create'
              ? 'border-[#924C00] text-[#924C00]'
              : 'border-transparent text-[#6B6358] hover:text-[#1A1C1C]'
          ]"
        >
          <UserPlus class="w-3.5 h-3.5" />
          <span>New Customer</span>
        </button>
      </div>

      <!-- Tab Content Area -->
      <div class="p-6 overflow-y-auto flex-1">
        <!-- Lookup Tab -->
        <div v-if="activeTab === 'lookup'" class="space-y-4">
          <!-- Search Input -->
          <div class="relative">
            <Search class="w-4 h-4 text-[#6B6358] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search by phone, name, or email..."
              class="w-full pl-9.5 pr-4 py-2.5 rounded-xl border border-[#E8E2D9] bg-[#FAF7F2] text-sm text-[#1A1C1C] placeholder:text-[#6B6358]/70 focus:bg-white focus:border-[#FF8800] focus:ring-2 focus:ring-[#FF8800]/20 outline-hidden transition-all"
              autofocus
            />
          </div>

          <!-- Loading Indicator -->
          <div v-if="searchLoading" class="py-6 text-center text-xs text-[#6B6358]">
            <div class="w-5 h-5 border-2 border-[#924C00] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            Searching customer database...
          </div>

          <!-- Search Results List -->
          <div v-else-if="searchResults.length > 0" class="space-y-2">
            <div
              v-for="cust in searchResults"
              :key="cust.id"
              @click="handleSelect(cust)"
              class="p-3.5 rounded-xl border border-[#E8E2D9] hover:border-[#FF8800] bg-[#FAF7F2] hover:bg-[#FFF9F2] transition-all cursor-pointer flex items-center justify-between group"
            >
              <div class="space-y-1">
                <div class="flex items-center gap-2">
                  <span class="text-sm font-bold text-[#1A1C1C]">{{ cust.name }}</span>
                  <span
                    :class="[
                      'px-2 py-0.5 text-2xs font-semibold rounded-full border',
                      getTierStyle(cust.loyalty_tier).bg
                    ]"
                  >
                    {{ cust.loyalty_tier || 'Bronze' }}
                  </span>
                </div>
                <div class="flex items-center gap-3 text-xs text-[#6B6358] font-mono">
                  <span v-if="cust.phone" class="flex items-center gap-1">
                    <Phone class="w-3 h-3 text-[#924C00]" />
                    {{ cust.phone }}
                  </span>
                  <span v-if="cust.email" class="flex items-center gap-1">
                    <Mail class="w-3 h-3 text-[#924C00]" />
                    {{ cust.email }}
                  </span>
                </div>
              </div>

              <div class="text-right">
                <button
                  type="button"
                  class="px-3 py-1.5 rounded-lg bg-[#FF8800] text-[#1A1C1C] font-bold text-xs group-hover:bg-[#E67A00] transition-colors shadow-2xs"
                >
                  Select
                </button>
              </div>
            </div>
          </div>

          <!-- Empty State -->
          <div v-else-if="hasSearched" class="py-8 text-center space-y-2">
            <p class="text-sm font-semibold text-[#1A1C1C]">No customer found</p>
            <p class="text-xs text-[#6B6358]">Would you like to register this customer?</p>
            <button
              type="button"
              @click="() => { activeTab = 'create'; newCustomer.phone = searchQuery; }"
              class="mt-2 px-4 py-2 rounded-xl bg-[#924C00] text-white text-xs font-bold hover:bg-[#7A3F00] transition-colors inline-flex items-center gap-1.5"
            >
              <UserPlus class="w-3.5 h-3.5" />
              <span>Create Customer</span>
            </button>
          </div>

          <!-- Initial Helper -->
          <div v-else class="py-8 text-center text-xs text-[#6B6358] space-y-1">
            <Sparkles class="w-6 h-6 mx-auto text-[#924C00]/50 mb-1" />
            <p>Type 2+ characters to search customer registry</p>
          </div>
        </div>

        <!-- Create Tab -->
        <form v-else-if="activeTab === 'create'" @submit.prevent="handleCreateCustomer" class="space-y-3.5">
          <div>
            <label class="block text-xs font-bold text-[#1A1C1C] mb-1">Customer Full Name *</label>
            <input
              v-model="newCustomer.name"
              type="text"
              required
              placeholder="e.g. Jane Doe"
              class="w-full px-3.5 py-2.5 rounded-xl border border-[#E8E2D9] bg-[#FAF7F2] text-sm text-[#1A1C1C] focus:bg-white focus:border-[#FF8800] focus:ring-2 focus:ring-[#FF8800]/20 outline-hidden transition-all"
            />
          </div>

          <div>
            <label class="block text-xs font-bold text-[#1A1C1C] mb-1">Phone Number</label>
            <input
              v-model="newCustomer.phone"
              type="tel"
              placeholder="e.g. +1 555-0199"
              class="w-full px-3.5 py-2.5 rounded-xl border border-[#E8E2D9] bg-[#FAF7F2] text-sm text-[#1A1C1C] focus:bg-white focus:border-[#FF8800] focus:ring-2 focus:ring-[#FF8800]/20 outline-hidden transition-all"
            />
          </div>

          <div>
            <label class="block text-xs font-bold text-[#1A1C1C] mb-1">Email Address</label>
            <input
              v-model="newCustomer.email"
              type="email"
              placeholder="e.g. jane@example.com"
              class="w-full px-3.5 py-2.5 rounded-xl border border-[#E8E2D9] bg-[#FAF7F2] text-sm text-[#1A1C1C] focus:bg-white focus:border-[#FF8800] focus:ring-2 focus:ring-[#FF8800]/20 outline-hidden transition-all"
            />
          </div>

          <div>
            <label class="block text-xs font-bold text-[#1A1C1C] mb-1">Delivery / Street Address</label>
            <input
              v-model="newCustomer.address"
              type="text"
              placeholder="e.g. 123 Market St, Unit 4"
              class="w-full px-3.5 py-2.5 rounded-xl border border-[#E8E2D9] bg-[#FAF7F2] text-sm text-[#1A1C1C] focus:bg-white focus:border-[#FF8800] focus:ring-2 focus:ring-[#FF8800]/20 outline-hidden transition-all"
            />
          </div>

          <div class="pt-2 flex justify-end gap-2">
            <button
              type="button"
              @click="activeTab = 'lookup'"
              class="px-4 py-2 rounded-xl border border-[#E8E2D9] bg-white text-xs font-bold text-[#1A1C1C] hover:bg-[#FAF7F2] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              :disabled="creating"
              class="px-5 py-2 rounded-xl bg-[#FF8800] text-[#1A1C1C] text-xs font-bold hover:bg-[#E67A00] transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Check class="w-4 h-4 stroke-[2.5]" />
              <span>{{ creating ? 'Creating...' : 'Save & Select' }}</span>
            </button>
          </div>
        </form>
      </div>

      <!-- Footer -->
      <div class="px-6 py-3 bg-[#FAF7F2] border-t border-[#E8E2D9] flex items-center justify-between text-xs text-[#6B6358]">
        <span>Press <kbd class="px-1.5 py-0.5 rounded bg-white border border-[#E8E2D9] font-mono text-2xs">Esc</kbd> to close</span>
        <button
          type="button"
          @click="close"
          class="font-semibold hover:text-[#1A1C1C] transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  </div>
</template>
