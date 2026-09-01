// composables/useCustomerLookup.ts
import { ref, computed, watch, onUnmounted, getCurrentInstance } from 'vue'
import api from '@/api/axios'
import { calculateLoyalty, getTierDetails, type CustomerLoyaltyInfo, type TitleCaseTier } from '@/utils/loyalty'

export type LookupStatus = 'idle' | 'searching' | 'found' | 'not_found' | 'error'

export interface Customer {
  id?: string | number
  name: string
  phone?: string
  email?: string
  address?: string
  delivery_address?: string
  region?: string
  loyalty_tier?: string
  total_spent?: number | string
  total_purchased?: number
  total_orders?: number
  last_purchase_at?: string | null
  preferred_delivery_company?: string
  preferredDeliveryCompany?: string
  [key: string]: any
}

export { calculateLoyalty, getTierDetails, type CustomerLoyaltyInfo, type TitleCaseTier }

export function useCustomerLookup(options?: {
  initialPhone?: string
  initialName?: string
  debounceMs?: number
}) {
  const phone = ref(options?.initialPhone || '')
  const name = ref(options?.initialName || '')
  const matchedCustomer = ref<Customer | null>(null)
  const suggestions = ref<Customer[]>([])
  const status = ref<LookupStatus>('idle')
  const errorMessage = ref<string | null>(null)

  // Backward compatibility alias
  const customerSuggestions = suggestions

  const debounceMs = options?.debounceMs ?? 300
  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  let abortController: AbortController | null = null
  const cache = new Map<string, Customer[]>()

  const loyaltyInfo = computed<CustomerLoyaltyInfo | null>(() => {
    if (!matchedCustomer.value) return null
    return calculateLoyalty(matchedCustomer.value)
  })

  async function performSearch(query: string) {
    const cleanQuery = query.trim()
    if (!cleanQuery || cleanQuery.length < 2) {
      suggestions.value = []
      status.value = 'idle'
      errorMessage.value = null
      return
    }

    const cacheKey = cleanQuery.toLowerCase()
    if (cache.has(cacheKey)) {
      const cached = cache.get(cacheKey) || []
      suggestions.value = cached
      status.value = cached.length > 0 ? 'found' : 'not_found'
      return
    }

    if (abortController) {
      abortController.abort()
    }
    abortController = new AbortController()

    status.value = 'searching'
    errorMessage.value = null

    try {
      // Search with limit=8 for high-speed autocomplete
      const res = await api.get<any>('/customers', {
        params: { search: cleanQuery, limit: 8 },
        signal: abortController.signal,
      })
      const list = res.data?.data || res.data || []
      const results: Customer[] = Array.isArray(list) ? list : []

      cache.set(cacheKey, results)
      if (cache.size > 100) {
        const firstKey = cache.keys().next().value
        if (firstKey) cache.delete(firstKey)
      }

      suggestions.value = results
      status.value = results.length > 0 ? 'found' : 'not_found'
    } catch (err: any) {
      if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') return
      status.value = 'error'
      errorMessage.value = err instanceof Error ? err.message : 'Lookup failed'
    }
  }

  // Legacy manual lookup function (supports backward compatibility)
  async function lookup(query: string) {
    if (!query || query.trim().length < 2) {
      suggestions.value = []
      status.value = 'idle'
      return
    }
    await performSearch(query)
  }

  function selectCustomer(cust: Customer) {
    matchedCustomer.value = {
      ...cust,
      phone: cust.phone || '',
      name: cust.name || '',
      email: cust.email || '',
      address: cust.delivery_address || cust.address || '',
      preferredDeliveryCompany: cust.preferred_delivery_company || cust.preferredDeliveryCompany,
    }
    phone.value = cust.phone || ''
    name.value = cust.name || ''
    suggestions.value = []
    status.value = 'found'
    errorMessage.value = null
  }

  function dismissSuggestions() {
    suggestions.value = []
  }

  function resetCustomer() {
    phone.value = ''
    name.value = ''
    matchedCustomer.value = null
    suggestions.value = []
    status.value = 'idle'
    errorMessage.value = null
  }

  // Legacy clear alias
  const clear = resetCustomer

  function handleSetPhone(val: string) {
    if (matchedCustomer.value && matchedCustomer.value.phone !== val) {
      matchedCustomer.value = null
    }
    phone.value = val
  }

  function handleSetName(val: string) {
    if (matchedCustomer.value && matchedCustomer.value.name !== val) {
      matchedCustomer.value = null
    }
    name.value = val
  }

  // Watch for phone & name typing to trigger debounced search if not already matched
  watch([phone, name], ([newPhone, newName]) => {
    if (debounceTimer) clearTimeout(debounceTimer)

    if (matchedCustomer.value) {
      suggestions.value = []
      return
    }

    const activeQuery = newPhone.trim() || newName.trim()
    if (!activeQuery || activeQuery.length < 2) {
      suggestions.value = []
      status.value = 'idle'
      return
    }

    debounceTimer = setTimeout(() => {
      performSearch(activeQuery)
    }, debounceMs)
  })

  if (getCurrentInstance()) {
    onUnmounted(() => {
      if (debounceTimer) clearTimeout(debounceTimer)
      if (abortController) abortController.abort()
    })
  }

  return {
    phone,
    name,
    matchedCustomer,
    suggestions,
    customerSuggestions,
    status,
    errorMessage,
    loyaltyInfo,
    performSearch,
    lookup,
    selectCustomer,
    dismissSuggestions,
    resetCustomer,
    clear,
    handleSetPhone,
    handleSetName,
  }
}