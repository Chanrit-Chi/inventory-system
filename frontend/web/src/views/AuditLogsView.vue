<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useAuditLogStore } from '@/stores/auditLogStore'
import { useToast } from '@/composables/useToast'
import {
  ShieldAlert,
  Search,
  RefreshCw,
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
  EmptyState,
  Skeleton,
  DatePicker,
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

function getTargetObject(log: any): string {
  if (log.target && log.target.trim()) return log.target
  if (log.subject_type) {
    return `${log.subject_type} ${log.subject_id ? '#' + String(log.subject_id).slice(0, 8) : ''}`
  }
  if (log.source_type) {
    return `${log.source_type} ${log.source_id ? '#' + String(log.source_id).slice(0, 8) : ''}`
  }
  return '—'
}

function getIpAddress(log: any): string {
  if (log.ip && String(log.ip).trim()) return String(log.ip)
  if (log.ip_address && String(log.ip_address).trim()) return String(log.ip_address)
  if (log.metadata?.ip) return String(log.metadata.ip)
  if (log.metadata?.ip_address) return String(log.metadata.ip_address)
  if (log.details && typeof log.details === 'string' && log.details.includes('IP: ')) {
    const parts = log.details.split('IP: ')
    if (parts[1]) return parts[1].split(' ')[0].trim()
  }
  return '—'
}

function getOperatorName(log: any): string {
  if (log.actor_name && String(log.actor_name).trim()) return String(log.actor_name)
  if (log.by && String(log.by).trim()) return String(log.by)
  if (log.user?.name && String(log.user.name).trim()) return String(log.user.name)
  if (log.user_name && String(log.user_name).trim()) return String(log.user_name)
  return 'System'
}

function getLogDescription(log: any): string {
  if (log.details && String(log.details).trim()) return String(log.details)
  if (log.description && String(log.description).trim()) return String(log.description)
  return log.action ? String(log.action).replace(/_/g, ' ') : 'System event logged'
}

function formatLogDate(dateStr?: string | null): string {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return String(dateStr)
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  } catch {
    return String(dateStr)
  }
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

      <Button variant="outline" size="sm" class="h-9 px-3 gap-1.5 text-xs border-border bg-card hover:bg-surface-subtle" :disabled="store.loading" @click="loadLogs">
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
            placeholder="Search description, target, actor…"
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
            placeholder="Filter action (e.g. login, create)…"
            class="bg-surface text-sm font-mono"
            @keyup.enter="loadLogs"
          />
        </div>

        <div class="flex items-center gap-2">
          <DatePicker v-model="filters.from" placeholder="From date" class="w-full bg-surface text-xs" />
          <span class="text-muted-foreground text-xs">to</span>
          <DatePicker v-model="filters.to" placeholder="To date" class="w-full bg-surface text-xs" />
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
        <table class="w-full text-xs text-left min-w-[960px]">
          <thead class="bg-surface-subtle text-muted-foreground text-xs font-bold border-b border-border">
            <tr>
              <th class="px-4 py-3 font-mono w-44 whitespace-nowrap">Timestamp</th>
              <th class="px-4 py-3 w-40 whitespace-nowrap">Operator</th>
              <th class="px-4 py-3 w-36 whitespace-nowrap">Action</th>
              <th class="px-4 py-3 min-w-[220px]">Description</th>
              <th class="px-4 py-3 min-w-[180px] font-mono">Target Object</th>
              <th class="px-4 py-3 font-mono text-right w-44 whitespace-nowrap">IP Address</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border/70">
            <tr v-for="log in logs" :key="log.id" class="hover:bg-surface-subtle/50 transition-colors">
              <!-- Timestamp -->
              <td class="px-4 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">
                {{ formatLogDate(log.occurred_at || log.created_at || log.time) }}
              </td>

              <!-- Operator / Actor -->
              <td class="px-4 py-3 text-xs font-semibold text-foreground whitespace-nowrap">
                <div class="flex items-center gap-1.5">
                  <div class="w-5.5 h-5.5 rounded-full bg-cta-muted border border-border-strong text-primary flex items-center justify-center font-bold text-3xs shrink-0">
                    {{ getOperatorName(log).charAt(0).toUpperCase() }}
                  </div>
                  <div class="min-w-0">
                    <span class="block truncate font-bold text-foreground">{{ getOperatorName(log) }}</span>
                    <span v-if="log.actor_role" class="block text-3xs text-muted-foreground font-mono uppercase">{{ log.actor_role }}</span>
                  </div>
                </div>
              </td>

              <!-- Action Badge -->
              <td class="px-4 py-3 whitespace-nowrap">
                <Badge :variant="actionBadge(log.action).variant" class="text-xs px-2.5 py-0.5 font-mono font-semibold">
                  {{ actionBadge(log.action).label }}
                </Badge>
              </td>

              <!-- Description -->
              <td class="px-4 py-3 text-xs text-foreground">
                {{ getLogDescription(log) }}
              </td>

              <!-- Target Object -->
              <td class="px-4 py-3 font-mono text-xs whitespace-nowrap">
                <span
                  v-if="getTargetObject(log) !== '—'"
                  class="px-2 py-0.5 rounded-md bg-surface-subtle border border-border text-foreground font-semibold"
                >
                  {{ getTargetObject(log) }}
                </span>
                <span v-else class="text-muted-foreground">—</span>
              </td>

              <!-- IP Address & Device -->
              <td class="px-4 py-3 font-mono text-xs text-right whitespace-nowrap">
                <div class="flex flex-col items-end">
                  <span
                    v-if="getIpAddress(log) !== '—'"
                    class="px-2 py-0.5 rounded-md bg-card border border-border text-foreground font-bold shadow-2xs"
                  >
                    {{ getIpAddress(log) }}
                  </span>
                  <span v-else class="text-muted-foreground">—</span>
                  <span v-if="log.device || (log.metadata as any)?.device" class="text-3xs text-muted-foreground truncate max-w-[140px] mt-0.5">
                    {{ log.device || (log.metadata as any)?.device }}
                  </span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
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
