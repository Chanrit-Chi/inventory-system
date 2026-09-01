<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Modal from '@/components/ui/Modal.vue'
import Badge from '@/components/ui/Badge.vue'
import type { Customer } from '@/composables/useCustomerLookup'
import { getTierDetails, calculateLoyalty } from '@/utils/loyalty'
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

const loyaltyStyle = computed(() => {
  if (!matchedCustomer.value) return null
  const info = calculateLoyalty(matchedCustomer.value)
  const details = getTierDetails(info.tier)
  return {
    ...details,
    icon: details.tier === 'Platinum' ? '✦' : details.tier === 'Gold' ? '★' : details.tier === 'Silver' ? '▲' : '●',
  }
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
    <div class="space-y-3.5">
      <div class="flex flex-col gap-1">
        <label class="text-3xs font-bold uppercase tracking-wider text-muted-foreground">Phone number</label>
        <input
          v-model="localPhone"
          type="tel"
          inputmode="tel"
          placeholder="Enter phone number"
          class="w-full px-3 py-1.5 rounded-lg border border-input bg-surface-subtle text-xs text-foreground placeholder:text-muted-foreground/60 focus:bg-card focus:outline-none focus:ring-2 focus:ring-cta/20 focus:border-cta font-mono"
          @input="onPhoneInput"
        />
      </div>

      <div class="flex flex-col gap-1">
        <label class="text-3xs font-bold uppercase tracking-wider text-muted-foreground">Customer Name</label>
        <input
          v-model="localName"
          type="text"
          placeholder="Customer name"
          class="w-full px-3 py-1.5 rounded-lg border border-input bg-surface-subtle text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
          readonly
        />
      </div>

      <div v-if="isSearching" class="flex items-center gap-2 text-xs text-muted-foreground">
        <svg class="animate-spin h-3.5 w-3.5 text-primary" viewBox="0 0 24 24" fill="none">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3"/>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
        Searching customer records...
      </div>

      <div v-if="matchedCustomer" class="rounded-xl border border-border bg-surface-subtle p-3 space-y-2">
        <div class="flex items-start justify-between">
          <div>
            <p class="font-bold text-xs text-foreground">{{ matchedCustomer.name }}</p>
            <p class="text-3xs font-mono text-muted-foreground">{{ matchedCustomer.phone }}</p>
            <p v-if="matchedCustomer.email" class="text-3xs text-muted-foreground">{{ matchedCustomer.email }}</p>
          </div>
          <Badge
            v-if="loyaltyStyle"
            :variant="loyaltyStyle.variant"
            class="text-[10px] px-1.5 py-0.5 font-semibold gap-1"
          >
            <span>{{ loyaltyStyle.icon }}</span>
            <span>{{ loyaltyStyle.label }}</span>
          </Badge>
        </div>
        <p v-if="matchedCustomer.address" class="text-3xs text-muted-foreground">📍 {{ matchedCustomer.address }}</p>
        <button
          class="text-xs text-primary hover:underline font-semibold cursor-pointer"
          @click="handleReset"
        >Change customer</button>
      </div>

      <div v-else-if="hasSearched && !isSearching" class="rounded-xl border border-border bg-surface-subtle p-4 text-center">
        <p class="text-xs text-muted-foreground">No customer found with that phone number.</p>
      </div>

      <div v-if="suggestions.length > 0 && !matchedCustomer" class="space-y-1.5">
        <p class="text-3xs font-bold text-muted-foreground uppercase tracking-wider">Matching Customers</p>
        <button
          v-for="cust in suggestions"
          :key="cust.id"
          class="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-border bg-surface-subtle hover:bg-card hover:border-cta transition-all text-left cursor-pointer"
          @click="selectCustomer(cust)"
        >
          <div>
            <p class="font-bold text-xs text-foreground">{{ cust.name }}</p>
            <p class="text-3xs font-mono text-muted-foreground">{{ cust.phone }}</p>
          </div>
          <svg class="h-3.5 w-3.5 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 5l7 7-7 7"/>
          </svg>
        </button>
      </div>
    </div>
  </Modal>
</template>