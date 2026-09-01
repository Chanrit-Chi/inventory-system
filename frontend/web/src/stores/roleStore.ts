import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api, { ApiError } from '@/api/axios'
import type { Permission } from './permissionStore'

export interface Role {
  id: string
  name: string
  slug: string
  display_name?: string
  description?: string
  permissions: string[]
  user_count?: number
  users_count?: number
  created_at?: string
  updated_at?: string
}

export const useRoleStore = defineStore('role', () => {
  const roles = ref<Role[]>([])
  const permissions = ref<Permission[]>([])
  const currentRole = ref<Role | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  function normalizeRole(r: any): Role {
    const rawPerms = r.permissions || []
    const permsList = Array.isArray(rawPerms)
      ? rawPerms.map((p: any) => (typeof p === 'string' ? p : p.slug || p.name))
      : []

    return {
      id: r.id,
      name: r.name || r.slug,
      slug: r.slug || r.name,
      display_name: r.display_name || r.name,
      description: r.description,
      permissions: permsList,
      user_count: typeof r.user_count === 'number' ? r.user_count : (r.users_count ?? 0),
      users_count: typeof r.users_count === 'number' ? r.users_count : (r.user_count ?? 0),
      created_at: r.created_at,
      updated_at: r.updated_at,
    }
  }

  async function fetchRoles() {
    loading.value = true
    error.value = null
    try {
      const res = await api.get('/roles')
      const raw = res.data?.data || res.data || []
      roles.value = (Array.isArray(raw) ? raw : []).map(normalizeRole)
      return roles.value
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
      const raw = res.data?.data || res.data
      const normalized = normalizeRole(raw)
      currentRole.value = normalized
      return normalized
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

  async function updateRolePermissions(id: string, perms: string[]) {
    loading.value = true
    error.value = null
    try {
      const res = await api.put(`/roles/${id}/permissions`, { permissions: perms })
      const raw = res.data?.data || res.data
      const updated = normalizeRole(raw)
      const idx = roles.value.findIndex(r => r.id === id || r.slug === id)
      if (idx !== -1) roles.value[idx] = updated
      if (currentRole.value?.id === id || currentRole.value?.slug === id) currentRole.value = updated
      return updated
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

