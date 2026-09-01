import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api, { ApiError } from '@/api/axios'

export interface Permission {
  id: string
  name: string
  slug: string
  module: string
  description?: string
  display_name?: string
  group?: string
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
      const raw = res.data?.data || res.data || []
      permissions.value = (Array.isArray(raw) ? raw : []).map((p: any) => ({
        id: p.id,
        name: p.name || p.display_name || p.slug,
        slug: p.slug || p.name,
        module: p.module || p.group || 'system',
        description: p.description,
        display_name: p.display_name || p.name,
        group: p.group || p.module || 'system',
      }))
      return permissions.value
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
      const raw = res.data?.data || res.data
      const permission: Permission = {
        id: raw.id,
        name: raw.name || raw.display_name || raw.slug,
        slug: raw.slug || raw.name,
        module: raw.module || raw.group || 'system',
        description: raw.description,
        display_name: raw.display_name || raw.name,
        group: raw.group || raw.module || 'system',
      }
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
      const raw = res.data?.data || res.data
      const permission: Permission = {
        id: raw.id,
        name: raw.name || raw.display_name || raw.slug,
        slug: raw.slug || raw.name,
        module: raw.module || raw.group || 'system',
        description: raw.description,
        display_name: raw.display_name || raw.name,
        group: raw.group || raw.module || 'system',
      }
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

  const permissionsByModule = computed(() => {
    const map: Record<string, Permission[]> = {}
    for (const p of permissions.value) {
      const mod = p.module || 'system'
      if (!map[mod]) map[mod] = []
      map[mod].push(p)
    }
    return map
  })

  return {
    permissions,
    loading,
    error,
    isLoading,
    permissionList,
    permissionsByModule,
    fetchPermissions,
    createPermission,
    updatePermission,
    deletePermission,
  }
})