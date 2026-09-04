<script setup lang="ts">
import { ref, computed } from 'vue'
import { useImportStore } from '@/stores/importStore'
import { useToast } from '@/composables/useToast'
import {
  Upload,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  ShoppingCart,
  Package,
  Info,
  Layers,
  FileCheck2,
  Trash2,
} from 'lucide-vue-next'
import {
  Button,
  Badge,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from '@/components/ui'

const importStore = useImportStore()
const toast = useToast()

// ── Tab state ──────────────────────────────────────────────────────────────────
const activeTab = ref<'products' | 'sales'>('products')

// ── File selection ─────────────────────────────────────────────────────────────
const productsFile = ref<File | null>(null)
const salesFile = ref<File | null>(null)
const productsDrag = ref(false)
const salesDrag = ref(false)

// Products options
const updateExisting = ref(false)

// Errors accordion
const errorsOpen = ref(false)

const currentFile = computed(() => (activeTab.value === 'products' ? productsFile.value : salesFile.value))
const isDragging = computed(() => (activeTab.value === 'products' ? productsDrag.value : salesDrag.value))

// ── Drop-zone helpers ──────────────────────────────────────────────────────────
function onDragEnter(tab: 'products' | 'sales') {
  if (tab === 'products') productsDrag.value = true
  else salesDrag.value = true
}

function onDragLeave(tab: 'products' | 'sales') {
  if (tab === 'products') productsDrag.value = false
  else salesDrag.value = false
}

function onDrop(tab: 'products' | 'sales', event: DragEvent) {
  if (tab === 'products') productsDrag.value = false
  else salesDrag.value = false

  const file = event.dataTransfer?.files?.[0]
  if (!file) return
  assignFile(tab, file)
}

function onFileInput(tab: 'products' | 'sales', event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  assignFile(tab, file)
  input.value = ''
}

function assignFile(tab: 'products' | 'sales', file: File) {
  const allowed = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
  ]
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (!['xlsx', 'xls', 'csv'].includes(ext ?? '') && !allowed.includes(file.type)) {
    toast.error('Only .xlsx, .xls, or .csv spreadsheet files are accepted.')
    return
  }
  if (file.size > 10 * 1024 * 1024) {
    toast.error('File size exceeds the 10 MB maximum limit.')
    return
  }
  if (tab === 'products') productsFile.value = file
  else salesFile.value = file
  importStore.reset()
}

function clearFile(tab: 'products' | 'sales') {
  if (tab === 'products') productsFile.value = null
  else salesFile.value = null
  importStore.reset()
  errorsOpen.value = false
}

// ── File size formatter ────────────────────────────────────────────────────────
function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

// ── Template download ──────────────────────────────────────────────────────────
async function handleDownloadTemplate(tab: 'products' | 'sales') {
  try {
    await importStore.downloadTemplate(tab)
    toast.success(`${tab === 'products' ? 'Products' : 'Sales'} template downloaded successfully.`)
  } catch {
    toast.error('Failed to download template. Please try again.')
  }
}

// ── Import action ──────────────────────────────────────────────────────────────
async function runImport() {
  if (activeTab.value === 'products') {
    if (!productsFile.value) return
    try {
      const res = await importStore.importProducts(productsFile.value, updateExisting.value)
      if (res.errors && res.errors.length > 0) {
        errorsOpen.value = true
        toast.warning(`Import completed with ${res.errors.length} issue(s). Check error log below.`)
      } else {
        toast.success(`Successfully imported ${res.imported} products into master catalog!`)
      }
    } catch {
      toast.error(importStore.error ?? 'Product import failed.')
    }
  } else {
    if (!salesFile.value) return
    try {
      const res = await importStore.importSales(salesFile.value)
      if (res.errors && res.errors.length > 0) {
        errorsOpen.value = true
        toast.warning(`Import completed with ${res.errors.length} issue(s). Check error log below.`)
      } else {
        toast.success(`Successfully imported ${res.imported} sales orders!`)
      }
    } catch {
      toast.error(importStore.error ?? 'Sales import failed.')
    }
  }
}

