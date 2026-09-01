<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { usePermissionStore } from '@/stores/permissionStore'
import { PERMISSION_MODULES } from '@/composables/usePermissions'
import {
  Key,
  Search,
  RefreshCw,
  Shield,
  Layers,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-vue-next'
import {
  Button,
  Badge,
  Input,
  StatCard,
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  EmptyState,
  Skeleton,
} from '@/components/ui'

const router = useRouter()
const store = usePermissionStore()
const search = ref('')

const permissions = computed(() => store.permissions)

const filtered = computed(() => {
  const q = search.value.toLowerCase().trim()
  if (!q) return permissions.value
  return permissions.value.filter(
    p =>
      p.name?.toLowerCase().includes(q) ||
      p.slug?.toLowerCase().includes(q) ||
      p.module?.toLowerCase().includes(q) ||
      (p.description && p.description.toLowerCase().includes(q))
  )
})

const grouped = computed(() => {
  const map: Record<string, typeof permissions.value> = {}
  for (const p of filtered.value) {
    const mod = p.module || p.group || 'system'
    if (!map[mod]) map[mod] = []
    map[mod].push(p)
  }
  return map
})

const totalKeys = computed(() => permissions.value.length)
const totalDomains = computed(() => new Set(permissions.value.map(p => p.module || p.group || 'system')).size)
const matchingKeys = computed(() => filtered.value.length)

function getModuleTitle(moduleId: string): string {
  return PERMISSION_MODULES[moduleId]?.name || `${moduleId.charAt(0).toUpperCase() + moduleId.slice(1)} Domain`
}

function getModuleColor(moduleId: string): string {
  return PERMISSION_MODULES[moduleId]?.color || '#924C00'
}

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

onMounted(() => {
  store.fetchPermissions().catch(() => {})
})
</script>

<template>
  <div class="flex flex-col gap-6 max-w-5xl mx-auto w-full">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-3">
          <h1 class="text-2xl sm:text-3xl font-display font-bold text-foreground tracking-tight">System Permissions</h1>
          <Badge variant="info" class="font-mono text-xs px-2.5 py-0.5">
            {{ totalKeys }} Capabilities
          </Badge>
        </div>
        <p class="text-xs text-muted-foreground mt-0.5">
          Master catalog of granular system capability grants and security keys across all platform modules.
        </p>
      </div>

      <div class="flex items-center gap-2 flex-wrap">
        <Button variant="outline" size="sm" class="h-9 px-3 gap-1.5 text-xs" :disabled="store.loading" @click="store.fetchPermissions">
          <RefreshCw :size="14" :class="{ 'animate-spin': store.loading }" />
          <span>Refresh</span>
        </Button>
        <Button
          variant="primary"
          size="sm"
          class="h-9 px-3.5 gap-1.5 text-xs font-bold"
          @click="router.push('/roles')"
        >
          <ShieldCheck :size="15" />
          <span>Role Permissions Matrix</span>
        </Button>
      </div>
    </div>

    <!-- Stat Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <StatCard
        label="Total Security Keys"
        :value="totalKeys"
        sub="Granular system capabilities"
        :icon="Key"
        icon-variant="primary"
      />
      <StatCard
        label="Functional Modules"
        :value="totalDomains"
        sub="Categorized domain groups"
        :icon="Layers"
        icon-variant="purple"
      />
      <StatCard
        label="Active Filter Matches"
        :value="matchingKeys"
        sub="Showing in active view"
        :icon="CheckCircle2"
        icon-variant="success"
      />
    </div>

    <!-- Search Toolbar -->
    <div class="rounded-xl border border-border bg-card p-3.5 shadow-xs">
      <div class="max-w-md">
        <Input
          v-model="search"
          type="text"
          placeholder="Search permissions by capability name, slug (e.g. products:read), or module…"
          class="bg-surface font-mono"
        >
          <template #prefix>
            <Search :size="16" />
          </template>
        </Input>
      </div>
    </div>

    <!-- Grouped Permission Tables -->
    <div v-if="store.loading" class="p-8 space-y-4">
      <Skeleton v-for="i in 3" :key="i" class="h-24 w-full" />
    </div>

    <EmptyState
      v-else-if="!filtered.length"
      :icon="Key"
      title="No permissions matched"
      :description="`No permissions found matching '${search}'.`"
    />

    <div v-else class="space-y-6">
      <div
        v-for="(perms, group) in grouped"
        :key="group"
        class="rounded-xl border border-border bg-card shadow-xs overflow-hidden"
      >
        <div class="p-3.5 border-b border-border bg-surface-subtle/50 flex items-center justify-between">
          <h2 class="font-display font-bold text-sm text-foreground uppercase tracking-wider flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-full" :style="{ backgroundColor: getModuleColor(String(group)) }" />
            <span>{{ getModuleTitle(String(group)) }}</span>
          </h2>
          <Badge variant="neutral" class="font-mono text-xs">{{ perms.length }} permissions</Badge>
        </div>

        <div class="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow class="bg-muted/30">
                <TableHead class="w-1/3">Capability Name</TableHead>
                <TableHead class="w-1/4 font-mono">System Key (Slug)</TableHead>
                <TableHead>Scope & Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="p in perms" :key="p.id" class="hover:bg-surface-subtle/60 transition-colors">
                <TableCell class="font-semibold text-foreground text-xs">
                  <div class="flex items-center gap-2">
                    <Shield :size="13" class="text-primary/70 shrink-0" />
                    <span>{{ formatPermissionTitle(p) }}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <span class="px-2 py-0.5 rounded-md bg-cta-muted border border-border-strong text-primary font-mono text-xs font-semibold">
                    {{ p.slug }}
                  </span>
                </TableCell>
                <TableCell class="text-xs text-muted-foreground">
                  {{ formatPermissionDesc(p) }}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  </div>
</template>

