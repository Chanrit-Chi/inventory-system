<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useExpenseStore } from '@/stores/expenseStore'
import {
  TrendingDown,
  RefreshCw,
  Plus,
  DollarSign,
  Calendar,
  Layers,
  PieChart,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
} from 'lucide-vue-next'
import {
  Button,
  Badge,
  Input,
  StatCard,
  Card,
  Alert,
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  EmptyState,
  Skeleton,
} from '@/components/ui'

const expenseStore = useExpenseStore()

// Form state
const form = ref({
  expense_date: new Date().toISOString().slice(0, 10),
  category: 'Utilities',
  amount: '',
  payment_method: 'Cash',
  notes: '',
})

const categories = [
  'Rent & Facility',
  'Utilities',
  'Packaging & Supplies',
  'Marketing & Ads',
  'Logistics & Shipping',
  'Salaries & Wages',
  'Maintenance & Repairs',
  'Other Operational',
]

const categoryColors: Record<string, string> = {
  'Rent & Facility': '#EF4444',
  'Utilities': '#F59E0B',
  'Packaging & Supplies': '#3B82F6',
  'Marketing & Ads': '#8B5CF6',
  'Logistics & Shipping': '#10B981',
  'Salaries & Wages': '#EC4899',
  'Maintenance & Repairs': '#6366F1',
  'Other Operational': '#64748B',
}

const paymentMethods = [
  'Cash',
  'ABA QR / Bank Transfer',
  'Card',
  'Other',
]

// Filters
const filterCategory = ref('')
const filterPaymentMethod = ref('')
const filterDateFrom = ref('')
const filterDateTo = ref('')
const page = ref(1)

const formSuccess = ref('')
const formError = ref('')

// Visual category breakdown
const categoryBreakdown = computed(() => {
  const map: Record<string, number> = {}
  let total = 0

  for (const exp of expenseStore.expenses) {
    const amt = parseFloat(String(exp.amount)) || 0
    total += amt
    map[exp.category] = (map[exp.category] || 0) + amt
  }

  return Object.entries(map).map(([name, amount]) => {
    const percent = total > 0 ? Math.round((amount / total) * 100) : 0
    return {
      name,
      amount,
      percent,
      color: categoryColors[name] || '#924C00',
    }
  }).sort((a, b) => b.amount - a.amount)
})

const avgExpenseValue = computed(() => {
  if (expenseStore.expenses.length === 0) return 0
  return expenseStore.kpis.totalAll / expenseStore.expenses.length
})

async function loadExpenses() {
  const params: Record<string, unknown> = {
    page: page.value,
  }
  if (filterCategory.value) params.category = filterCategory.value
  if (filterPaymentMethod.value) params.payment_method = filterPaymentMethod.value
  if (filterDateFrom.value) params.date_from = filterDateFrom.value
  if (filterDateTo.value) params.date_to = filterDateTo.value

  await expenseStore.fetchExpenses(params)
}

function onFilterChange() {
  page.value = 1
  loadExpenses()
}

function resetFilters() {
  filterCategory.value = ''
  filterPaymentMethod.value = ''
  filterDateFrom.value = ''
  filterDateTo.value = ''
  page.value = 1
  loadExpenses()
}

async function handleRecordExpense() {
  formError.value = ''
  formSuccess.value = ''

  const amt = parseFloat(form.value.amount)
  if (isNaN(amt) || amt <= 0) {
    formError.value = 'Please enter a valid expense amount greater than $0.00.'
    return
  }

  try {
    await expenseStore.recordExpense({
      expense_date: form.value.expense_date,
      category: form.value.category,
      amount: amt,
      payment_method: form.value.payment_method,
      notes: form.value.notes.trim() || undefined,
    })

    formSuccess.value = 'Expense recorded successfully!'
    form.value.amount = ''
    form.value.notes = ''
    setTimeout(() => {
      formSuccess.value = ''
    }, 3000)
  } catch (e: unknown) {
    formError.value = e instanceof Error ? e.message : 'Failed to record expense.'
  }
}

function fmtMoney(amount: number | string | undefined | null): string {
  if (amount === undefined || amount === null) return '$0.00'
  const val = typeof amount === 'string' ? parseFloat(amount) : amount
  return isNaN(val) ? '$0.00' : `$${val.toFixed(2)}`
}

