<script setup lang="ts">
import { onMounted, ref, computed, watch } from 'vue'
import { useRoleStore, type Role } from '@/stores/roleStore'
import { useAuthStore } from '@/stores/authStore'
import { useToast } from '@/composables/useToast'
import {
  PERMISSION_MODULES,
  ROLE_DEFAULT_PERMISSIONS,
} from '@/composables/usePermissions'
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
  Search,
  Check,
  RotateCcw,
  Save,
  CheckSquare,
  Square,
  Lock,
  ChevronDown,
  ChevronUp,
  Sparkles,
  SlidersHorizontal,
  FolderTree,
  Boxes,
  Receipt,
  FileText,
  DollarSign,
  Users,
  Settings,
  ScrollText,
} from 'lucide-vue-next'
import {
  Button,
  Badge,
  Input,
  EmptyState,
  Skeleton,
} from '@/components/ui'

const toast = useToast()
const roleStore = useRoleStore()
const authStore = useAuthStore()

const selectedRoleSlug = ref<string>('ADMIN')
const activePermissions = ref<Set<string>>(new Set())
const originalPermissions = ref<Set<string>>(new Set())
const searchQuery = ref('')
const grantFilter = ref<'all' | 'granted' | 'ungranted'>('all')
const saving = ref(false)

// Accordion collapse state per module
const collapsedModules = ref<Record<string, boolean>>({})

const roles = computed(() => roleStore.roles)
const permissions = computed(() => roleStore.permissions)

const selectedRole = computed<Role | undefined>(() => {
  return roles.value.find(r => r.slug === selectedRoleSlug.value || r.name === selectedRoleSlug.value) || roles.value[0]
})

const isSuperAdminRole = computed(() => selectedRole.value?.slug === 'SUPER_ADMIN')

// Filtered permissions based on active search & grant filter
const filteredPermissions = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  return permissions.value.filter(p => {
    // Search query match
    if (q) {
      const matchName = p.name?.toLowerCase().includes(q)
      const matchSlug = p.slug?.toLowerCase().includes(q)
      const matchModule = p.module?.toLowerCase().includes(q)
      const matchDesc = p.description && p.description.toLowerCase().includes(q)
      if (!matchName && !matchSlug && !matchModule && !matchDesc) return false
    }

    // Grant filter
    if (grantFilter.value === 'granted') {
      return activePermissions.value.has(p.slug) || isSuperAdminRole.value
    }
    if (grantFilter.value === 'ungranted') {
      return !activePermissions.value.has(p.slug) && !isSuperAdminRole.value
    }

    return true
  })
})

// Group permissions by module domain
const groupedModules = computed(() => {
  const groups: Record<string, typeof permissions.value> = {}
  for (const p of filteredPermissions.value) {
    const mod = p.module || p.group || 'system'
    if (!groups[mod]) groups[mod] = []
    groups[mod].push(p)
  }
  return groups
})

// Unsaved changes / dirty state detection
const isDirty = computed(() => {
  if (isSuperAdminRole.value) return false
  if (activePermissions.value.size !== originalPermissions.value.size) return true
  for (const p of activePermissions.value) {
    if (!originalPermissions.value.has(p)) return true
  }
  return false
})

const totalSystemKeys = computed(() => permissions.value.length)
const totalRolesCount = computed(() => roles.value.length)
const totalAssignedUsers = computed(() =>
  roles.value.reduce((acc, r) => acc + (r.users_count ?? r.user_count ?? 0), 0)
)

const activeGrantedCount = computed(() => {
  if (isSuperAdminRole.value) return totalSystemKeys.value
  return activePermissions.value.size
})

const grantedPercentage = computed(() => {
  if (!totalSystemKeys.value) return 0
  return Math.round((activeGrantedCount.value / totalSystemKeys.value) * 100)
})

function formatPermissionTitle(p: { name?: string; slug: string; module?: string; display_name?: string }): string {
  if (p.name && p.name !== p.slug && !p.name.includes(':')) {
    return p.name
  }
  if (p.display_name && p.display_name !== p.slug && !p.display_name.includes(':')) {
    return p.display_name
  }
  const [mod, action] = p.slug.split(':')
  if (!action || action === '*') {
    const modTitle = PERMISSION_MODULES[mod]?.name || mod
    return `All ${modTitle} Capabilities`
  }
  const actionFormatted = action
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
  const modTitle = PERMISSION_MODULES[mod]?.name || mod
  return `${actionFormatted} (${modTitle})`
}

