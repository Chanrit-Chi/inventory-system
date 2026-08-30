import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api, { ApiError } from '@/api/axios'

export interface Permission {
  id: string
  name: string
  display_name: string
  description?: string
  group: string
}

export const usePermissionStore = defineStore('permission', () => {
  const permissions = ref<Permission[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

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

  async function createPermission(data: Partial<Permission>) {
    loading.value = true
    error.value = null
    try {
      const res = await api.post('/permissions', data)
      const permission = res.data.data as Permission
      permissions.value.push(permission)
      return permission
    } catch (e: unknown) {
      error.value = e instanceof ApiError ? e.message : 'Failed to create permission'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function updatePermission(id: string, data: Partial<Permission>) {
    loading.value = true
    error.value = null
    try {
      const res = await api.patch(`/permissions/${id}`, data)
      const permission = res.data.data as Permission
      const idx = permissions.value.findIndex(p => p.id === id)
      if (idx !== -1) permissions.value[idx] = permission
      return permission
    } catch (e: unknown) {
      error.value = e instanceof ApiError ? e.message : 'Failed to update permission'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function deletePermission(id: string) {
    loading.value = true
    error.value = null
    try {
      await api.delete(`/permissions/${id}`)
      permissions.value = permissions.value.filter(p => p.id !== id)
    } catch (e: unknown) {
      error.value = e instanceof ApiError ? e.message : 'Failed to delete permission'
      throw e
    } finally {
      loading.value = false
    }
  }

  const isLoading = computed(() => loading.value)
  const permissionList = computed(() => permissions.value)

  return {
    permissions,
    loading,
    error,
    isLoading,
    permissionList,
    fetchPermissions,
    createPermission,
    updatePermission,
    deletePermission,
  }
})