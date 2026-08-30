<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useRoleStore, type Role } from '@/stores/roleStore'
import { useToast } from '@/composables/useToast'
import {
  Shield,
  ShieldCheck,
  RefreshCw,
  Key,
  Users,
  Lock,
} from 'lucide-vue-next'
import {
  Button,
  Badge,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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

const toast = useToast()
const store = useRoleStore()

const showPermModal = ref(false)
const editing = ref<Role | null>(null)
const selectedPerms = ref<Set<string>>(new Set())

const roles = computed(() => store.roles)
const permissions = computed(() => store.permissions)

const totalRoles = computed(() => roles.value.length)
const totalPermsCount = computed(() => permissions.value.length)
const totalUsersAssigned = computed(() => roles.value.reduce((acc, r) => acc + (r.user_count || 0), 0))

async function load() {
  try {
    await Promise.all([store.fetchRoles(), store.fetchPermissions()])
  } catch (err) {
    const e = err as { message?: string }
    toast.error(e.message || 'Failed to load roles')
  }
}

async function openPermEditor(role: Role) {
  try {
    const fresh = await store.fetchRole(role.id)
    editing.value = fresh as Role
    selectedPerms.value = new Set((fresh as Role).permissions)
    showPermModal.value = true
  } catch (err) {
    const e = err as { message?: string }
    toast.error(e.message || 'Failed to load role')
  }
}

function togglePerm(name: string) {
  if (selectedPerms.value.has(name)) {
    selectedPerms.value.delete(name)
  } else {
    selectedPerms.value.add(name)
  }
}

async function savePerms() {
  if (!editing.value) return
  try {
    await store.updateRolePermissions(editing.value.id, Array.from(selectedPerms.value))
    toast.success('Permissions updated')
    showPermModal.value = false
    await load()
  } catch (err) {
    const e = err as { message?: string }
    toast.error(e.message || 'Failed to update permissions')
  }
}

const grouped = computed(() => {
  const map: Record<string, typeof permissions.value> = {}
  for (const p of permissions.value) {
    if (!map[p.group]) map[p.group] = []
    map[p.group].push(p)
  }
  return map
})

onMounted(load)
</script>

<template>
  <div class="flex flex-col gap-6 max-w-5xl mx-auto w-full">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-3">
          <h1 class="text-2xl sm:text-3xl font-display font-bold text-foreground tracking-tight">Roles & Permissions</h1>
          <Badge variant="info" class="font-mono text-xs px-2.5 py-0.5">
            {{ totalRoles }} Roles
          </Badge>
        </div>
        <p class="text-xs text-muted-foreground mt-0.5">
          Role-based access control (RBAC) definitions and granular operational permission assignments.
        </p>
      </div>

      <Button variant="outline" size="sm" class="h-9 px-3 gap-1.5 text-xs" :disabled="store.loading" @click="load">
        <RefreshCw :size="14" :class="{ 'animate-spin': store.loading }" />
        <span>Refresh</span>
      </Button>
    </div>

    <!-- Stat Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <StatCard
        label="Defined Roles"
        :value="totalRoles"
        sub="RBAC security levels"
        :icon="Shield"
        icon-variant="primary"
      />
      <StatCard
        label="Granular Permissions"
        :value="totalPermsCount"
        sub="Feature & action capabilities"
        :icon="Lock"
        icon-variant="purple"
      />
      <StatCard
        label="Assigned Users"
        :value="totalUsersAssigned"
        sub="Staff accounts with roles"
        :icon="Users"
        icon-variant="success"
      />
    </div>

    <!-- Roles Table Container -->
    <div class="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
      <div v-if="store.loading" class="p-6 space-y-3">
        <Skeleton v-for="i in 3" :key="i" class="h-12 w-full" />
      </div>

      <EmptyState
        v-else-if="!roles.length"
        :icon="Shield"
        title="No roles configured"
        description="No system roles configured in the access control ledger."
      />

      <div v-else class="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow class="bg-muted/40">
              <TableHead>Role Display Name</TableHead>
              <TableHead class="font-mono text-center">Assigned Users</TableHead>
              <TableHead>Granted Permissions</TableHead>
              <TableHead class="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="r in roles" :key="r.id" class="hover:bg-surface-subtle/80 transition-colors">
              <TableCell>
                <div class="font-semibold text-foreground flex items-center gap-2">
                  <ShieldCheck :size="15" class="text-primary" />
                  <span>{{ r.display_name }}</span>
                </div>
                <span class="font-mono text-[10px] text-muted-foreground">{{ r.name }}</span>
              </TableCell>
              <TableCell class="font-mono text-xs text-center font-semibold text-foreground tabular-nums">
                <Badge variant="neutral" class="text-[10px] px-2 py-0.5 font-mono">
                  {{ r.user_count }} users
                </Badge>
              </TableCell>
              <TableCell class="text-xs text-muted-foreground">
                <Badge variant="info" class="text-[10px] px-2 py-0.5 font-mono">
                  {{ (r.permissions || []).length }} permissions
                </Badge>
              </TableCell>
              <TableCell class="text-right">
                <Button variant="primary" size="sm" class="h-8 px-3 text-xs gap-1.5" @click="openPermEditor(r)">
                  <Key :size="13" />
                  <span>Edit Permissions</span>
                </Button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>

    <!-- Edit Permissions Modal Dialog -->
    <Dialog :open="showPermModal" @update:open="(val) => showPermModal = val">
      <DialogContent class="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle class="font-display flex items-center gap-2">
            <ShieldCheck :size="18" class="text-primary" />
            <span>Edit Permissions — {{ editing?.display_name }}</span>
          </DialogTitle>
          <DialogDescription>
            Select granular action permissions granted to users with the <strong>{{ editing?.display_name }}</strong> role.
          </DialogDescription>
        </DialogHeader>

        <div class="py-2 space-y-4">
          <div v-for="(perms, group) in grouped" :key="group" class="rounded-lg border border-border p-3.5 bg-surface-subtle/40">
            <h3 class="text-xs font-bold text-foreground uppercase tracking-wider mb-2.5 capitalize flex items-center gap-1.5">
              <span class="w-1.5 h-1.5 rounded-full bg-primary" />
              <span>{{ group }} Permissions</span>
            </h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <label
                v-for="p in perms"
                :key="p.id"
                class="flex items-center gap-2.5 p-2 rounded bg-card border border-border/70 text-xs hover:bg-surface-subtle cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  :checked="selectedPerms.has(p.name)"
                  class="rounded border-input text-primary focus:ring-primary h-4 w-4"
                  @change="togglePerm(p.name)"
                />
                <span class="font-medium text-foreground">{{ p.display_name }}</span>
              </label>
            </div>
          </div>
        </div>

        <DialogFooter class="gap-2 sm:gap-0 mt-4">
          <Button variant="outline" @click="showPermModal = false">Cancel</Button>
          <Button variant="primary" @click="savePerms">Save Permissions</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