function formatPermissionDesc(p: { description?: string; slug: string; module?: string }): string {
  if (p.description) return p.description
  const [mod, action] = p.slug.split(':')
  const modTitle = PERMISSION_MODULES[mod]?.name || mod || 'system'
  if (!action || action === '*') {
    return `Unrestricted capability grant across all operations in ${modTitle}.`
  }
  return `Grants authorization to perform ${action} operations within ${modTitle}.`
}

function getModuleIcon(moduleId: string) {
  switch (moduleId) {
    case 'products':
    case 'catalog':
      return Sparkles
    case 'categories':
      return FolderTree
    case 'attributes':
      return SlidersHorizontal
    case 'inventory':
    case 'stock':
      return Boxes
    case 'sales':
    case 'pos':
    case 'orders':
      return Receipt
    case 'invoices':
    case 'quotations':
      return FileText
    case 'expenses':
    case 'payroll':
      return DollarSign
    case 'users':
    case 'customers':
      return Users
    case 'roles':
    case 'audit':
      return ScrollText
    case 'settings':
      return Settings
    default:
      return Lock
  }
}

function getModuleTitle(moduleId: string): string {
  return PERMISSION_MODULES[moduleId]?.name || `${moduleId.charAt(0).toUpperCase() + moduleId.slice(1)} Domain`
}

function getModuleColor(moduleId: string): string {
  return PERMISSION_MODULES[moduleId]?.color || '#FF8800'
}

function toggleModuleCollapse(moduleId: string) {
  collapsedModules.value[moduleId] = !collapsedModules.value[moduleId]
}

function expandAllModules() {
  collapsedModules.value = {}
}

function collapseAllModules() {
  const map: Record<string, boolean> = {}
  for (const group of Object.keys(groupedModules.value)) {
    map[group] = true
  }
  collapsedModules.value = map
}

function selectRole(role: Role) {
  selectedRoleSlug.value = role.slug || role.name
}

function syncActivePermissions() {
  if (!selectedRole.value) return

  const perms = selectedRole.value.permissions || []
  if (isSuperAdminRole.value) {
    activePermissions.value = new Set(['*'])
    originalPermissions.value = new Set(['*'])
  } else {
    activePermissions.value = new Set(perms)
    originalPermissions.value = new Set(perms)
  }
}

watch(selectedRole, () => {
  syncActivePermissions()
})

function togglePermission(slug: string) {
  if (isSuperAdminRole.value) return

  if (activePermissions.value.has(slug)) {
    activePermissions.value.delete(slug)
  } else {
    activePermissions.value.add(slug)
  }
  activePermissions.value = new Set(activePermissions.value)
}

function selectAllInModule(moduleId: string) {
  if (isSuperAdminRole.value) return
  const perms = permissions.value.filter(p => (p.module || p.group || 'system') === moduleId)
  for (const p of perms) {
    activePermissions.value.add(p.slug)
  }
  activePermissions.value = new Set(activePermissions.value)
}

function deselectAllInModule(moduleId: string) {
  if (isSuperAdminRole.value) return
  const perms = permissions.value.filter(p => (p.module || p.group || 'system') === moduleId)
  for (const p of perms) {
    activePermissions.value.delete(p.slug)
  }
  activePermissions.value = new Set(activePermissions.value)
}

function grantAll() {
  if (isSuperAdminRole.value) return
  activePermissions.value = new Set(permissions.value.map(p => p.slug))
}

function revokeAll() {
  if (isSuperAdminRole.value) return
  activePermissions.value = new Set()
}

function resetToRoleDefault() {
  if (!selectedRole.value || isSuperAdminRole.value) return
  const defaults = ROLE_DEFAULT_PERMISSIONS[selectedRole.value.slug] || []
  activePermissions.value = new Set(defaults)
}

function discardChanges() {
  activePermissions.value = new Set(originalPermissions.value)
}

async function saveRolePermissions() {
  if (!selectedRole.value || isSuperAdminRole.value) return

  saving.value = true
  try {
    const permsArray = Array.from(activePermissions.value)
    await roleStore.updateRolePermissions(selectedRole.value.id, permsArray)

    originalPermissions.value = new Set(permsArray)
    toast.success(`Successfully saved permissions for ${selectedRole.value.display_name || selectedRole.value.name}`)

    if (authStore.user && authStore.user.role === selectedRole.value.slug) {
      await authStore.fetchCurrentUser().catch(() => {})
    }
  } catch (err: any) {
    toast.error(err?.message || 'Failed to update role permissions')
  } finally {
    saving.value = false
  }
}

