import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api, { ApiError } from '@/api/axios'

export interface User {
  id: string
  name: string
  email: string
  phone?: string
  role: string
  status: 'active' | 'inactive'
  avatar_url?: string
  created_at: string
  updated_at: string
}

export interface UserFilters {
  page?: number
  per_page?: number
  search?: string
  role?: string
  status?: string
}

export const useUserStore = defineStore('user', () => {
  const users = ref<User[]>([])
  const currentUser = ref<User | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const meta = ref<{ current_page: number; last_page: number; per_page: number; total: number } | null>(null)

  async function fetchUsers(filters: UserFilters = {}) {
    loading.value = true
    error.value = null
    try {
      const res = await api.get('/users', { params: filters })
      users.value = res.data.data || []
      meta.value = res.data.meta
    } catch (e: unknown) {
      error.value = e instanceof ApiError ? e.message : 'Failed to fetch users'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function fetchUser(id: string) {
    loading.value = true
    error.value = null
    try {
      const res = await api.get(`/users/${id}`)
      currentUser.value = res.data.data
      return res.data.data
    } catch (e: unknown) {
      error.value = e instanceof ApiError ? e.message : 'Failed to fetch user'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function createUser(data: Partial<User>) {
    loading.value = true
    error.value = null
    try {
      const res = await api.post('/users', data)
      const user = res.data.data as User
      users.value.push(user)
      return user
    } catch (e: unknown) {
      error.value = e instanceof ApiError ? e.message : 'Failed to create user'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function updateUser(id: string, data: Partial<User>) {
    loading.value = true
    error.value = null
    try {
      const res = await api.patch(`/users/${id}`, data)
      const user = res.data.data as User
      const idx = users.value.findIndex(u => u.id === id)
      if (idx !== -1) users.value[idx] = user
      if (currentUser.value?.id === id) currentUser.value = user
      return user
    } catch (e: unknown) {
      error.value = e instanceof ApiError ? e.message : 'Failed to update user'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function updateStatus(id: string, status: string) {
    loading.value = true
    error.value = null
    try {
      const res = await api.patch(`/users/${id}/status`, { status })
      const user = res.data.data as User
      const idx = users.value.findIndex(u => u.id === id)
      if (idx !== -1) users.value[idx] = user
      return user
    } catch (e: unknown) {
      error.value = e instanceof ApiError ? e.message : 'Failed to update user status'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function deleteUser(id: string) {
    loading.value = true
    error.value = null
    try {
      await api.delete(`/users/${id}`)
      users.value = users.value.filter(u => u.id !== id)
      if (currentUser.value?.id === id) currentUser.value = null
    } catch (e: unknown) {
      error.value = e instanceof ApiError ? e.message : 'Failed to delete user'
      throw e
    } finally {
      loading.value = false
    }
  }

  const isLoading = computed(() => loading.value)
  const userList = computed(() => users.value)

  return {
    users,
    currentUser,
    loading,
    error,
    meta,
    isLoading,
    userList,
    fetchUsers,
    fetchUser,
    createUser,
    updateUser,
    updateStatus,
    deleteUser,
  }
})
