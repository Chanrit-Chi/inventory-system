import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api, { ApiError } from '@/api/axios'

export interface BankAccount {
  id: string
  bank_name: string
  account_name: string
  account_number: string
  account_type: 'checking' | 'savings' | 'business' | string
  currency: string
  is_default: boolean
  is_active?: boolean
  color?: string
  balance?: number
  logo_icon?: string
  qr_image_url?: string
  created_at: string
  updated_at: string
}

export const useBankAccountStore = defineStore('bankAccount', () => {
  const accounts = ref<BankAccount[]>([])
  const currentAccount = ref<BankAccount | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchAccounts() {
    loading.value = true
    error.value = null
    try {
      const res = await api.get('/bank-accounts')
      accounts.value = res.data.data || []
    } catch (e: unknown) {
      error.value = e instanceof ApiError ? e.message : 'Failed to fetch bank accounts'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function fetchAccount(id: string) {
    loading.value = true
    error.value = null
    try {
      const res = await api.get(`/bank-accounts/${id}`)
      currentAccount.value = res.data.data
      return res.data.data
    } catch (e: unknown) {
      error.value = e instanceof ApiError ? e.message : 'Failed to fetch bank account'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function createAccount(data: Partial<BankAccount>) {
    loading.value = true
    error.value = null
    try {
      const res = await api.post('/bank-accounts', data)
      const account = res.data.data as BankAccount
      accounts.value.push(account)
      return account
    } catch (e: unknown) {
      error.value = e instanceof ApiError ? e.message : 'Failed to create bank account'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function updateAccount(id: string, data: Partial<BankAccount>) {
    loading.value = true
    error.value = null
    try {
      const res = await api.patch(`/bank-accounts/${id}`, data)
      const account = res.data.data as BankAccount
      const idx = accounts.value.findIndex(a => a.id === id)
      if (idx !== -1) accounts.value[idx] = account
      if (currentAccount.value?.id === id) currentAccount.value = account
      return account
    } catch (e: unknown) {
      error.value = e instanceof ApiError ? e.message : 'Failed to update bank account'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function deleteAccount(id: string) {
    loading.value = true
    error.value = null
    try {
      await api.delete(`/bank-accounts/${id}`)
      accounts.value = accounts.value.filter(a => a.id !== id)
      if (currentAccount.value?.id === id) currentAccount.value = null
    } catch (e: unknown) {
      error.value = e instanceof ApiError ? e.message : 'Failed to delete bank account'
      throw e
    } finally {
      loading.value = false
    }
  }

  const isLoading = computed(() => loading.value)
  const accountList = computed(() => accounts.value)

  return {
    accounts,
    currentAccount,
    loading,
    error,
    isLoading,
    accountList,
    fetchAccounts,
    fetchAccount,
    createAccount,
    updateAccount,
    deleteAccount,
  }
})