async function loadData() {
  try {
    await Promise.all([roleStore.fetchRoles(), roleStore.fetchPermissions()])
    syncActivePermissions()
  } catch (err: any) {
    toast.error(err?.message || 'Failed to load roles data')
  }
}

onMounted(loadData)
</script>

<template>
  <div class="flex flex-col gap-5 max-w-6xl mx-auto w-full pb-16">
    <!-- Top Header Bar -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
      <div>
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg bg-cta-muted border border-border-strong flex items-center justify-center text-primary">
            <Shield :size="18" />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h1 class="text-xl font-display font-bold text-foreground tracking-tight">Roles & Permissions</h1>
              <Badge variant="info" class="font-mono text-3xs">{{ totalRolesCount }} Roles</Badge>
              <Badge variant="neutral" class="font-mono text-3xs">{{ totalAssignedUsers }} Assigned Users</Badge>
            </div>
            <p class="text-xs text-muted-foreground mt-0.5">
              Role-based access control: configure granular permissions and capability grants per user role.
            </p>
          </div>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          class="h-8 px-3 gap-1.5 text-xs"
          :disabled="roleStore.loading || saving"
          @click="loadData"
        >
          <RefreshCw :size="13" :class="{ 'animate-spin': roleStore.loading }" />
          <span>Refresh</span>
        </Button>
        <Button
          v-if="isDirty"
          variant="primary"
          size="sm"
          class="h-8 px-4 gap-1.5 text-xs font-bold text-white shadow-sm animate-pulse"
          :disabled="saving"
          @click="saveRolePermissions"
        >
          <Save :size="13" />
          <span>{{ saving ? 'Saving…' : 'Save Changes' }}</span>
        </Button>
      </div>
    </div>

    <!-- Role Selector Tabs (Clean Horizontal Pill Tabs with subtle counts) -->
    <div class="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
      <button
        v-for="r in roles"
        :key="r.id"
        type="button"
        class="h-9 px-3.5 rounded-lg text-xs font-semibold flex items-center gap-2 shrink-0 transition-all border cursor-pointer select-none"
        :class="[
          selectedRole?.id === r.id
            ? 'bg-cta-muted border-cta text-primary shadow-xs font-bold ring-1 ring-cta/20'
            : 'bg-card border-border text-muted-foreground hover:bg-surface-subtle hover:text-foreground'
        ]"
        @click="selectRole(r)"
      >
        <ShieldCheck
          :size="14"
          :class="selectedRole?.id === r.id ? 'text-cta' : 'text-muted-foreground'"
        />
        <span>{{ r.display_name || r.name }}</span>
        <span
          class="px-1.5 py-0.2 rounded-full font-mono text-3xs"
          :class="[
            selectedRole?.id === r.id
              ? 'bg-cta text-cta-foreground'
              : 'bg-surface-subtle text-muted-foreground border border-border/70'
          ]"
        >
          {{ r.users_count ?? r.user_count ?? 0 }} users
        </span>
      </button>
    </div>

    <!-- Selected Role Summary Card (Clean, Non-intrusive) -->
    <div v-if="selectedRole" class="rounded-xl border border-border bg-card p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div class="flex items-start gap-3 min-w-0">
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <h2 class="text-sm font-display font-bold text-foreground">{{ selectedRole.display_name || selectedRole.name }}</h2>
            <Badge variant="neutral" class="font-mono text-3xs">{{ selectedRole.slug }}</Badge>
            <Badge v-if="isSuperAdminRole" variant="purple" class="font-mono text-3xs font-bold">
              ROOT (Permanent Wildcard *)
            </Badge>
          </div>
          <p class="text-xs text-muted-foreground mt-0.5 max-w-xl">
            {{ selectedRole.description || 'Configured operational role with granular permission assignments.' }}
          </p>
          <div class="flex items-center gap-3 mt-1.5 text-xs">
            <span class="font-bold text-primary font-mono">
              {{ isSuperAdminRole ? 'All Permissions Granted (*)' : `${activePermissions.size} permissions granted (${activeGrantedCount} of ${totalSystemKeys} capabilities · ${grantedPercentage}%)` }}
            </span>
            <span class="text-muted-foreground">·</span>
            <span class="text-muted-foreground">{{ selectedRole.users_count ?? selectedRole.user_count ?? 0 }} assigned users</span>
          </div>
        </div>
      </div>

      <!-- Quick Global Actions for Selected Role -->
      <div v-if="!isSuperAdminRole" class="flex flex-wrap items-center gap-1.5 shrink-0">
        <Button variant="outline" size="sm" class="h-7 px-2.5 text-xs gap-1" title="Grant all permissions" @click="grantAll">
          <CheckSquare :size="12" />
          <span>Grant All</span>
        </Button>
        <Button variant="outline" size="sm" class="h-7 px-2.5 text-xs gap-1" title="Revoke all permissions" @click="revokeAll">
          <Square :size="12" />
          <span>Revoke All</span>
        </Button>
        <Button variant="ghost" size="sm" class="h-7 px-2.5 text-xs gap-1 text-muted-foreground hover:text-foreground" title="Reset defaults" @click="resetToRoleDefault">
          <RotateCcw :size="12" />
          <span>Reset Defaults</span>
        </Button>
      </div>
    </div>

    <!-- Dirty State Alert Banner (Sticky/Prominent when modified) -->
    <div
      v-if="isDirty"
      class="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 flex flex-col sm:flex-row items-center justify-between gap-2.5 shadow-xs"
    >
      <div class="flex items-center gap-2 text-xs text-amber-900 dark:text-amber-200">
        <ShieldAlert :size="16" class="text-cta shrink-0" />
        <span>
          <strong>Unsaved Changes:</strong> Modified permissions for <strong>{{ selectedRole?.display_name || selectedRole?.name }}</strong>.
        </span>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <Button variant="outline" size="sm" class="h-7 px-3 text-xs" :disabled="saving" @click="discardChanges">
          Discard
        </Button>
        <Button
          variant="primary"
          size="sm"
          class="h-7 px-3.5 text-xs font-bold"
          :disabled="saving"
          @click="saveRolePermissions"
        >
          <Save :size="12" class="mr-1" />
          <span>{{ saving ? 'Saving…' : 'Save Changes' }}</span>
        </Button>
      </div>
    </div>

    <!-- Search & Filter Controls Toolbar -->
    <div class="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card border border-border rounded-xl p-2.5 shadow-xs">
      <div class="w-full sm:max-w-md">
        <Input
          v-model="searchQuery"
          type="text"
          placeholder="Filter capabilities by name, slug (e.g. pos:checkout), or domain…"
          class="h-8 bg-surface text-xs font-mono"
        >
          <template #prefix>
            <Search :size="14" class="text-muted-foreground" />
          </template>
        </Input>
      </div>

      <div class="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
        <!-- 3-Way Grant Filter -->
        <div class="inline-flex rounded-lg border border-border bg-surface p-0.5 text-xs font-semibold">
          <button
            type="button"
            class="px-2.5 py-1 rounded-md transition-all text-3xs cursor-pointer"
            :class="grantFilter === 'all' ? 'bg-card shadow-2xs text-primary font-bold' : 'text-muted-foreground hover:text-foreground'"
            @click="grantFilter = 'all'"
          >
            All ({{ permissions.length }})
          </button>
          <button
            type="button"
            class="px-2.5 py-1 rounded-md transition-all text-3xs cursor-pointer"
            :class="grantFilter === 'granted' ? 'bg-card shadow-2xs text-emerald-600 dark:text-emerald-400 font-bold' : 'text-muted-foreground hover:text-foreground'"
            @click="grantFilter = 'granted'"
          >
            Granted
          </button>
          <button
            type="button"
            class="px-2.5 py-1 rounded-md transition-all text-3xs cursor-pointer"
            :class="grantFilter === 'ungranted' ? 'bg-card shadow-2xs text-amber-600 dark:text-amber-400 font-bold' : 'text-muted-foreground hover:text-foreground'"
            @click="grantFilter = 'ungranted'"
          >
            Ungranted
          </button>
        </div>

        <!-- Expand / Collapse All -->
        <div class="flex items-center gap-1">
          <button
            type="button"
            class="p-1.5 rounded-lg border border-border bg-surface text-muted-foreground hover:text-foreground text-3xs font-semibold"
            title="Expand all modules"
            @click="expandAllModules"
          >
            <ChevronDown :size="14" />
          </button>
          <button
            type="button"
            class="p-1.5 rounded-lg border border-border bg-surface text-muted-foreground hover:text-foreground text-3xs font-semibold"
            title="Collapse all modules"
            @click="collapseAllModules"
          >
            <ChevronUp :size="14" />
          </button>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="roleStore.loading" class="space-y-4">
      <Skeleton v-for="i in 3" :key="i" class="h-32 w-full rounded-xl" />
    </div>

    <!-- Empty State -->
    <EmptyState
      v-else-if="!filteredPermissions.length"
      :icon="Lock"
      title="No capabilities matched"
      :description="`No permissions found matching '${searchQuery}'.`"
    />

    <!-- Module Sections (Full-Width Clean Table Rows) -->
    <div v-else class="space-y-3">
      <div
        v-for="(perms, group) in groupedModules"
        :key="group"
        class="rounded-xl border border-border bg-card shadow-xs overflow-hidden transition-all"
      >
        <!-- Module Header Bar -->
        <div
          class="p-3 bg-surface-subtle/60 border-b border-border flex items-center justify-between gap-3 cursor-pointer select-none"
          @click="toggleModuleCollapse(String(group))"
        >
          <div class="flex items-center gap-2.5 min-w-0">
            <div
              class="w-6 h-6 rounded-md flex items-center justify-center text-white shrink-0 shadow-2xs text-xs font-bold"
              :style="{ backgroundColor: getModuleColor(String(group)) }"
            >
              <component :is="getModuleIcon(String(group))" :size="13" />
            </div>
            <div class="min-w-0">
              <h3 class="font-display font-bold text-xs text-foreground flex items-center gap-1.5">
                <span>{{ getModuleTitle(String(group)) }}</span>
                <span class="text-3xs font-mono font-normal text-muted-foreground uppercase">({{ group }})</span>
              </h3>
            </div>
          </div>

          <div class="flex items-center gap-2 shrink-0" @click.stop>
            <Badge variant="neutral" class="font-mono text-3xs px-2 py-0.5">
              {{ perms.filter(p => activePermissions.has(p.slug) || isSuperAdminRole).length }}/{{ perms.length }} Active
            </Badge>

            <template v-if="!isSuperAdminRole">
              <div class="flex items-center gap-1 bg-surface border border-border rounded-md px-1 py-0.5">
                <button
                  type="button"
                  class="px-1.5 py-0.5 rounded text-3xs font-semibold text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                  title="Select all in this module"
                  @click="selectAllInModule(String(group))"
                >
                  Select All
                </button>
                <span class="text-border text-3xs">|</span>
                <button
                  type="button"
                  class="px-1.5 py-0.5 rounded text-3xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  title="Clear this module"
                  @click="deselectAllInModule(String(group))"
                >
                  Clear
                </button>
              </div>
            </template>

            <button
              type="button"
              class="p-1 rounded text-muted-foreground hover:text-foreground"
              @click="toggleModuleCollapse(String(group))"
            >
              <ChevronUp v-if="!collapsedModules[String(group)]" :size="15" />
              <ChevronDown v-else :size="15" />
            </button>
          </div>
        </div>

        <!-- Module Permission List (Full-Width Clean Table/Rows) -->
        <div v-show="!collapsedModules[String(group)]" class="divide-y divide-border/60 bg-card">
          <div
            v-for="p in perms"
            :key="p.id"
            class="px-4 py-3 flex items-center justify-between gap-4 transition-colors select-none"
            :class="[
              (activePermissions.has(p.slug) || isSuperAdminRole)
                ? 'bg-cta-muted/20 hover:bg-cta-muted/30'
                : 'hover:bg-surface-subtle/60 text-muted-foreground',
              isSuperAdminRole ? 'cursor-default' : 'cursor-pointer'
            ]"
            @click="togglePermission(p.slug)"
          >
            <!-- Left: Checkbox + Name + Description -->
            <div class="flex items-center gap-3.5 min-w-0 flex-1">
              <!-- Custom Checkbox (High Contrast) -->
              <div
                class="w-4.5 h-4.5 rounded border flex items-center justify-center transition-all shrink-0"
                :class="[
                  (activePermissions.has(p.slug) || isSuperAdminRole)
                    ? 'bg-cta border-cta text-cta-foreground shadow-2xs'
                    : 'bg-card border-border hover:border-cta'
                ]"
              >
                <Check
                  :size="12"
                  class="stroke-[3]"
                  :class="(activePermissions.has(p.slug) || isSuperAdminRole) ? 'opacity-100' : 'opacity-0'"
                />
              </div>

              <!-- Permission Info -->
              <div class="min-w-0 flex flex-col gap-0.5">
                <span
                  class="font-semibold text-xs text-foreground truncate leading-tight"
                  :class="{ 'font-bold text-primary': activePermissions.has(p.slug) }"
                >
                  {{ formatPermissionTitle(p) }}
                </span>
                <span class="text-[11px] text-muted-foreground truncate leading-tight">
                  {{ formatPermissionDesc(p) }}
                </span>
              </div>
            </div>

            <!-- Right: System Key Slug -->
            <div class="shrink-0 flex items-center gap-2">
              <span class="font-mono text-3xs px-2 py-0.5 rounded bg-surface border border-border/70 text-muted-foreground font-medium">
                {{ p.slug }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>





