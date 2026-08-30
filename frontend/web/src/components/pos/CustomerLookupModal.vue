<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Modal from '@/components/ui/Modal.vue'
import { cn } from '@/lib/utils'
import type { Customer } from '@/composables/useCustomerLookup'
import api from '@/api/axios'

interface Props {
  modelValue: boolean
  phone?: string
  name?: string
}

const props = withDefaults(defineProps<Props>(), {
  phone: '',
  name: '',
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'select', customer: Customer): void
  (e: 'clear'): void
}>()

const localPhone = ref(props.phone)
const localName = ref(props.name)
const suggestions = ref<Customer[]>([])
const matchedCustomer = ref<Customer | null>(null)
const isSearching = ref(false)
const hasSearched = ref(false)

const LOYALTY_STYLES: Record<string, { bg: string; text: string; border: string; icon: string; label: string }> = {
  Platinum: { bg: 'bg-blue-50 dark:bg-blue-950/30', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-200 dark:border-blue-800', icon: '✦', label: 'Platinum Tier' },
  Gold: { bg: 'bg-amber-50 dark:bg-amber-950/30', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-200 dark:border-amber-800', icon: '★', label: 'Gold Tier' },
  Silver: { bg: 'bg-slate-100 dark:bg-slate-800/50', text: 'text-slate-600 dark:text-slate-300', border: 'border-slate-300 dark:border-slate-700', icon: '▲', label: 'Silver Tier' },
  Bronze: { bg: 'bg-orange-50 dark:bg-orange-950/30', text: 'text-orange-700 dark:text-orange-300', border: 'border-orange-200 dark:border-orange-800', icon: '●', label: 'Bronze Tier' },
}

const loyaltyStyle = computed(() => {
  const tier = matchedCustomer.value?.loyalty_tier
  if (!tier) return null
  return LOYALTY_STYLES[tier] || LOYALTY_STYLES['Bronze']
})

async function lookup(phone: string) {
  if (!phone.trim()) {
    suggestions.value = []
    return
  }
  isSearching.value = true
  hasSearched.value = true
  try {
    const res = await api.get<any>(`/customers/lookup?phone=${encodeURIComponent(phone)}`)
    const raw = res.data
    if (Array.isArray(raw)) {
      suggestions.value = raw.slice(0, 5)
    } else if (raw?.data) {
      suggestions.value = Array.isArray(raw.data) ? raw.data.slice(0, 5) : [raw.data]
    } else {
      suggestions.value = []
    }
  } catch (e) {
    console.error('Customer lookup error:', e)
    suggestions.value = []
  } finally {
    isSearching.value = false
  }
}

function selectCustomer(cust: Customer) {
  matchedCustomer.value = cust
  localName.value = cust.name
  suggestions.value = []
  emit('select', cust)
}

function handleReset() {
  localPhone.value = ''
  localName.value = ''
  matchedCustomer.value = null
  suggestions.value = []
  hasSearched.value = false
  emit('clear')
}

function onPhoneInput() {
  if (localPhone.value.length >= 3) {
    lookup(localPhone.value)
  } else {
    suggestions.value = []
    hasSearched.value = false
  }
}

watch(() => props.phone, (v) => {
  localPhone.value = v
  if (v && v.length >= 3) lookup(v)
}, { immediate: true })

watch(() => props.name, (v) => {
  localName.value = v
})

function close() {
  emit('update:modelValue', false)
}
</script>

<template>
  <Modal :model-value="modelValue" title="Customer Lookup" description="Find a customer by phone number" size="md" @update:model-value="close">
    <div class="space-y-4">
      <div class="flex flex-col gap-1.5">
        <label class="text-sm font-medium text-foreground">Phone number</label>
        <input
          v-model="localPhone"
          type="tel"
          inputmode="tel"
          placeholder="Enter phone number"
          class="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          @input="onPhoneInput"
        />
      </div>

      <div class="flex flex-col gap-1.5">
        <label class="text-sm font-medium text-foreground">Name</label>
        <input
          v-model="localName"
          type="text"
          placeholder="Customer name"
          class="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          readonly
        />
      </div>

      <div v-if="isSearching" class="flex items-center gap-2 text-sm text-muted-foreground">
        <svg class="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3"/>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
        Searching...
      </div>

      <div v-if="matchedCustomer" class="rounded-lg border border-border bg-card p-4 space-y-3">
        <div class="flex items-start justify-between">
          <div>
            <p class="font-semibold text-foreground">{{ matchedCustomer.name }}</p>
            <p class="text-sm text-muted-foreground">{{ matchedCustomer.phone }}</p>
            <p v-if="matchedCustomer.email" class="text-sm text-muted-foreground">{{ matchedCustomer.email }}</p>
          </div>
          <div v-if="loyaltyStyle" class="flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium"
            :class="cn(loyaltyStyle.bg, loyaltyStyle.text, loyaltyStyle.border)">
            <span>{{ loyaltyStyle.icon }}</span>
            <span>{{ loyaltyStyle.label }}</span>
          </div>
        </div>
        <p v-if="matchedCustomer.address" class="text-sm text-muted-foreground">📍 {{ matchedCustomer.address }}</p>
        <button
          class="text-sm text-muted-foreground hover:text-foreground underline"
          @click="handleReset"
        >Change customer</button>
      </div>

      <div v-else-if="hasSearched && !isSearching" class="rounded-lg border border-border bg-card p-6 text-center">
        <p class="text-sm text-muted-foreground">No customer found with that phone number.</p>
      </div>

      <div v-if="suggestions.length > 0 && !matchedCustomer" class="space-y-2">
        <p class="text-xs font-medium text-muted-foreground uppercase tracking-wide">Suggestions</p>
        <button
          v-for="cust in suggestions"
          :key="cust.id"
          class="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-border hover:bg-muted transition-colors text-left"
          @click="selectCustomer(cust)"
        >
          <div>
            <p class="font-medium text-foreground text-sm">{{ cust.name }}</p>
            <p class="text-xs text-muted-foreground">{{ cust.phone }}</p>
          </div>
          <svg class="h-4 w-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 5l7 7-7 7"/>
          </svg>
        </button>
      </div>
    </div>
  </Modal>
</template>