<script setup lang="ts">
import { onMounted, ref, computed, watch } from 'vue'
import { useAuditLogStore } from '@/stores/auditLogStore'
import { useToast } from '@/composables/useToast'
import {
  ShieldAlert,
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Activity,
  Key,
  Calendar,
  X,
} from 'lucide-vue-next'
import {
  Button,
  Badge,
  Input,
  StatCard,
  EmptyState,
  Skeleton,
  DatePicker,
  SelectField,
} from '@/components/ui'

const toast = useToast()
const store = useAuditLogStore()

const search = ref('')
const selectedCategory = ref('ALL')
const selectedDatePreset = ref('all')
const customDateFrom = ref('')
const customDateTo = ref('')
const currentPage = ref(1)
const perPage = ref(25)

const categoryOptions = [
  { label: 'All Categories', value: 'ALL' },
  { label: 'Security & Auth', value: 'SECURITY' },
  { label: 'Inventory & Stock', value: 'INVENTORY' },
  { label: 'Orders & Sales', value: 'ORDERS' },
  { label: 'Staff & Roles', value: 'STAFF' },
  { label: 'Payroll & Shifts', value: 'PAYROLL' },
  { label: 'Billing & Invoices', value: 'BILLING' },
]

const datePresetOptions = [
  { label: 'All Time', value: 'all' },
  { label: 'Today', value: 'today' },
  { label: 'Last 7 Days', value: '7d' },
  { label: 'Last 30 Days', value: '30d' },
  { label: 'Custom Range…', value: 'custom' },
]

function computeDateBounds(preset: string): { from?: string; to?: string } {
  const today = new Date()
  const toStr = today.toISOString().slice(0, 10)
  if (preset === 'today') return { from: toStr, to: toStr }
  if (preset === '7d') {
    const d = new Date(today)
    d.setDate(d.getDate() - 6)
    return { from: d.toISOString().slice(0, 10), to: toStr }
  }
  if (preset === '30d') {
    const d = new Date(today)
    d.setDate(d.getDate() - 29)
    return { from: d.toISOString().slice(0, 10), to: toStr }
  }
  if (preset === 'custom') {
    return {
      from: customDateFrom.value || undefined,
      to: customDateTo.value || undefined,
    }
  }
  return {}
}

const hasActiveFilters = computed(() => {
  return (
    !!search.value.trim() ||
    selectedCategory.value !== 'ALL' ||
    selectedDatePreset.value !== 'all' ||
    !!customDateFrom.value ||
    !!customDateTo.value
  )
})

const logs = computed(() => store.logs)

const totalEvents = computed(() => store.meta?.total ?? logs.value.length)
const todayDateStr = new Date().toISOString().slice(0, 10)
const todayEvents = computed(() => logs.value.filter(l => (l.created_at || '').startsWith(todayDateStr)).length)
const authEvents = computed(() => logs.value.filter(l => (l.action || '').toLowerCase().includes('auth') || (l.action || '').toLowerCase().includes('login')).length)

async function loadLogs() {
  try {
    const bounds = computeDateBounds(selectedDatePreset.value)
    await store.fetchLogs({
      page: currentPage.value,
      per_page: perPage.value,
      category: selectedCategory.value !== 'ALL' ? selectedCategory.value : undefined,
      date_from: bounds.from,
      date_to: bounds.to,
      search: search.value.trim() || undefined,
    })
  } catch (err) {
    const e = err as { message?: string }
    toast.error(e.message || 'Failed to load audit logs')
  }
}

let searchTimer: ReturnType<typeof setTimeout> | null = null
function onSearchInput() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    currentPage.value = 1
    loadLogs()
  }, 350)
}

watch(selectedCategory, () => {
  currentPage.value = 1
  loadLogs()
})

watch(selectedDatePreset, (newPreset) => {
  currentPage.value = 1
  if (newPreset !== 'custom') {
    loadLogs()
  }
})

function onCategoryChange(val?: string | number) {
  if (val !== undefined && val !== null) {
    selectedCategory.value = String(val)
  }
  currentPage.value = 1
  loadLogs()
}

function onDatePresetChange(val?: string | number) {
  if (val !== undefined && val !== null) {
    selectedDatePreset.value = String(val)
  }
  currentPage.value = 1
  if (selectedDatePreset.value !== 'custom') {
    loadLogs()
  }
}

function onCustomDateChange() {
  if (customDateFrom.value && customDateTo.value) {
    currentPage.value = 1
    loadLogs()
  }
}

function resetFilters() {
  search.value = ''
  selectedCategory.value = 'ALL'
  selectedDatePreset.value = 'all'
  customDateFrom.value = ''
  customDateTo.value = ''
  currentPage.value = 1
  loadLogs()
}

function nextPage() {
  if (store.meta && currentPage.value < store.meta.last_page) {
    currentPage.value += 1
    loadLogs()
  }
}
function prevPage() {
  if (currentPage.value > 1) {
    currentPage.value -= 1
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
      <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <!-- Search Input with instant/debounced search -->
        <div class="flex-1 max-w-md">
          <Input
            v-model="search"
            type="text"
            placeholder="Search description, target, operator…"
            class="bg-surface text-xs sm:text-sm h-9"
            @input="onSearchInput"
            @keyup.enter="loadLogs"
          >
            <template #prefix>
              <Search :size="15" class="text-muted-foreground" />
            </template>
          </Input>
        </div>

        <!-- Structured Category & Date Preset Selectors -->
        <div class="flex items-center gap-2.5 flex-wrap">
          <SelectField
            id="audit-category-select"
            v-model="selectedCategory"
            :options="categoryOptions"
            placeholder="All Categories"
            class="h-9 w-44 sm:w-48 bg-surface text-xs"
            @change="onCategoryChange"
          />

          <SelectField
            id="audit-date-preset-select"
            v-model="selectedDatePreset"
            :options="datePresetOptions"
            placeholder="All Time"
            class="h-9 w-36 sm:w-40 bg-surface text-xs"
            @change="onDatePresetChange"
          />

          <Button
            v-if="hasActiveFilters"
            variant="ghost"
            size="sm"
            class="h-9 px-2.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
            @click="resetFilters"
          >
            <X :size="13" class="mr-1" />
            <span>Reset</span>
          </Button>
        </div>
      </div>

      <!-- Collapsible Custom Date Range Row (only shown when 'Custom Range…' is selected) -->
      <div v-if="selectedDatePreset === 'custom'" class="flex items-center gap-3 pt-2.5 border-t border-border/50 flex-wrap text-xs">
        <div class="flex items-center gap-1.5 text-muted-foreground">
          <Calendar :size="14" />
          <span>Custom Date Range:</span>
        </div>
        <div class="flex items-center gap-2">
          <DatePicker v-model="customDateFrom" placeholder="From date" class="h-8.5 w-36 bg-surface text-xs" @change="onCustomDateChange" />
          <span class="text-muted-foreground text-xs">to</span>
          <DatePicker v-model="customDateTo" placeholder="To date" class="h-8.5 w-36 bg-surface text-xs" @change="onCustomDateChange" />
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
          Page {{ currentPage }} of {{ store.meta.last_page }} ({{ store.meta.total }} total)
        </span>
        <div class="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            class="h-8 px-2.5 text-xs gap-1"
            :disabled="currentPage === 1"
            @click="prevPage"
          >
            <ChevronLeft :size="14" />
            <span>Previous</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            class="h-8 px-2.5 text-xs gap-1"
            :disabled="!store.meta || currentPage >= store.meta.last_page"
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
