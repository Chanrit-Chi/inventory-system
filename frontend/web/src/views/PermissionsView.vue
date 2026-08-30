<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { usePermissionStore } from '@/stores/permissionStore'
import {
  Key,
  Search,
  RefreshCw,
  Shield,
  Layers,
  CheckCircle2,
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

const store = usePermissionStore()
const search = ref('')

const permissions = computed(() => store.permissions)

const filtered = computed(() => {
  const q = search.value.toLowerCase().trim()
  if (!q) return permissions.value
  return permissions.value.filter(
    p => p.name.toLowerCase().includes(q) || p.display_name.toLowerCase().includes(q) || (p.description && p.description.toLowerCase().includes(q))
  )
})

const grouped = computed(() => {
  const map: Record<string, typeof permissions.value> = {}
  for (const p of filtered.value) {
    if (!map[p.group]) map[p.group] = []
    map[p.group].push(p)
  }
  return map
})

const totalKeys = computed(() => permissions.value.length)
const totalDomains = computed(() => new Set(permissions.value.map(p => p.group)).size)
const matchingKeys = computed(() => filtered.value.length)

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
            {{ totalKeys }} Keys
          </Badge>
        </div>
        <p class="text-xs text-muted-foreground mt-0.5">
          Master registry of granular system capability permissions grouped by functional domain.
        </p>
      </div>

      <Button variant="outline" size="sm" class="h-9 px-3 gap-1.5 text-xs" :disabled="store.loading" @click="store.fetchPermissions">
        <RefreshCw :size="14" :class="{ 'animate-spin': store.loading }" />
        <span>Refresh</span>
      </Button>
    </div>

    <!-- Stat Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <StatCard
        label="Total Registry Keys"
        :value="totalKeys"
        sub="System capability endpoints"
        :icon="Key"
        icon-variant="primary"
      />
      <StatCard
        label="Functional Domains"
        :value="totalDomains"
        sub="Categorized permission modules"
        :icon="Layers"
        icon-variant="purple"
      />
      <StatCard
        label="Active Filter Matches"
        :value="matchingKeys"
        sub="Showing in view"
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
          placeholder="Search permissions by name, code, or description…"
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
            <Shield :size="15" class="text-primary" />
            <span>{{ group }} Domain</span>
          </h2>
          <Badge variant="neutral" class="font-mono text-xs">{{ perms.length }} permissions</Badge>
        </div>

        <div class="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow class="bg-muted/30">
                <TableHead>Permission Name</TableHead>
                <TableHead class="font-mono">System Key</TableHead>
                <TableHead>Scope & Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="p in perms" :key="p.id" class="hover:bg-surface-subtle/60 transition-colors">
                <TableCell class="font-semibold text-foreground text-xs">
                  {{ p.display_name }}
                </TableCell>
                <TableCell class="font-mono text-xs text-primary font-semibold">
                  {{ p.name }}
                </TableCell>
                <TableCell class="text-xs text-muted-foreground">
                  {{ p.description || '—' }}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  </div>
</template>
