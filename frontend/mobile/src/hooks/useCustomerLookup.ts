import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { searchCustomers } from '../api/endpoints'
import type { Customer } from '../types'

export type LookupStatus = 'idle' | 'searching' | 'found' | 'not_found' | 'error'

export interface CustomerLoyaltyInfo {
  tier: 'Bronze' | 'Silver' | 'Gold' | 'Platinum'
  tierColor: string
  totalSpent: number
  totalPurchased: number
  lastPurchaseDate?: string | null
}

export function calculateLoyalty(customer: Customer): CustomerLoyaltyInfo {
  const spent = typeof customer.total_spent === 'number' 
    ? customer.total_spent 
    : parseFloat(customer.total_spent || '0') || 0
  const orders = customer.total_purchased ?? 0

  let tier: 'Bronze' | 'Silver' | 'Gold' | 'Platinum' = 'Bronze'
  let tierColor = '#8A5D3B' // Bronze

  if (spent >= 1000 || orders >= 20) {
    tier = 'Platinum'
    tierColor = '#5B616E'
  } else if (spent >= 500 || orders >= 10) {
    tier = 'Gold'
    tierColor = '#B8710A'
  } else if (spent >= 200 || orders >= 3) {
    tier = 'Silver'
    tierColor = '#4B5563'
  }

  return {
    tier,
    tierColor,
    totalSpent: spent,
    totalPurchased: orders,
    lastPurchaseDate: customer.last_purchase_at,
  }
}

export function useCustomerLookup() {
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [matchedCustomer, setMatchedCustomer] = useState<Customer | null>(null)
  const [suggestions, setSuggestions] = useState<Customer[]>([])
  const [status, setStatus] = useState<LookupStatus>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const cacheRef = useRef<Map<string, Customer[]>>(new Map())
  const lastQueryRef = useRef<string>('')

  const performSearch = useCallback(async (query: string) => {
    const cleanQuery = query.trim()
    if (!cleanQuery || cleanQuery.length < 2) {
      setSuggestions([])
      setStatus('idle')
      setErrorMessage(null)
      return
    }

    // Return instant cached response if available
    const cacheKey = cleanQuery.toLowerCase()
    if (cacheRef.current.has(cacheKey)) {
      const cached = cacheRef.current.get(cacheKey) || []
      setSuggestions(cached)
      setStatus(cached.length > 0 ? 'found' : 'not_found')
      return
    }

    // Cancel any previous in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    const controller = new AbortController()
    abortControllerRef.current = controller

    setStatus('searching')
    setErrorMessage(null)

    try {
      const results = await searchCustomers(cleanQuery, 8, controller.signal)
      cacheRef.current.set(cacheKey, results)

      // Limit in-memory cache to 100 entries to prevent memory growth
      if (cacheRef.current.size > 100) {
        const firstKey = cacheRef.current.keys().next().value
        if (firstKey) cacheRef.current.delete(firstKey)
      }

      setSuggestions(results)
      setStatus(results.length > 0 ? 'found' : 'not_found')
    } catch (err: unknown) {
      // Ignore aborted requests
      if (err instanceof Error && err.name === 'CanceledError') return
      setStatus('error')
      setErrorMessage(err instanceof Error ? err.message : 'Lookup failed')
    }
  }, [])

  // Trigger search when phone input changes (if no customer is actively locked/selected)
  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
    }

    // If user has already explicitly selected a customer, do not search
    if (matchedCustomer) {
      setSuggestions([])
      return
    }

    const activeQuery = phone.trim() || name.trim()
    if (!activeQuery || activeQuery.length < 2) {
      setSuggestions([])
      setStatus('idle')
      lastQueryRef.current = ''
      return
    }

    debounceTimer.current = setTimeout(() => {
      lastQueryRef.current = activeQuery
      performSearch(activeQuery)
    }, 300)

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current)
      }
    }
  }, [phone, name, matchedCustomer, performSearch])

  // Explicitly select a customer from suggestions popup
  const selectCustomer = useCallback((customer: Customer) => {
    setMatchedCustomer(customer)
    setPhone(customer.phone || '')
    setName(customer.name || '')
    setSuggestions([])
    setStatus('found')
    setErrorMessage(null)
  }, [])

  // Dismiss suggestions list without changing text
  const dismissSuggestions = useCallback(() => {
    setSuggestions([])
  }, [])

  // Full reset
  const resetCustomer = useCallback(() => {
    setPhone('')
    setName('')
    setMatchedCustomer(null)
    setSuggestions([])
    setStatus('idle')
    setErrorMessage(null)
    lastQueryRef.current = ''
  }, [])

  const loyaltyInfo = useMemo(() => {
    if (!matchedCustomer) return null
    return calculateLoyalty(matchedCustomer)
  }, [matchedCustomer])

  const handleSetPhone = useCallback((val: string) => {
    setMatchedCustomer((prev) => {
      if (prev && prev.phone !== val) {
        return null
      }
      return prev
    })
    setPhone(val)
  }, [])

  const handleSetName = useCallback((val: string) => {
    setMatchedCustomer((prev) => {
      if (prev && prev.name !== val) {
        return null
      }
      return prev
    })
    setName(val)
  }, [])

  return useMemo(
    () => ({
      phone,
      setPhone: handleSetPhone,
      name,
      setName: handleSetName,
      matchedCustomer,
      suggestions,
      status,
      errorMessage,
      loyaltyInfo,
      selectCustomer,
      dismissSuggestions,
      resetCustomer,
    }),
    [
      phone,
      handleSetPhone,
      name,
      handleSetName,
      matchedCustomer,
      suggestions,
      status,
      errorMessage,
      loyaltyInfo,
      selectCustomer,
      dismissSuggestions,
      resetCustomer,
    ]
  )
}
