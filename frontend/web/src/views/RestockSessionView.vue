<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useRestockStore, type RestockScanResult } from '@/stores/restockStore'
import {
  ArrowDownToLine,
  Check,
  Zap,
  Trash2,
  ArrowLeft,
  AlertCircle,
  Info,
} from 'lucide-vue-next'
import {
  Button,
  Badge,
  Input,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Card,
  Alert,
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  EmptyState,
} from '@/components/ui'

const router = useRouter()
const restockStore = useRestockStore()

const barcodeInput = ref('')
const scanError = ref('')
const successMessage = ref('')
const showVariantPicker = ref(false)
const multiVariantProduct = ref<RestockScanResult | null>(null)
const discardConfirm = ref(false)

const activeStep = computed(() => {
  if (restockStore.items.length === 0) return 1
  if (restockStore.items.length > 0 && !restockStore.submitting) return 2
  return 3
})

onMounted(() => {
  restockStore.loadDraft()
})

async function handleBarcodeScan() {
  const code = barcodeInput.value.trim()
  if (!code) return

  scanError.value = ''
  try {
    const result = await restockStore.lookupBarcode(code)
    barcodeInput.value = ''

    if (result.type === 'variant' && result.variant) {
      const v = result.variant
      restockStore.addItem({
        variant_id: v.id,
        sku: v.sku,
        product_name: v.product?.name ?? 'Product',
        scanned_barcode: v.barcode || code,
        quantity: 1,
        unit_cost: parseFloat(String(v.cost_price)) || 0,
      })
    } else if (result.type === 'product' && result.variants && result.variants.length > 0) {
      if (result.variants.length === 1) {
        const v = result.variants[0]
        restockStore.addItem({
          variant_id: v.id,
          sku: v.sku,
          product_name: result.product?.name ?? 'Product',
          scanned_barcode: v.barcode || code,
          quantity: 1,
          unit_cost: parseFloat(String(v.cost_price || result.product?.purchase_price)) || 0,
        })
      } else {
        // Open variant picker modal
        multiVariantProduct.value = result
        showVariantPicker.value = true
      }
    } else {
      scanError.value = 'No matching product or variant found for code.'
    }
  } catch (e: unknown) {
    scanError.value = e instanceof Error ? e.message : 'Failed to lookup barcode.'
  }
}

function selectVariantFromModal(variant: {
  id: string
  sku: string
  barcode: string | null
  cost_price: number | string
}) {
  if (!multiVariantProduct.value?.product) return

  restockStore.addItem({
    variant_id: variant.id,
    sku: variant.sku,
    product_name: multiVariantProduct.value.product.name,
    scanned_barcode: variant.barcode || multiVariantProduct.value.product.barcode,
    quantity: 1,
    unit_cost: parseFloat(String(variant.cost_price || multiVariantProduct.value.product.purchase_price)) || 0,
  })

  showVariantPicker.value = false
  multiVariantProduct.value = null
}

function closeVariantPicker() {
  showVariantPicker.value = false
  multiVariantProduct.value = null
}

async function handleCompleteSession() {
  successMessage.value = ''
  scanError.value = ''
  try {
    await restockStore.commitRestock()
    successMessage.value = 'Restock batch committed successfully! Inventory updated.'
    setTimeout(() => {
      router.push('/inventory')
    }, 1200)
  } catch (e: unknown) {
    scanError.value = e instanceof Error ? e.message : 'Failed to commit restock.'
  }
}

function promptDiscardDraft() {
  discardConfirm.value = true
}

function executeDiscardDraft() {
  restockStore.clearDraft()
  discardConfirm.value = false
}

