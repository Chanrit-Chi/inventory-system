// composables/useCustomerLookup.ts
import { ref } from 'vue'
import api from '@/api/axios'

export interface Customer {
  id: number
  name: string
  phone: string
  email?: string
  address?: string
  loyalty_tier?: string
  preferred_delivery_company?: string
  [key: string]: any
}

export function useCustomerLookup() {
  const customerSuggestions = ref<Customer[]>([])
  const matchedCustomer = ref<Customer | null>(null)

  const lookup = async (phone: string) => {
    if (!phone.trim()) return

    customerSuggestions.value = []
    try {
      const res = await api.get<any>(`/customers/lookup?phone=${phone}`)
      const raw = res.data

      if (Array.isArray(raw)) {
        customerSuggestions.value = raw.slice(0, 5)
      } else if (raw?.data) {
        customerSuggestions.value = Array.isArray(raw.data)
          ? raw.data.slice(0, 5)
          : [raw.data]
      }
    } catch (e) {
      console.error('Customer lookup error:', e)
    }
  }

  const selectCustomer = (cust: Customer) => {
    matchedCustomer.value = cust
    // Ensure we have the display fields populated
    matchedCustomer.value.phone = cust.phone || ''
    matchedCustomer.value.name = cust.name
    matchedCustomer.value.email = cust.email || ''
    matchedCustomer.value.address = cust.address || ''
    if (cust.preferred_delivery_company) {
      matchedCustomer.value.preferredDeliveryCompany = cust.preferred_delivery_company
    }
    customerSuggestions.value = []
  }

  const clear = () => {
    customerSuggestions.value = []
    matchedCustomer.value = null
  }

  return {
    customerSuggestions,
    matchedCustomer,
    lookup,
    selectCustomer,
    clear
  }
}