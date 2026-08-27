<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useExpenseStore } from '@/stores/expenseStore'

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

// Visual category breakdown distribution computations
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
      color: categoryColors[name] || 'var(--action-primary)',
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
    // Reset form
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
  <div class="flex-col gap-24">
    <!-- Header -->
    <div class="flex items-center justify-between" style="flex-wrap: wrap; gap: 16px;">
      <div>
        <div class="flex items-center gap-10">
          <h1 class="page-title">Expenses & Finance Management</h1>
          <span class="badge badge--neutral font-semibold tabular-nums">
            {{ expenseStore.expenses.length }} Entries
          </span>
        </div>
        <p class="text-muted text-sm mt-4">
          Log store overheads, utility bills, inventory freight, and inspect category distribution charts.
        </p>
      </div>

      <button id="btn-refresh-expenses" class="btn btn--ghost" @click="loadExpenses">
        ↺ Refresh
      </button>
    </div>

    <!-- KPI Summary Cards -->
    <div class="grid-4 gap-16">
      <div class="stat-card">
        <div class="stat-card-header">
          <div class="icon-badge icon-badge--danger">
            <span>💰</span>
          </div>
          <div class="trend-pill trend-pill--down">
            <span>● Cumulative</span>
          </div>
        </div>
        <div class="stat-card-body">
          <span class="stat-card-value tabular-nums" style="color: var(--status-error);">
            {{ fmtMoney(expenseStore.kpis.totalAll) }}
          </span>
          <span class="stat-card-label">Total Outflows</span>
          <span class="stat-card-sub">Recorded operational costs</span>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-card-header">
          <div class="icon-badge icon-badge--warning">
            <span>📅</span>
          </div>
          <div class="trend-pill trend-pill--warning">
            <span>Today</span>
          </div>
        </div>
        <div class="stat-card-body">
          <span class="stat-card-value tabular-nums" style="color: var(--status-warning);">
            {{ fmtMoney(expenseStore.kpis.totalToday) }}
          </span>
          <span class="stat-card-label">Today's Expenses</span>
          <span class="stat-card-sub">Outflows logged today</span>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-card-header">
          <div class="icon-badge icon-badge--primary">
            <span>🏢</span>
          </div>
          <div class="trend-pill trend-pill--neutral">
            <span>Largest</span>
          </div>
        </div>
        <div class="stat-card-body">
          <span class="stat-card-value" style="font-size: 20px; color: var(--action-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            {{ expenseStore.kpis.topCategory }}
          </span>
          <span class="stat-card-label">Top Expense Category</span>
          <span class="stat-card-sub">Highest operational spend</span>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-card-header">
          <div class="icon-badge icon-badge--purple">
            <span>📊</span>
          </div>
          <div class="trend-pill trend-pill--neutral">
            <span>Average</span>
          </div>
        </div>
        <div class="stat-card-body">
          <span class="stat-card-value tabular-nums" style="color: var(--status-purple-text);">
            {{ fmtMoney(avgExpenseValue) }}
          </span>
          <span class="stat-card-label">Average Entry</span>
          <span class="stat-card-sub">Per recorded expense item</span>
        </div>
      </div>
    </div>

    <!-- Visual Category Distribution Bars -->
    <section v-if="categoryBreakdown.length > 0" class="card">
      <div class="flex items-center justify-between mb-16">
        <div>
          <h2 class="font-bold text-lg">Expense Category Distribution</h2>
          <p class="text-muted text-xs mt-2">Percentage breakdown of operational overheads by category</p>
        </div>
        <span class="badge badge--blue tabular-nums">{{ categoryBreakdown.length }} Categories</span>
      </div>

      <!-- Segmented Bar Preview -->
      <div class="category-segmented-bar mb-16">
        <div
          v-for="item in categoryBreakdown"
          :key="item.name"
          class="segmented-slice"
          :style="{ width: `${item.percent}%`, backgroundColor: item.color }"
          :title="`${item.name}: ${fmtMoney(item.amount)} (${item.percent}%)`"
        ></div>
      </div>

      <!-- Category Legend Grid -->
      <div class="category-chart-grid">
        <div
          v-for="item in categoryBreakdown"
          :key="item.name"
          class="category-chart-item"
        >
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-8">
              <span class="chart-color-dot" :style="{ backgroundColor: item.color }"></span>
              <span class="font-semibold text-sm">{{ item.name }}</span>
            </div>
            <div class="text-right">
              <span class="font-bold tabular-nums text-sm">{{ fmtMoney(item.amount) }}</span>
              <span class="text-xs text-muted tabular-nums ml-4">({{ item.percent }}%)</span>
            </div>
          </div>
          <div class="category-progress-bg">
            <div
              class="category-progress-fill"
              :style="{ width: `${item.percent}%`, backgroundColor: item.color }"
            ></div>
          </div>
        </div>
      </div>
    </section>

    <!-- Main Form & Table Layout -->
    <div class="grid-2 gap-24" style="grid-template-columns: 380px 1fr;">
      <!-- Left: Record Expense Form -->
      <section class="card flex-col gap-16" style="height: fit-content;">
        <div class="flex items-center justify-between">
          <h2 class="font-bold text-lg">Record Outflow</h2>
          <span class="badge badge--neutral text-xs">Expense Entry</span>
        </div>

        <div v-if="formError || expenseStore.error" class="alert alert--error mb-8">
          <span>⚠️ {{ formError || expenseStore.error }}</span>
        </div>

        <div v-if="formSuccess" class="alert alert--success mb-8">
          <span>✓ {{ formSuccess }}</span>
        </div>

        <div class="flex-col gap-16">
          <div class="form-group">
            <label class="form-label">Expense Date *</label>
            <input
              id="expense-date"
              v-model="form.expense_date"
              type="date"
              :class="{ 'input--error': expenseStore.fieldErrors?.expense_date }"
            />
          </div>

          <div class="form-group">
            <label class="form-label">Category *</label>
            <select
              id="expense-category"
              v-model="form.category"
              :class="{ 'input--error': expenseStore.fieldErrors?.category }"
            >
              <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Amount ($ USD) *</label>
            <input
              id="expense-amount"
              v-model="form.amount"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              class="tabular-nums"
              :class="{ 'input--error': expenseStore.fieldErrors?.amount }"
            />
          </div>

          <div class="form-group">
            <label class="form-label">Payment Method *</label>
            <select
              id="expense-payment-method"
              v-model="form.payment_method"
              :class="{ 'input--error': expenseStore.fieldErrors?.payment_method }"
            >
              <option v-for="pm in paymentMethods" :key="pm" :value="pm">{{ pm }}</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Notes / Purpose Description</label>
            <textarea
              id="expense-notes"
              v-model="form.notes"
              rows="3"
              placeholder="e.g. Monthly high-speed fiber internet and shopfloor lighting"
            ></textarea>
          </div>

          <button
            id="btn-save-expense"
            class="btn btn--primary btn--lg mt-8"
            :disabled="expenseStore.mutating"
            @click="handleRecordExpense"
          >
            <span v-if="expenseStore.mutating" class="spinner"></span>
            {{ expenseStore.mutating ? 'Saving Outflow…' : '+ Record Expense' }}
          </button>
        </div>
      </section>

      <!-- Right: Filter Bar & Expenses Table -->
      <div class="flex-col gap-16">
        <!-- Filter Bar -->
        <section class="card">
          <div class="grid-4 gap-12" style="align-items: flex-end;">
            <div class="form-group">
              <label class="form-label">Category</label>
              <select id="expense-filter-cat" v-model="filterCategory" @change="onFilterChange">
                <option value="">All Categories</option>
                <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Date From</label>
              <input id="expense-filter-from" type="date" v-model="filterDateFrom" @change="onFilterChange" />
            </div>

            <div class="form-group">
              <label class="form-label">Date To</label>
              <input id="expense-filter-to" type="date" v-model="filterDateTo" @change="onFilterChange" />
            </div>

            <button id="btn-reset-expenses" class="btn btn--ghost" @click="resetFilters">
              Reset
            </button>
          </div>
        </section>

        <!-- Expenses Table -->
        <section class="card" style="padding: 0; overflow: hidden;">
          <div v-if="expenseStore.loading" style="padding: 24px;">
            <div v-for="i in 5" :key="i" class="skeleton-row"></div>
          </div>

          <div v-else-if="expenseStore.expenses.length === 0" class="empty-state">
            <div class="empty-icon">💰</div>
            <h3 class="font-bold text-lg mb-8">No expenses logged</h3>
            <p class="text-muted">Use the form on the left to record your store's operational expenses.</p>
          </div>

          <div v-else class="table-wrap" style="border: none; border-radius: 0; box-shadow: none;">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Category</th>
                  <th>Notes</th>
                  <th>Payment Method</th>
                  <th style="text-align: right;">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="exp in expenseStore.expenses" :key="exp.id">
                  <td class="tabular-nums text-sm font-semibold">
                    {{ fmtDate(exp.expense_date) }}
                  </td>
                  <td>
                    <span class="badge badge--neutral font-medium">
                      {{ exp.category }}
                    </span>
                  </td>
                  <td>
                    <span v-if="exp.notes" class="text-sm">{{ exp.notes }}</span>
                    <span v-else class="text-muted text-xs">—</span>
                  </td>
                  <td>
                    <span class="badge badge--blue text-xs">
                      {{ exp.payment_method }}
                    </span>
                  </td>
                  <td class="tabular-nums font-bold text-right" style="color: var(--status-error); font-size: 15px;">
                    {{ fmtMoney(exp.amount) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Pagination -->
          <div
            v-if="expenseStore.meta && expenseStore.meta.last_page > 1"
            class="pagination"
            style="padding: 16px 24px; border-top: 1px solid var(--border-color);"
          >
            <button
              class="page-btn"
              :disabled="page <= 1 || expenseStore.loading"
              @click="page--; loadExpenses()"
            >
              ‹ Previous
            </button>
            <span class="page-info tabular-nums">
              Page {{ page }} of {{ expenseStore.meta.last_page }} ({{ expenseStore.meta.total }} total)
            </span>
            <button
              class="page-btn"
              :disabled="page >= expenseStore.meta.last_page || expenseStore.loading"
              @click="page++; loadExpenses()"
            >
              Next ›
            </button>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.category-segmented-bar {
  width: 100%;
  height: 12px;
  background-color: var(--surface-alt);
  border-radius: var(--radius-full);
  display: flex;
  overflow: hidden;
  border: 1px solid var(--border-color);
}

.segmented-slice {
  height: 100%;
  transition: width 300ms ease;
}

.category-chart-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 14px;
}

.category-chart-item {
  padding: 10px 12px;
  background-color: var(--surface-alt);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-subtle);
}

.chart-color-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.category-progress-bg {
  width: 100%;
  height: 4px;
  background-color: var(--border-color);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.category-progress-fill {
  height: 100%;
  border-radius: var(--radius-full);
  transition: width 300ms ease;
}
</style>