// ── Column guide per tab ───────────────────────────────────────────────────────
const productColumns = [
  { name: 'name', required: true, note: 'Primary product name (grouping key for variable products)' },
  { name: 'sku', required: false, note: 'Variant unique SKU (auto-generated if omitted)' },
  { name: 'barcode', required: false, note: 'Variant EAN / UPC / Code128 barcode number' },
  { name: 'variant_name', required: false, note: 'Variant / Variable name (e.g. "Red / M", "Large"). Default: "Standard"' },
  { name: 'attributes', required: false, note: 'Variant attributes formatted as "Key: Value | Key: Value" (e.g. "Color: Red | Size: M")' },
  { name: 'parent_sku', required: false, note: 'Parent product identifier to group variable rows together' },
  { name: 'category', required: false, note: 'Category name (auto-created if new)' },
  { name: 'purchase_price', required: true, note: 'Unit cost / acquisition price ($)' },
  { name: 'selling_price', required: true, note: 'Default retail selling price ($)' },
  { name: 'quantity', required: false, note: 'Initial opening stock ledger for this variant (default: 0)' },
  { name: 'reorder_level', required: false, note: 'Low stock alert threshold (default: 5)' },
  { name: 'description', required: false, note: 'Product description notes' },
  { name: 'is_active', required: false, note: '1 = Active, 0 = Inactive (default: 1)' },
]

const salesColumns = [
  { name: 'order_date', required: true, note: 'YYYY-MM-DD or DD/MM/YYYY transaction timestamp' },
  { name: 'order_number', required: false, note: 'Legacy order number or external reference ID' },
  { name: 'customer_name', required: false, note: 'Customer full name' },
  { name: 'customer_phone', required: false, note: 'Customer contact phone (deduplicates CRM profile)' },
  { name: 'customer_email', required: false, note: 'Customer email address' },
  { name: 'channel_name', required: true, note: 'Matching active Sales Channel name (e.g. Main POS, Web Store)' },
  { name: 'product_sku', required: true, note: 'Existing product SKU or barcode in master matrix' },
  { name: 'quantity', required: true, note: 'Units sold in order' },
  { name: 'unit_price', required: true, note: 'Effective selling price per unit ($)' },
  { name: 'discount', required: false, note: 'Line-level discount amount ($)' },
  { name: 'payment_method', required: false, note: 'cash / transfer / card / qr' },
  { name: 'payment_status', required: false, note: 'paid / unpaid / partial (default: paid)' },
  { name: 'status', required: false, note: 'COMPLETED / PENDING / CANCELLED / REFUNDED (default: COMPLETED)' },
  { name: 'notes', required: false, note: 'Internal cashier notes or remarks' },
]

const currentColumns = computed(() => (activeTab.value === 'products' ? productColumns : salesColumns))
</script>

