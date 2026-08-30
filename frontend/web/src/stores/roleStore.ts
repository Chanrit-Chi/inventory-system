import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api, { ApiError } from '@/api/axios'

export interface Role {
  id: string
  name: string
  display_name: string
  description?: string
  permissions: string[]
  user_count: number
  created_at: string
  updated_at: string
}

export interface Permission {
  id: string
  name: string
  display_name: string
  description?: string
  group: string
}

export const useRoleStore = defineStore('role', () => {
  const roles = ref<Role[]>([])
  const permissions = ref<Permission[]>([])
  const currentRole = ref<Role | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchRoles() {
    loading.value = true
    error.value = null
    try {
      const res = await api.get('/roles')
      roles.value = res.data.data || []
    } catch (e: unknown) {
      error.value = e instanceof ApiError ? e.message : 'Failed to fetch roles'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function fetchRole(id: string) {
    loading.value = true
    error.value = null
    try {
      const res = await api.get(`/roles/${id}`)
      currentRole.value = res.data.data
      return res.data.data
    } catch (e: unknown) {
      error.value = e instanceof ApiError ? e.message : 'Failed to fetch role'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function fetchPermissions() {
    loading.value = true
    error.value = null
    try {
      const res = await api.get('/permissions')
      permissions.value = res.data.data || []
    } catch (e: unknown) {
      error.value = e instanceof ApiError ? e.message : 'Failed to fetch permissions'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function updateRolePermissions(id: string, permissions: string[]) {
    loading.value = true
    error.value = null
    try {
      const res = await api.put(`/roles/${id}/permissions`, { permissions })
      const role = res.data.data as Role
      const idx = roles.value.findIndex(r => r.id === id)
      if (idx !== -1) roles.value[idx] = role
      if (currentRole.value?.id === id) currentRole.value = role
      return role
    } catch (e: unknown) {
      error.value = e instanceof ApiError ? e.message : 'Failed to update role permissions'
      throw e
    } finally {
      loading.value = false
    }
  }

  const isLoading = computed(() => loading.value)
  const roleList = computed(() => roles.value)

  return {
    roles,
    permissions,
    currentRole,
    loading,
    error,
    isLoading,
    roleList,
    fetchRoles,
    fetchRole,
    fetchPermissions,
    updateRolePermissions,
  }
})