function fmtDate(d: string | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

onMounted(() => {
  loadExpenses()
})
</script>

<template>
  <div class="flex flex-col gap-6 max-w-7xl mx-auto w-full">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-3">
          <h1 class="text-2xl sm:text-3xl font-display font-bold text-foreground tracking-tight">Expenses & Finance Management</h1>
          <Badge variant="neutral" class="font-mono text-xs px-2.5 py-0.5">
            {{ expenseStore.expenses.length }} Entries
          </Badge>
        </div>
        <p class="text-xs text-muted-foreground mt-0.5">
          Log store overheads, utility bills, inventory logistics, and monitor category distribution charts.
        </p>
      </div>

      <Button
        id="btn-refresh-expenses"
        variant="outline"
        size="sm"
        class="h-9 px-3 gap-1.5 text-xs"
        :disabled="expenseStore.loading"
        @click="loadExpenses"
      >
        <RefreshCw :size="14" :class="{ 'animate-spin': expenseStore.loading }" />
        <span>Refresh</span>
      </Button>
    </div>

    <!-- KPI Summary Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        label="Total Outflows"
        :value="fmtMoney(expenseStore.kpis.totalAll)"
        sub="Cumulative overheads"
        :icon="TrendingDown"
        icon-variant="error"
      />
      <StatCard
        label="Today's Expenses"
        :value="fmtMoney(expenseStore.kpis.totalToday)"
        sub="Logged today"
        :icon="Calendar"
        icon-variant="warning"
      />
      <StatCard
        label="Top Category"
        :value="expenseStore.kpis.topCategory || 'N/A'"
        sub="Highest spend area"
        :icon="Layers"
        icon-variant="primary"
      />
      <StatCard
        label="Average Entry"
        :value="fmtMoney(avgExpenseValue)"
        sub="Per recorded item"
        :icon="DollarSign"
        icon-variant="purple"
      />
    </div>

    <!-- Visual Category Distribution Bars -->
    <Card v-if="categoryBreakdown.length > 0" class="p-5 flex flex-col gap-4">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="font-display font-bold text-base text-foreground flex items-center gap-2">
            <PieChart :size="16" class="text-primary" />
            <span>Expense Category Distribution</span>
          </h2>
          <p class="text-xs text-muted-foreground mt-0.5">Percentage breakdown of operational overheads by category</p>
        </div>
        <Badge variant="info" class="font-mono text-xs">{{ categoryBreakdown.length }} Categories</Badge>
      </div>

      <!-- Segmented Bar Preview -->
      <div class="w-full h-3 rounded-full bg-muted overflow-hidden flex">
        <div
          v-for="item in categoryBreakdown"
          :key="item.name"
          class="h-full transition-all"
          :style="{ width: `${item.percent}%`, backgroundColor: item.color }"
          :title="`${item.name}: ${fmtMoney(item.amount)} (${item.percent}%)`"
        />
      </div>

      <!-- Category Legend Grid -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
        <div
          v-for="item in categoryBreakdown"
          :key="item.name"
          class="p-2.5 rounded-lg border border-border/70 bg-surface text-xs space-y-1.5"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-1.5">
              <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" :style="{ backgroundColor: item.color }" />
              <span class="font-semibold text-foreground truncate max-w-[110px]">{{ item.name }}</span>
            </div>
            <span class="font-mono font-bold text-foreground tabular-nums">{{ fmtMoney(item.amount) }}</span>
          </div>
          <div class="w-full h-1 bg-muted rounded-full overflow-hidden">
            <div class="h-full rounded-full" :style="{ width: `${item.percent}%`, backgroundColor: item.color }" />
          </div>
        </div>
      </div>
    </Card>

    <!-- Main Form & Table Layout -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
      <!-- Left: Record Expense Form -->
      <Card class="p-5 flex flex-col gap-4 lg:col-span-1">
        <div class="flex items-center justify-between border-b border-border pb-3">
          <h2 class="font-display font-bold text-base text-foreground">Record Outflow</h2>
          <Badge variant="neutral" class="text-[10px]">Expense Entry</Badge>
        </div>

        <Alert v-if="formError || expenseStore.error" variant="error">
          <div class="flex items-center gap-2">
            <AlertCircle :size="15" class="flex-shrink-0" />
            <span>{{ formError || expenseStore.error }}</span>
          </div>
        </Alert>

        <Alert v-if="formSuccess" variant="success">
          <div class="flex items-center gap-2">
            <CheckCircle2 :size="15" class="flex-shrink-0" />
            <span>{{ formSuccess }}</span>
          </div>
        </Alert>

        <div class="flex flex-col gap-3">
          <div>
            <label class="block text-xs font-semibold text-foreground mb-1">Expense Date *</label>
            <Input id="expense-date" v-model="form.expense_date" type="date" class="h-9 bg-surface text-sm font-mono" />
          </div>

          <div>
            <label class="block text-xs font-semibold text-foreground mb-1">Category *</label>
            <select
              id="expense-category"
              v-model="form.category"
              class="w-full h-9 px-3 text-xs bg-surface border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-cta/30 focus:border-cta"
            >
              <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
            </select>
          </div>

          <div>
            <label class="block text-xs font-semibold text-foreground mb-1">Amount ($ USD) *</label>
            <Input
              id="expense-amount"
              v-model="form.amount"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              class="h-9 bg-surface text-sm font-mono"
            />
          </div>

          <div>
            <label class="block text-xs font-semibold text-foreground mb-1">Payment Method *</label>
            <select
              id="expense-payment-method"
              v-model="form.payment_method"
              class="w-full h-9 px-3 text-xs bg-surface border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-cta/30 focus:border-cta"
            >
              <option v-for="pm in paymentMethods" :key="pm" :value="pm">{{ pm }}</option>
            </select>
          </div>

          <div>
            <label class="block text-xs font-semibold text-foreground mb-1">Notes / Description</label>
            <textarea
              id="expense-notes"
              v-model="form.notes"
              rows="3"
              placeholder="e.g. Monthly internet and shopfloor lighting"
              class="w-full px-3 py-2 text-xs bg-surface border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-cta/30 focus:border-cta"
            ></textarea>
          </div>

          <Button
            id="btn-save-expense"
            variant="primary"
            class="h-9 w-full gap-1.5 text-xs font-semibold mt-2"
            :disabled="expenseStore.mutating"
            @click="handleRecordExpense"
          >
            <span v-if="expenseStore.mutating" class="animate-spin mr-1">⏳</span>
            <Plus v-else :size="15" />
            <span>{{ expenseStore.mutating ? 'Saving Outflow…' : 'Record Expense' }}</span>
          </Button>
        </div>
      </Card>

      <!-- Right: Filter Bar & Expenses Table -->
      <div class="flex flex-col gap-4 lg:col-span-2">
        <!-- Filter Toolbar -->
        <div class="rounded-xl border border-border bg-card p-4 shadow-xs flex flex-col gap-3">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-[11px] font-semibold text-muted-foreground mb-1">Category</label>
              <select
                id="expense-filter-cat"
                v-model="filterCategory"
                class="w-full h-8 px-2.5 text-xs bg-surface border border-input rounded-md"
                @change="onFilterChange"
              >
                <option value="">All Categories</option>
                <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
              </select>
            </div>

            <div>
              <label class="block text-[11px] font-semibold text-muted-foreground mb-1">Payment Method</label>
              <select
                id="expense-filter-pm"
                v-model="filterPaymentMethod"
                class="w-full h-8 px-2.5 text-xs bg-surface border border-input rounded-md"
                @change="onFilterChange"
              >
                <option value="">All Payment Methods</option>
                <option v-for="pm in paymentMethods" :key="pm" :value="pm">{{ pm }}</option>
              </select>
            </div>
          </div>

          <div class="flex items-center justify-between pt-2 border-t border-border/50 flex-wrap gap-2 text-xs">
            <div class="flex items-center gap-2">
              <span class="text-muted-foreground">Date:</span>
              <Input v-model="filterDateFrom" type="date" class="h-8 w-32 bg-surface text-xs font-mono" @change="onFilterChange" />
              <span class="text-muted-foreground">to</span>
              <Input v-model="filterDateTo" type="date" class="h-8 w-32 bg-surface text-xs font-mono" @change="onFilterChange" />
            </div>

            <Button variant="ghost" size="sm" class="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground" @click="resetFilters">
              Reset Filters
            </Button>
          </div>
        </div>

        <!-- Expenses Table Container -->
        <div class="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
          <div v-if="expenseStore.loading" class="p-6 space-y-3">
            <Skeleton v-for="i in 4" :key="i" class="h-10 w-full" />
          </div>

          <EmptyState
            v-else-if="expenseStore.expenses.length === 0"
            :icon="DollarSign"
            title="No expenses found"
            description="No outflow entries recorded matching the selected filter parameters."
          />

          <div v-else class="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow class="bg-muted/40">
                  <TableHead>Category</TableHead>
                  <TableHead class="font-mono">Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead class="font-mono">Date</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="e in expenseStore.expenses" :key="e.id" class="hover:bg-surface-subtle/80 transition-colors">
                  <TableCell>
                    <div class="font-semibold text-foreground flex items-center gap-2">
                      <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" :style="{ backgroundColor: categoryColors[e.category] || '#924C00' }" />
                      <span>{{ e.category }}</span>
                    </div>
                  </TableCell>
                  <TableCell class="font-mono text-sm font-bold text-destructive tabular-nums">
                    {{ fmtMoney(e.amount) }}
                  </TableCell>
                  <TableCell class="text-xs">
                    <Badge variant="neutral" class="text-[10px] px-2 py-0.5">
                      {{ e.payment_method }}
                    </Badge>
                  </TableCell>
                  <TableCell class="font-mono text-xs text-muted-foreground">
                    {{ fmtDate(e.expense_date) }}
                  </TableCell>
                  <TableCell class="text-xs text-muted-foreground truncate max-w-xs">
                    {{ e.notes || '—' }}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          <!-- Pagination -->
          <div
            v-if="expenseStore.meta && expenseStore.meta.last_page > 1"
            class="flex items-center justify-between px-4 py-3 border-t border-border bg-surface-subtle/50 text-xs text-muted-foreground"
          >
            <span class="font-mono">
              Page {{ page }} of {{ expenseStore.meta.last_page }}
            </span>
            <div class="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                class="h-8 px-2.5 text-xs gap-1"
                :disabled="page <= 1 || expenseStore.loading"
                @click="page--; loadExpenses()"
              >
                <ChevronLeft :size="14" />
                <span>Previous</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                class="h-8 px-2.5 text-xs gap-1"
                :disabled="page >= expenseStore.meta.last_page || expenseStore.loading"
                @click="page++; loadExpenses()"
              >
                <span>Next</span>
                <ChevronRight :size="14" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