<template>
  <div class="flex flex-col gap-6 max-w-7xl mx-auto w-full">
    <!-- Page Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div class="flex items-center gap-3">
        <div class="p-2.5 rounded-xl bg-cta-muted text-primary border border-border-strong shadow-2xs">
          <Upload :size="20" />
        </div>
        <div>
          <div class="flex items-center gap-2.5 flex-wrap">
            <h1 class="text-2xl sm:text-3xl font-display font-bold text-foreground tracking-tight">Data Import Engine</h1>
            <Badge variant="default" class="text-xs px-2.5 py-0.5 font-medium">
              Excel / CSV
            </Badge>
            <Badge variant="success" dot class="text-xs px-2.5 py-0.5 font-semibold">
              Simple &amp; Variable Products
            </Badge>
          </div>
          <p class="text-muted-foreground text-sm mt-0.5">
            Bulk migrate master products, variable catalog matrices, and historical sales transactions from spreadsheets.
          </p>
        </div>
      </div>

      <!-- Header Action: Download Template Button -->
      <div class="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          class="h-9 px-3.5 gap-1.5 bg-card border-border text-foreground hover:bg-surface-subtle shadow-2xs cursor-pointer"
          @click="handleDownloadTemplate(activeTab)"
        >
          <Download :size="15" class="text-primary" />
          <span>Download {{ activeTab === 'products' ? 'Products' : 'Sales' }} Template</span>
        </Button>
      </div>
    </div>

    <!-- Segmented Navigation Pill Tabs -->
    <div class="flex items-center gap-1.5 p-1 bg-surface border border-border rounded-xl shadow-2xs w-fit">
      <button
        type="button"
        @click="activeTab = 'products'; importStore.reset(); errorsOpen = false"
        :class="[
          'flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer',
          activeTab === 'products'
            ? 'bg-cta text-cta-foreground shadow-xs'
            : 'text-muted-foreground hover:text-foreground hover:bg-surface-subtle'
        ]"
      >
        <Package :size="16" />
        <span>Products & Master Matrix</span>
      </button>

      <button
        type="button"
        @click="activeTab = 'sales'; importStore.reset(); errorsOpen = false"
        :class="[
          'flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer',
          activeTab === 'sales'
            ? 'bg-cta text-cta-foreground shadow-xs'
            : 'text-muted-foreground hover:text-foreground hover:bg-surface-subtle'
        ]"
      >
        <ShoppingCart :size="16" />
        <span>Historical Sales Orders</span>
      </button>
    </div>

    <!-- Main Workspace Layout: Left Upload Area & Right Schema Reference -->
    <div class="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
      <!-- Left Column: Upload & Processing Actions (2 cols) -->
      <div class="xl:col-span-2 space-y-5">
        <!-- Workflow Info Card -->
        <Card class="border-border bg-card shadow-xs">
          <CardContent class="p-5">
            <div class="flex items-start justify-between gap-4">
              <div class="flex items-start gap-3.5">
                <div class="p-2 rounded-xl bg-cta-muted text-primary border border-border-strong shrink-0 mt-0.5">
                  <Info :size="18" />
                </div>
                <div>
                  <h3 class="font-display font-bold text-sm text-foreground">
                    {{ activeTab === 'products' ? 'Products & Stock Intake Guidelines' : 'Sales History Import Guidelines' }}
                  </h3>
                  <p class="text-xs text-muted-foreground mt-1 leading-relaxed">
                    <template v-if="activeTab === 'products'">
                      <strong>Supports Simple &amp; Variable Products:</strong> Multiple rows sharing the same <code class="px-1.5 py-0.5 rounded bg-muted font-mono text-[11px] text-foreground font-semibold">name</code> or <code class="px-1.5 py-0.5 rounded bg-muted font-mono text-[11px] text-foreground font-semibold">parent_sku</code> are automatically merged into a single master product with multiple variants. Use <code class="px-1.5 py-0.5 rounded bg-muted font-mono text-[11px] text-foreground font-semibold">variant_name</code> and <code class="px-1.5 py-0.5 rounded bg-muted font-mono text-[11px] text-foreground font-semibold">attributes</code> (e.g. <span class="font-mono text-[11px] text-foreground font-medium">Color: Red | Size: M</span>) to auto-generate variant attributes and stock matrices.
                    </template>
                    <template v-else>
                      Rows sharing the same <code class="px-1.5 py-0.5 rounded bg-muted font-mono text-[11px] text-foreground font-semibold">order_number</code> are grouped into a single multi-item sales order. Historical import records transaction revenue without deducting current live inventory.
                    </template>
                  </p>
                </div>
              </div>

              <Badge variant="neutral" class="text-[11px] shrink-0 font-mono">
                Max 10 MB
              </Badge>
            </div>
          </CardContent>
        </Card>

        <!-- Tactile Drop Zone -->
        <div
          :class="[
            'border-2 border-dashed rounded-2xl p-8 sm:p-10 text-center transition-all duration-200 cursor-pointer shadow-xs relative overflow-hidden',
            isDragging
              ? 'border-cta bg-cta-muted/40 ring-4 ring-cta/10 scale-[1.005]'
              : 'border-border hover:border-cta hover:bg-surface-subtle bg-surface'
          ]"
          @dragenter.prevent="onDragEnter(activeTab)"
          @dragover.prevent
          @dragleave.prevent="onDragLeave(activeTab)"
          @drop.prevent="onDrop(activeTab, $event)"
          @click="($refs['fileInput_' + activeTab] as HTMLInputElement)?.click()"
        >
          <input
            :ref="'fileInput_' + activeTab"
            type="file"
            accept=".xlsx,.xls,.csv"
            class="hidden"
            @change="onFileInput(activeTab, $event)"
          />

          <!-- State 1: No file selected -->
          <template v-if="!currentFile">
            <div class="flex flex-col items-center gap-3.5 max-w-md mx-auto">
              <div class="w-14 h-14 rounded-2xl bg-cta-muted border border-border-strong flex items-center justify-center text-primary shadow-xs">
                <FileSpreadsheet :size="28" />
              </div>
              <div>
                <p class="font-display font-bold text-base text-foreground">
                  Drop your spreadsheet here, or <span class="text-cta underline underline-offset-2">browse files</span>
                </p>
                <p class="text-xs text-muted-foreground mt-1">
                  Supported formats: <strong class="text-foreground font-semibold">.xlsx</strong>, <strong class="text-foreground font-semibold">.xls</strong>, or <strong class="text-foreground font-semibold">.csv</strong> (Up to 10 MB per batch)
                </p>
              </div>
            </div>
          </template>

          <!-- State 2: File Selected -->
          <template v-else>
            <div class="flex flex-col sm:flex-row items-center justify-between gap-4 p-3 rounded-xl bg-surface-subtle border border-border">
              <div class="flex items-center gap-3.5 min-w-0">
                <div class="w-11 h-11 rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 flex items-center justify-center shrink-0">
                  <FileCheck2 :size="22" />
                </div>
                <div class="text-left min-w-0">
                  <p class="font-bold text-sm text-foreground truncate font-mono">{{ currentFile.name }}</p>
                  <div class="flex items-center gap-2 mt-0.5">
                    <span class="text-xs font-mono text-muted-foreground">{{ formatSize(currentFile.size) }}</span>
                    <span class="w-1 h-1 rounded-full bg-border" />
                    <Badge variant="success" class="text-[10px] px-1.5 py-0">Ready for Import</Badge>
                  </div>
                </div>
              </div>

              <div class="flex items-center gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  class="h-8 px-2.5 text-xs text-destructive hover:bg-error-bg hover:border-error-border border-border cursor-pointer"
                  @click.stop="clearFile(activeTab)"
                  title="Remove selected file"
                >
                  <Trash2 :size="13" class="mr-1" />
                  <span>Remove</span>
                </Button>
              </div>
            </div>
          </template>
        </div>

        <!-- Products-Specific Options Card -->
        <Card v-if="activeTab === 'products'" class="border-border bg-card shadow-xs">
          <CardContent class="p-4 sm:p-5">
            <label class="flex items-start sm:items-center gap-3.5 cursor-pointer">
              <input
                v-model="updateExisting"
                type="checkbox"
                class="w-4 h-4 mt-0.5 sm:mt-0 rounded border-border text-primary focus:ring-cta cursor-pointer"
              />
              <div class="flex-1">
                <span class="text-sm font-semibold text-foreground">
                  Update existing products if SKU matches
                </span>
                <p class="text-xs text-muted-foreground mt-0.5">
                  When enabled, matching SKUs will have their prices, stock, and descriptions updated. If disabled, duplicate SKUs will be skipped safely.
                </p>
              </div>
            </label>
          </CardContent>
        </Card>

        <!-- Start Import Action Button -->
        <Button
          variant="cta"
          size="lg"
          :disabled="!currentFile || importStore.loading"
          @click="runImport"
          class="w-full h-12 text-sm font-bold shadow-xs gap-2 cursor-pointer"
        >
          <RefreshCw v-if="importStore.loading" :size="16" class="animate-spin" />
          <Upload v-else :size="16" />
          <span>{{ importStore.loading ? 'Importing spreadsheet, please wait…' : 'Execute Import Batch' }}</span>
        </Button>

        <!-- Import Results & Metrics Card -->
        <div v-if="importStore.result" class="rounded-2xl border border-border bg-card shadow-xs overflow-hidden">
          <div class="p-5 border-b border-border bg-surface-subtle flex items-center justify-between">
            <div class="flex items-center gap-2.5">
              <div class="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                <CheckCircle2 :size="18" />
              </div>
              <div>
                <h3 class="font-display font-bold text-base text-foreground">Import Batch Summary</h3>
                <p class="text-xs text-muted-foreground">Execution completed across all spreadsheet rows</p>
              </div>
            </div>
            <Badge :variant="importStore.result.errors.length > 0 ? 'warning' : 'success'" class="text-xs">
              {{ importStore.result.errors.length > 0 ? 'Completed with Warnings' : '100% Clean' }}
            </Badge>
          </div>

          <div class="p-5 space-y-4">
            <!-- 4-Stat Metric Pills Grid -->
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div class="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-center">
                <span class="text-3xs uppercase font-bold tracking-wider text-emerald-700 dark:text-emerald-300 block">Imported</span>
                <span class="text-2xl font-black font-display text-emerald-700 dark:text-emerald-300 block mt-0.5">
                  {{ importStore.result.imported }}
                </span>
              </div>

              <div v-if="activeTab === 'products'" class="p-3.5 rounded-xl bg-blue-500/15 border border-blue-500/30 text-center">
                <span class="text-3xs uppercase font-bold tracking-wider text-blue-700 dark:text-blue-300 block">Updated</span>
                <span class="text-2xl font-black font-display text-blue-700 dark:text-blue-300 block mt-0.5">
                  {{ importStore.result.updated ?? 0 }}
                </span>
              </div>

              <div class="p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-center">
                <span class="text-3xs uppercase font-bold tracking-wider text-amber-700 dark:text-amber-300 block">Skipped</span>
                <span class="text-2xl font-black font-display text-amber-700 dark:text-amber-300 block mt-0.5">
                  {{ importStore.result.skipped }}
                </span>
              </div>

              <div class="p-3.5 rounded-xl bg-red-500/15 border border-red-500/30 text-center">
                <span class="text-3xs uppercase font-bold tracking-wider text-red-700 dark:text-red-300 block">Errors</span>
                <span class="text-2xl font-black font-display text-red-700 dark:text-red-300 block mt-0.5">
                  {{ importStore.result.errors.length }}
                </span>
              </div>
            </div>

            <!-- Error Log Accordion (If errors occurred) -->
            <div v-if="importStore.result.errors.length > 0" class="border border-error-border rounded-xl overflow-hidden bg-error-bg/30">
              <button
                type="button"
                @click="errorsOpen = !errorsOpen"
                class="w-full flex items-center justify-between px-4 py-3 bg-error-bg hover:bg-error-bg/80 transition-colors text-left cursor-pointer"
              >
                <div class="flex items-center gap-2 text-error-text font-semibold text-xs sm:text-sm">
                  <AlertCircle :size="16" />
                  <span>{{ importStore.result.errors.length }} row error(s) detected — click to {{ errorsOpen ? 'hide' : 'inspect details' }}</span>
                </div>
                <ChevronDown v-if="errorsOpen" :size="16" class="text-error-text" />
                <ChevronRight v-else :size="16" class="text-error-text" />
              </button>

              <div v-if="errorsOpen" class="max-h-72 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow class="bg-surface-subtle border-b border-border">
                      <TableHead class="w-20 font-bold text-xs">Row #</TableHead>
                      <TableHead class="font-bold text-xs">Validation Failure Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow
                      v-for="(err, idx) in importStore.result.errors"
                      :key="idx"
                      class="hover:bg-surface-subtle transition-colors"
                    >
                      <TableCell class="font-mono text-xs font-bold text-muted-foreground">
                        #{{ err.row }}
                      </TableCell>
                      <TableCell class="text-xs text-error-text font-medium">
                        {{ err.message }}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>

            <!-- Clean Success State (Zero errors) -->
            <div v-else class="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 text-xs font-semibold">
              <CheckCircle2 :size="16" />
              <span>All records imported flawlessly with zero schema or validation errors!</span>
            </div>
          </div>
        </div>

        <!-- Global Error Banner -->
        <div
          v-if="importStore.error && !importStore.result"
          class="flex items-start gap-3 bg-error-bg border border-error-border rounded-xl p-4 shadow-2xs"
        >
          <AlertCircle :size="18" class="text-destructive shrink-0 mt-0.5" />
          <div>
            <p class="text-sm font-bold text-destructive">Import Batch Failed</p>
            <p class="text-xs text-error-text mt-0.5">{{ importStore.error }}</p>
          </div>
        </div>
      </div>

      <!-- Right Column: Schema & Column Reference Guide (1 col) -->
      <div class="xl:col-span-1">
        <Card class="border-border bg-card shadow-xs overflow-hidden sticky top-6">
          <CardHeader class="pb-3 border-b border-border bg-surface-subtle">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <Layers :size="16" class="text-primary" />
                <CardTitle class="font-display font-bold text-base">Column Reference</CardTitle>
              </div>
              <Badge variant="default" class="text-[10px] px-2 py-0.5">
                {{ activeTab === 'products' ? 'Products Matrix' : 'Sales Orders' }}
              </Badge>
            </div>
            <CardDescription class="text-xs mt-1">
              Field definitions for <strong class="text-foreground">{{ activeTab === 'products' ? 'Products' : 'Sales' }}</strong> template. <span class="text-destructive font-bold">*</span> = required.
            </CardDescription>
          </CardHeader>

          <CardContent class="p-0 max-h-[520px] overflow-y-auto divide-y divide-border/70">
            <div
              v-for="col in currentColumns"
              :key="col.name"
              class="px-4 py-3 flex items-start gap-3 hover:bg-surface-subtle/50 transition-colors"
            >
              <code class="text-xs bg-muted text-foreground px-2 py-0.5 rounded-md font-mono font-bold shrink-0 mt-0.5 border border-border/80">
                {{ col.name }}<span v-if="col.required" class="text-destructive font-bold ml-0.5">*</span>
              </code>
              <span class="text-xs text-muted-foreground leading-relaxed">{{ col.note || 'Optional data field' }}</span>
            </div>
          </CardContent>

          <!-- Tip Box in Footer -->
          <div class="p-4 border-t border-border bg-surface-subtle dark:bg-surface-muted/60 flex items-start gap-2.5">
            <div class="p-1.5 rounded-lg bg-cta-muted text-primary border border-border-strong shrink-0 mt-0.5">
              <Info :size="14" />
            </div>
            <p class="text-xs text-muted-foreground leading-relaxed">
              <strong class="text-foreground font-semibold">Best Practice:</strong> Download the pre-formatted Excel template above. It contains header validations and sample records.
            </p>
          </div>
        </Card>
      </div>
    </div>
  </div>
</template>
