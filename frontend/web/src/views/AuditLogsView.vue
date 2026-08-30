<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useAuditLogStore } from '@/stores/auditLogStore'
import { useToast } from '@/composables/useToast'
import {
  ShieldAlert,
  Search,
  RefreshCw,
  User,
  ChevronLeft,
  ChevronRight,
  Filter,
  Activity,
  Key,
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

const toast = useToast()
const store = useAuditLogStore()

const filters = ref({
  page: 1,
  per_page: 30,
  user_id: '' as string,
  action: '' as string,
  from: '' as string,
  to: '' as string,
  search: '' as string,
})

const logs = computed(() => store.logs)

const totalEvents = computed(() => store.meta?.total ?? logs.value.length)
const todayDateStr = new Date().toISOString().slice(0, 10)
const todayEvents = computed(() => logs.value.filter(l => (l.created_at || '').startsWith(todayDateStr)).length)
const authEvents = computed(() => logs.value.filter(l => (l.action || '').toLowerCase().includes('auth') || (l.action || '').toLowerCase().includes('login')).length)

async function loadLogs() {
  try {
    await store.fetchLogs({
      page: filters.value.page,
      per_page: filters.value.per_page,
      user_id: filters.value.user_id || undefined,
      action: filters.value.action || undefined,
      from: filters.value.from || undefined,
      to: filters.value.to || undefined,
      search: filters.value.search || undefined,
    })
  } catch (err) {
    const e = err as { message?: string }
    toast.error(e.message || 'Failed to load audit logs')
  }
}

function resetFilters() {
  filters.value = {
    page: 1,
    per_page: 30,
    user_id: '',
    action: '',
    from: '',
    to: '',
    search: '',
  }
  loadLogs()
}

function nextPage() {
  if (store.meta && filters.value.page < store.meta.last_page) {
    filters.value.page += 1
    loadLogs()
  }
}
function prevPage() {
  if (filters.value.page > 1) {
    filters.value.page -= 1
    loadLogs()
  }
}

function actionBadge(action: string): { variant: 'success' | 'info' | 'destructive' | 'purple' | 'neutral', label: string } {
  const a = (action || '').toLowerCase()
  if (a.includes('create') || a.includes('insert') || a.includes('add')) return { variant: 'success', label: action }
  if (a.includes('update') || a.includes('edit') || a.includes('patch')) return { variant: 'info', label: action }
  if (a.includes('delete') || a.includes('remove') || a.includes('destroy')) return { variant: 'destructive', label: action }
  if (a.includes('login') || a.includes('auth') || a.includes('logout')) return { variant: 'purple', label: action }
  return { variant: 'neutral', label: action }
}

onMounted(loadLogs)
</script>

<template>
  <div class="flex flex-col gap-6 max-w-7xl mx-auto w-full">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-3">
          <h1 class="text-2xl sm:text-3xl font-display font-bold text-foreground tracking-tight">Security Audit Logs</h1>
          <Badge variant="info" class="font-mono text-xs px-2.5 py-0.5">
            {{ totalEvents }} Events
          </Badge>
        </div>
        <p class="text-xs text-muted-foreground mt-0.5">
          Immutable event ledger tracking authentication, system mutations, checkout transactions, and administrative changes.
        </p>
      </div>

      <Button variant="outline" size="sm" class="h-9 px-3 gap-1.5 text-xs" :disabled="store.loading" @click="loadLogs">
        <RefreshCw :size="14" :class="{ 'animate-spin': store.loading }" />
        <span>Refresh</span>
      </Button>
    </div>

    <!-- Stat Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <StatCard
        label="Total Audit Events"
        :value="totalEvents"
        sub="Security & mutation records"
        :icon="ShieldAlert"
        icon-variant="primary"
      />
      <StatCard
        label="Today's Activity"
        :value="todayEvents"
        sub="Events recorded today"
        :icon="Activity"
        icon-variant="success"
      />
      <StatCard
        label="Auth & Login Traces"
        :value="authEvents"
        sub="Session authentication actions"
        :icon="Key"
        icon-variant="purple"
      />
    </div>

    <!-- Filter Toolbar -->
    <div class="rounded-xl border border-border bg-card p-3.5 shadow-xs flex flex-col gap-3">
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <Input
            v-model="filters.search"
            type="text"
            placeholder="Search description or details…"
            class="bg-surface text-sm"
            @keyup.enter="loadLogs"
          >
            <template #prefix>
              <Search :size="15" />
            </template>
          </Input>
        </div>

        <div>
          <Input
            v-model="filters.action"
            type="text"
            placeholder="Filter action (e.g. create, update)…"
            class="bg-surface text-sm font-mono"
            @keyup.enter="loadLogs"
          />
        </div>

        <div class="flex items-center gap-2">
          <Input v-model="filters.from" type="date" class="w-full bg-surface text-sm font-mono" />
          <span class="text-muted-foreground text-xs">to</span>
          <Input v-model="filters.to" type="date" class="w-full bg-surface text-sm font-mono" />
        </div>
      </div>

      <div class="flex items-center justify-between pt-2 border-t border-border/50 flex-wrap gap-2 text-xs">
        <span class="text-muted-foreground">Tip: Press enter in search inputs to quickly filter logs.</span>
        <div class="flex items-center gap-2">
          <Button variant="ghost" size="sm" class="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground" @click="resetFilters">
            Reset
          </Button>
          <Button variant="primary" size="sm" class="h-8 px-3 text-xs gap-1.5" @click="loadLogs">
            <Filter :size="13" />
            <span>Apply Filters</span>
          </Button>
        </div>
      </div>
    </div>

    <!-- Audit Logs Table Container -->
    <div class="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
      <div v-if="store.loading" class="p-6 space-y-3">
        <Skeleton v-for="i in 5" :key="i" class="h-10 w-full" />
      </div>

      <EmptyState
        v-else-if="!logs.length"
        :icon="ShieldAlert"
        title="No audit logs found"
        description="No security or event entries match the current filter query."
      />

      <div v-else class="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow class="bg-muted/40">
              <TableHead class="font-mono">Timestamp</TableHead>
              <TableHead>Operator</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Description</TableHead>
              <TableHead class="font-mono">Target Subject</TableHead>
              <TableHead class="font-mono text-right">IP Address</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="log in logs" :key="log.id" class="hover:bg-surface-subtle/80 transition-colors">
              <TableCell class="font-mono text-xs text-muted-foreground whitespace-nowrap">
                {{ new Date(log.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }) }}
              </TableCell>

              <TableCell class="text-xs font-semibold text-foreground whitespace-nowrap">
                <div class="flex items-center gap-1.5">
                  <User :size="13" class="text-muted-foreground flex-shrink-0" />
                  <span>{{ log.user_name || 'System' }}</span>
                </div>
              </TableCell>

              <TableCell>
                <Badge :variant="actionBadge(log.action).variant" class="text-[10px] px-2 py-0.5 font-mono">
                  {{ actionBadge(log.action).label }}
                </Badge>
              </TableCell>

              <TableCell class="text-xs text-foreground max-w-sm truncate">
                {{ log.description }}
              </TableCell>

              <TableCell class="font-mono text-xs text-muted-foreground whitespace-nowrap">
                <span v-if="log.subject_type">
                  {{ log.subject_type }} {{ log.subject_id ? `#${log.subject_id.slice(0, 8)}` : '' }}
                </span>
                <span v-else>—</span>
              </TableCell>

              <TableCell class="font-mono text-xs text-muted-foreground text-right">
                {{ log.ip_address || '—' }}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <!-- Pagination -->
      <div
        v-if="store.meta && store.meta.last_page > 1"
        class="flex items-center justify-between px-4 py-3 border-t border-border bg-surface-subtle/50 text-xs text-muted-foreground"
      >
        <span class="font-mono">
          Page {{ filters.page }} of {{ store.meta.last_page }} ({{ store.meta.total }} total)
        </span>
        <div class="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            class="h-8 px-2.5 text-xs gap-1"
            :disabled="filters.page === 1"
            @click="prevPage"
          >
            <ChevronLeft :size="14" />
            <span>Previous</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            class="h-8 px-2.5 text-xs gap-1"
            :disabled="!store.meta || filters.page >= store.meta.last_page"
            @click="nextPage"
          >
            <span>Next</span>
            <ChevronRight :size="14" />
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>