function fmtMoney(amount: number): string {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
</script>

<template>
  <div class="flex flex-col gap-6 max-w-5xl mx-auto w-full">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-3">
          <h1 class="text-2xl sm:text-3xl font-display font-bold text-foreground tracking-tight">Restock Intake Batch</h1>
          <Badge variant="warning" class="font-mono text-xs px-2.5 py-0.5 font-bold">
            DRAFT INTAKE
          </Badge>
          <Badge v-if="restockStore.items.length > 0" variant="info" class="font-mono text-xs px-2.5 py-0.5">
            {{ restockStore.totals.lineCount }} Lines / {{ restockStore.totals.totalUnits }} Units
          </Badge>
        </div>
        <p class="text-xs text-muted-foreground mt-0.5">
          Scan physical supplier items, adjust unit intake costs, and commit atomic stock updates to the ledger.
        </p>
      </div>

      <div class="flex items-center gap-2">
        <Button
          v-if="restockStore.items.length > 0"
          id="btn-discard-draft"
          variant="ghost"
          size="sm"
          class="text-destructive hover:bg-destructive/10 text-xs"
          @click="promptDiscardDraft"
        >
          Discard Draft
        </Button>

        <RouterLink to="/inventory">
          <Button variant="outline" size="sm" class="h-9 px-3 gap-1.5 text-xs">
            <ArrowLeft :size="14" />
            <span>Back to Ledger</span>
          </Button>
        </RouterLink>
      </div>
    </div>

    <!-- Stepper Workflow Header -->
    <div class="rounded-xl border border-border bg-card p-4 shadow-xs">
      <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div
          class="flex items-center gap-3 p-2 rounded-lg transition-colors flex-1"
          :class="activeStep === 1 ? 'bg-primary/10 text-primary font-semibold' : 'text-muted-foreground'"
        >
          <div
            class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold font-mono"
            :class="restockStore.items.length > 0 ? 'bg-success text-success-foreground' : activeStep === 1 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'"
          >
            <Check v-if="restockStore.items.length > 0" :size="14" />
            <span v-else>1</span>
          </div>
          <div>
            <div class="text-xs font-bold text-foreground">Scan / Enter Barcode</div>
            <div class="text-[11px] text-muted-foreground">Lookup master SKU or variant</div>
          </div>
        </div>

        <div class="hidden sm:block w-8 h-px bg-border flex-shrink-0" />

        <div
          class="flex items-center gap-3 p-2 rounded-lg transition-colors flex-1"
          :class="activeStep === 2 ? 'bg-primary/10 text-primary font-semibold' : 'text-muted-foreground'"
        >
          <div
            class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold font-mono"
            :class="restockStore.items.length > 0 ? 'bg-success text-success-foreground' : activeStep === 2 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'"
          >
            <Check v-if="restockStore.items.length > 0" :size="14" />
            <span v-else>2</span>
          </div>
          <div>
            <div class="text-xs font-bold text-foreground">Verify Quantities & Costs</div>
            <div class="text-[11px] text-muted-foreground">Adjust intake wholesale pricing</div>
          </div>
        </div>

        <div class="hidden sm:block w-8 h-px bg-border flex-shrink-0" />

        <div
          class="flex items-center gap-3 p-2 rounded-lg transition-colors flex-1"
          :class="activeStep === 3 ? 'bg-primary/10 text-primary font-semibold' : 'text-muted-foreground'"
        >
          <div
            class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold font-mono"
            :class="activeStep === 3 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'"
          >
            <span>3</span>
          </div>
          <div>
            <div class="text-xs font-bold text-foreground">Review & Commit</div>
            <div class="text-[11px] text-muted-foreground">Record stock movements</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Restored Draft Notice -->
    <Alert v-if="restockStore.isDraftLoaded" variant="info">
      <div class="flex items-center gap-2">
        <Info :size="15" class="flex-shrink-0" />
        <span>Restored saved draft session from local browser storage.</span>
      </div>
    </Alert>

    <!-- Alert Notifications -->
    <Alert v-if="scanError || restockStore.error" variant="error">
      <div class="flex items-center gap-2">
        <AlertCircle :size="16" class="flex-shrink-0" />
        <span>{{ scanError || restockStore.error }}</span>
      </div>
    </Alert>

    <Alert v-if="successMessage" variant="success">
      <div class="flex items-center gap-2">
        <Check :size="16" class="flex-shrink-0" />
        <span>{{ successMessage }}</span>
      </div>
    </Alert>

    <!-- Session Metadata Card -->
    <Card class="p-4">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label class="block text-xs font-semibold text-foreground mb-1">Session Intake Date *</label>
          <Input
            id="restock-date"
            v-model="restockStore.sessionDate"
            type="date"
            class="h-9 bg-surface text-sm font-mono"
            @change="restockStore.saveDraft"
          />
        </div>

        <div>
          <label class="block text-xs font-semibold text-foreground mb-1">Supplier / Invoice Notes</label>
          <Input
            id="restock-notes"
            v-model="restockStore.notes"
            type="text"
            placeholder="e.g. Supplier Invoice #INV-2026-088 — Alpha Apparel Ltd."
            class="h-9 bg-surface text-sm"
            @input="restockStore.saveDraft"
          />
        </div>
      </div>
    </Card>

    <!-- Scan Intake Bar -->
    <Card class="border-cta/30 bg-cta/5 p-5 flex flex-col gap-3">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2 text-cta font-bold font-display text-base">
          <Zap :size="18" />
          <span>Rapid Barcode Scanner & SKU Lookup</span>
        </div>
        <Badge variant="neutral" class="text-[11px]">Press Enter to Add</Badge>
      </div>

      <p class="text-xs text-muted-foreground">
        Scan physical barcodes with a USB/Bluetooth scanner gun or enter SKU codes manually.
      </p>

      <div class="flex gap-2.5">
        <Input
          id="restock-barcode-input"
          v-model="barcodeInput"
          type="text"
          placeholder="Scan barcode or enter SKU (e.g. 8859123456789 or PROD-M-BLU)…"
          class="h-10 bg-surface text-sm font-mono flex-1 border-cta/40 focus:border-cta"
          :disabled="restockStore.loading || restockStore.submitting"
          autofocus
          @keydown.enter.prevent="handleBarcodeScan"
        />
        <Button
          id="btn-scan-intake"
          variant="primary"
          class="h-10 px-5 gap-1.5 text-xs font-semibold"
          :disabled="!barcodeInput.trim() || restockStore.loading || restockStore.submitting"
          @click="handleBarcodeScan"
        >
          <span v-if="restockStore.loading" class="animate-spin mr-1">⏳</span>
          <ArrowDownToLine v-else :size="15" />
          <span>{{ restockStore.loading ? 'Looking up…' : '+ Add Item' }}</span>
        </Button>
      </div>
    </Card>

    <!-- Line Items Table Container -->
    <div class="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
      <div class="p-4 border-b border-border bg-surface-subtle/40 flex items-center justify-between">
        <div>
          <h2 class="font-display font-bold text-base text-foreground flex items-center gap-2">
            <span>Batch Intake Line Items</span>
            <Badge variant="info" class="font-mono text-xs">
              {{ restockStore.totals.lineCount }} items
            </Badge>
          </h2>
          <p class="text-[11px] text-muted-foreground mt-0.5">
            Verify unit intake cost and incoming quantity before committing.
          </p>
        </div>

        <div v-if="restockStore.items.length > 0" class="text-xs text-muted-foreground font-mono">
          Auto-saved to draft
        </div>
      </div>

      <EmptyState
        v-if="restockStore.items.length === 0"
        :icon="ArrowDownToLine"
        title="No items in this restock batch"
        description="Scan or enter a barcode above to add items to your restock intake session."
      />

      <div v-else class="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow class="bg-muted/40">
              <TableHead>Item / Variant SKU</TableHead>
              <TableHead>Barcode</TableHead>
              <TableHead class="w-32">Intake Qty</TableHead>
              <TableHead class="w-36">Unit Cost ($)</TableHead>
              <TableHead class="font-mono text-right w-32">Line Total</TableHead>
              <TableHead class="text-right w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="item in restockStore.items" :key="item.tempId" class="hover:bg-surface-subtle/80 transition-colors">
              <TableCell>
                <div class="font-semibold text-foreground">{{ item.product_name }}</div>
                <span class="font-mono text-xs text-primary">{{ item.sku }}</span>
              </TableCell>

              <TableCell class="font-mono text-xs">
                <span v-if="item.scanned_barcode" class="px-2 py-0.5 rounded bg-surface-subtle border border-border text-foreground">
                  {{ item.scanned_barcode }}
                </span>
                <span v-else class="text-muted-foreground">—</span>
              </TableCell>

              <TableCell>
                <Input
                  :id="`qty-input-${item.tempId}`"
                  type="number"
                  min="1"
                  :model-value="item.quantity"
                  class="h-8 w-24 bg-surface text-xs font-mono font-bold text-center"
                  @change="restockStore.updateItemQty(item.tempId, parseInt(($event.target as HTMLInputElement).value) || 1)"
                />
              </TableCell>

              <TableCell>
                <Input
                  :id="`cost-input-${item.tempId}`"
                  type="number"
                  step="0.01"
                  min="0"
                  :model-value="item.unit_cost"
                  class="h-8 w-28 bg-surface text-xs font-mono text-right"
                  @change="restockStore.updateItemCost(item.tempId, parseFloat(($event.target as HTMLInputElement).value) || 0)"
                />
              </TableCell>

              <TableCell class="font-mono text-sm font-bold text-foreground text-right tabular-nums">
                {{ fmtMoney(item.quantity * item.unit_cost) }}
              </TableCell>

              <TableCell class="text-right">
                <Button
                  :id="`btn-remove-item-${item.tempId}`"
                  variant="ghost"
                  size="sm"
                  class="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                  @click="restockStore.removeItem(item.tempId)"
                >
                  <Trash2 :size="13" />
                </Button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <!-- Totals & Commit Action Bar -->
      <div
        v-if="restockStore.items.length > 0"
        class="p-4 border-t border-border bg-surface-subtle/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4"
      >
        <div class="flex items-center gap-6 text-xs">
          <div>
            <span class="text-muted-foreground block text-[10px] uppercase font-semibold">Total Intake Units</span>
            <span class="font-display font-bold text-lg text-foreground tabular-nums">{{ restockStore.totals.totalUnits }} units</span>
          </div>

          <div>
            <span class="text-muted-foreground block text-[10px] uppercase font-semibold">Batch Investment</span>
            <span class="font-display font-bold text-lg text-primary tabular-nums">{{ fmtMoney(restockStore.totals.totalCost) }}</span>
          </div>
        </div>

        <Button
          id="btn-commit-restock"
          variant="primary"
          size="sm"
          class="h-10 px-6 gap-2 text-xs font-semibold"
          :disabled="restockStore.submitting || restockStore.items.length === 0"
          @click="handleCompleteSession"
        >
          <span v-if="restockStore.submitting" class="animate-spin mr-1">⏳</span>
          <Check v-else :size="15" />
          <span>{{ restockStore.submitting ? 'Committing Batch to Ledger…' : 'Complete Restock Intake' }}</span>
        </Button>
      </div>
    </div>

    <!-- Variant Picker Modal for Master Barcode Scan -->
    <Dialog :open="showVariantPicker && !!multiVariantProduct" @update:open="(val) => { if (!val) closeVariantPicker(); }">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle class="font-display">Select Variant to Intake</DialogTitle>
          <DialogDescription>
            Product: <strong>{{ multiVariantProduct?.product?.name }}</strong>
          </DialogDescription>
        </DialogHeader>

        <div class="flex flex-col gap-2.5 py-2">
          <div
            v-for="v in (multiVariantProduct?.variants || [])"
            :key="v.id"
            class="p-3 rounded-lg border border-border bg-surface hover:bg-surface-subtle hover:border-primary/40 flex items-center justify-between cursor-pointer transition-all"
            @click="selectVariantFromModal(v)"
          >
            <div>
              <div class="font-semibold text-xs text-foreground font-mono">{{ v.sku }}</div>
              <div class="text-[11px] text-muted-foreground">Current Stock: {{ v.quantity_on_hand }} units</div>
            </div>
            <Button variant="outline" size="sm" class="h-7 text-xs">+ Select</Button>
          </div>
        </div>

        <DialogFooter class="mt-4">
          <Button variant="outline" @click="closeVariantPicker">Cancel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Discard Draft Confirmation Modal -->
    <Dialog :open="discardConfirm" @update:open="(val) => discardConfirm = val">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle class="text-destructive font-display">Discard Restock Draft?</DialogTitle>
          <DialogDescription>
            Are you sure you want to discard all {{ restockStore.items.length }} line items in this draft session? This will clear local draft storage.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter class="gap-2 sm:gap-0 mt-4">
          <Button variant="outline" @click="discardConfirm = false">Keep Editing</Button>
          <Button id="btn-confirm-discard-draft" variant="destructive" @click="executeDiscardDraft">
            Discard Session
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
