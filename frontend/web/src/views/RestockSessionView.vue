<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useRestockStore, type RestockScanResult } from '@/stores/restockStore'

const router = useRouter()
const restockStore = useRestockStore()

const barcodeInput = ref('')
const scanError = ref('')
const successMessage = ref('')
const showVariantPicker = ref(false)
const multiVariantProduct = ref<RestockScanResult | null>(null)
const discardConfirm = ref(false)

// Active Stepper Step calculation based on session state
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
    successMessage.value = 'Restock session completed successfully! Stock levels updated.'
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
  <div class="flex-col gap-24" style="max-width: 1140px;">
    <!-- Header -->
    <div class="flex items-center justify-between" style="flex-wrap: wrap; gap: 16px;">
      <div>
        <div class="flex items-center gap-12">
          <h1 class="page-title" style="margin: 0;">Restock Intake Batch</h1>
          <span class="badge badge--yellow font-bold">DRAFT INTAKE</span>
          <span v-if="restockStore.items.length > 0" class="badge badge--blue tabular-nums">
            {{ restockStore.totals.lineCount }} Lines / {{ restockStore.totals.totalUnits }} Units
          </span>
        </div>
        <p class="text-muted text-sm mt-4">
          Scan supplier items, verify unit intake costs, and commit atomic stock updates to the ledger.
        </p>
      </div>

      <div class="flex items-center gap-12">
        <button
          v-if="restockStore.items.length > 0"
          id="btn-discard-draft"
          class="btn btn--ghost btn--sm"
          style="color: var(--action-destructive);"
          @click="promptDiscardDraft"
        >
          Discard Draft
        </button>

        <RouterLink to="/inventory" class="btn btn--ghost btn--sm">
          ← Back to Ledger
        </RouterLink>
      </div>
    </div>

    <!-- Stepper Workflow Header -->
    <section class="card" style="padding: 16px 24px;">
      <div class="stepper-nav">
        <div
          class="step-item"
          :class="{ 'step-item--active': activeStep === 1, 'step-item--done': restockStore.items.length > 0 }"
        >
          <div class="step-num">1</div>
          <div class="step-info">
            <div class="step-title">Scan / Enter Barcode</div>
            <div class="step-sub">Lookup master or variant SKU</div>
          </div>
        </div>

        <div class="step-divider"></div>

        <div
          class="step-item"
          :class="{ 'step-item--active': activeStep === 2, 'step-item--done': restockStore.items.length > 0 }"
        >
          <div class="step-num">2</div>
          <div class="step-info">
            <div class="step-title">Verify Quantities & Costs</div>
            <div class="step-sub">Adjust supplier intake costs</div>
          </div>
        </div>

        <div class="step-divider"></div>

        <div
          class="step-item"
          :class="{ 'step-item--active': activeStep === 3 }"
        >
          <div class="step-num">3</div>
          <div class="step-info">
            <div class="step-title">Review & Commit</div>
            <div class="step-sub">Record ledger transactions</div>
          </div>
        </div>
      </div>
    </section>

    <!-- Restored Draft Banner -->
    <div v-if="restockStore.isDraftLoaded" class="alert alert--info">
      <span>ℹ️ Restored draft session from local browser storage.</span>
    </div>

    <!-- Alert Notifications -->
    <div v-if="scanError || restockStore.error" class="alert alert--error">
      <span>⚠️ {{ scanError || restockStore.error }}</span>
    </div>

    <div v-if="successMessage" class="alert alert--success">
      <span>✓ {{ successMessage }}</span>
    </div>

    <!-- Session Metadata Card -->
    <section class="card">
      <div class="grid-2 gap-16">
        <div class="form-group">
          <label class="form-label">Session Intake Date *</label>
          <input
            id="restock-date"
            v-model="restockStore.sessionDate"
            type="date"
            @change="restockStore.saveDraft"
          />
        </div>

        <div class="form-group">
          <label class="form-label">Supplier / Invoice Notes</label>
          <input
            id="restock-notes"
            v-model="restockStore.notes"
            type="text"
            placeholder="e.g. Supplier Invoice #INV-2026-088 — Alpha Apparel Ltd."
            @input="restockStore.saveDraft"
          />
        </div>
      </div>
    </section>

    <!-- Scan Intake Bar -->
    <section class="card" style="background: linear-gradient(180deg, var(--surface-base) 0%, var(--surface-alt) 100%);">
      <div class="flex items-center justify-between mb-8">
        <div class="flex items-center gap-8">
          <div class="icon-badge icon-badge--sm icon-badge--primary">
            <span>⚡</span>
          </div>
          <h2 class="font-bold text-lg">Rapid Barcode Scanner & SKU Lookup</h2>
        </div>
        <span class="badge badge--neutral text-xs">Press Enter to Add</span>
      </div>

      <p class="text-muted text-sm mb-16">
        Scan physical barcodes with a USB/Bluetooth barcode gun or enter SKU codes manually.
      </p>

      <div class="flex gap-12">
        <div style="flex: 1;">
          <input
            id="restock-barcode-input"
            v-model="barcodeInput"
            type="text"
            placeholder="Scan barcode or enter SKU (e.g. 8859123456789 or PROD-M-BLU)…"
            :disabled="restockStore.loading || restockStore.submitting"
            autofocus
            @keydown.enter.prevent="handleBarcodeScan"
          />
        </div>

        <button
          id="btn-scan-intake"
          class="btn btn--primary"
          :disabled="!barcodeInput.trim() || restockStore.loading || restockStore.submitting"
          @click="handleBarcodeScan"
        >
          <span v-if="restockStore.loading" class="spinner"></span>
          {{ restockStore.loading ? 'Looking up…' : '+ Add Item' }}
        </button>
      </div>
    </section>

    <!-- Line Items Table -->
    <section class="card" style="padding: 0; overflow: hidden;">
      <div class="flex items-center justify-between" style="padding: 20px 24px; border-bottom: 1px solid var(--border-color);">
        <div>
          <h2 class="font-bold text-lg">
            Batch Intake Line Items
            <span class="badge badge--blue tabular-nums" style="margin-left: 8px;">
              {{ restockStore.totals.lineCount }} items
            </span>
          </h2>
          <p class="text-muted text-xs mt-2">
            Verify unit intake cost and incoming quantity before committing.
          </p>
        </div>

        <div v-if="restockStore.items.length > 0" class="flex items-center gap-16">
          <span class="text-xs text-muted">
            Auto-saved to draft
          </span>
        </div>
      </div>

      <div v-if="restockStore.items.length === 0" class="empty-state">
        <div class="empty-icon">📥</div>
        <h3 class="font-bold text-lg mb-8">No items in this restock batch</h3>
        <p class="text-muted">Scan or type a barcode above to add items to your restock intake session.</p>
      </div>

      <div v-else class="table-wrap" style="border: none; border-radius: 0; box-shadow: none;">
        <table>
          <thead>
            <tr>
              <th>Item / Variant SKU</th>
              <th>Scanned Barcode</th>
              <th style="width: 140px;">Intake Qty</th>
              <th style="width: 160px;">Unit Cost ($)</th>
              <th style="width: 140px; text-align: right;">Line Total</th>
              <th style="width: 60px;"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in restockStore.items" :key="item.tempId">
              <td>
                <div class="font-semibold">{{ item.product_name }}</div>
                <code class="tabular-nums text-xs" style="color: var(--action-primary); background-color: var(--surface-alt); padding: 2px 6px; border-radius: var(--radius-xs);">
                  {{ item.sku }}
                </code>
              </td>
              <td>
                <span v-if="item.scanned_barcode" class="tabular-nums text-xs" style="background-color: var(--surface-alt); padding: 2px 6px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
                  {{ item.scanned_barcode }}
                </span>
                <span v-else class="text-muted text-xs">—</span>
              </td>
              <td>
                <input
                  :id="`qty-input-${item.tempId}`"
                  type="number"
                  min="1"
                  :value="item.quantity"
                  class="tabular-nums font-bold"
                  style="width: 100px; padding: 6px 10px;"
                  @change="restockStore.updateItemQty(item.tempId, parseInt(($event.target as HTMLInputElement).value) || 1)"
                />
              </td>
              <td>
                <input
                  :id="`cost-input-${item.tempId}`"
                  type="number"
                  step="0.01"
                  min="0"
                  :value="item.unit_cost"
                  class="tabular-nums"
                  style="width: 120px; padding: 6px 10px;"
                  @change="restockStore.updateItemCost(item.tempId, parseFloat(($event.target as HTMLInputElement).value) || 0)"
                />
              </td>
              <td class="tabular-nums font-bold text-right" style="font-size: 14.5px; color: var(--action-primary);">
                {{ fmtMoney(item.quantity * item.unit_cost) }}
              </td>
              <td style="text-align: right;">
                <button
                  :id="`btn-remove-item-${item.tempId}`"
                  class="btn btn--ghost btn--sm"
                  style="color: var(--action-destructive); padding: 4px 8px;"
                  title="Remove Item"
                  @click="restockStore.removeItem(item.tempId)"
                >
                  ✕
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Totals & Commit Action Bar -->
      <div
        v-if="restockStore.items.length > 0"
        style="padding: 20px 24px; background-color: var(--surface-alt); border-top: 1px solid var(--border-color); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px;"
      >
        <div class="flex items-center gap-24">
          <div>
            <span class="text-xs text-muted block">Total Intake Units:</span>
            <span class="font-bold tabular-nums text-xl">{{ restockStore.totals.totalUnits }} units</span>
          </div>

          <div>
            <span class="text-xs text-muted block">Batch Total Investment:</span>
            <span class="font-bold tabular-nums text-xl" style="color: var(--action-primary);">
              {{ fmtMoney(restockStore.totals.totalCost) }}
            </span>
          </div>
        </div>

        <button
          id="btn-commit-restock"
          class="btn btn--primary btn--lg"
          :disabled="restockStore.submitting || restockStore.items.length === 0"
          @click="handleCompleteSession"
        >
          <span v-if="restockStore.submitting" class="spinner"></span>
          {{ restockStore.submitting ? 'Committing Batch to Ledger…' : '✓ Complete Restock Intake' }}
        </button>
      </div>
    </section>

    <!-- Variant Picker Modal for Master Barcode Scan -->
    <div v-if="showVariantPicker && multiVariantProduct" class="modal-backdrop" @click.self="closeVariantPicker">
      <div class="modal">
        <h2 class="modal-title">Select Variant to Intake</h2>
        <p class="text-muted text-sm mb-16">
          Product: <strong>{{ multiVariantProduct.product?.name }}</strong>
        </p>

        <div class="flex-col gap-8 mb-24">
          <div
            v-for="v in multiVariantProduct.variants"
            :key="v.id"
            style="border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; cursor: pointer; transition: all var(--transition); background-color: var(--surface-base);"
            class="card--interactive"
            @click="selectVariantFromModal(v)"
          >
            <div>
              <div class="font-semibold">{{ v.sku }}</div>
              <div class="text-xs text-muted">Stock on hand: {{ v.quantity_on_hand }} units</div>
            </div>

            <button class="btn btn--primary btn--sm">
              + Select
            </button>
          </div>
        </div>

        <div class="flex justify-end">
          <button class="btn btn--ghost" @click="closeVariantPicker">Cancel</button>
        </div>
      </div>
    </div>

    <!-- Discard Draft Confirmation Modal -->
    <div v-if="discardConfirm" class="modal-backdrop" @click.self="discardConfirm = false">
      <div class="modal">
        <h2 class="modal-title" style="color: var(--action-destructive);">Discard Restock Draft?</h2>
        <p class="mb-16 text-secondary">
          Are you sure you want to discard all {{ restockStore.items.length }} line items in this draft session? This action will clear local session storage.
        </p>
        <div class="flex justify-end gap-12">
          <button class="btn btn--ghost" @click="discardConfirm = false">Keep Editing</button>
          <button id="btn-confirm-discard-draft" class="btn btn--destructive" @click="executeDiscardDraft">
            Discard Session
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.stepper-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.step-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 12px;
  border-radius: var(--radius-md);
  flex: 1;
}

.step-item--active {
  background-color: var(--action-primary-bg);
}

.step-num {
  width: 28px;
  height: 28px;
  border-radius: var(--radius-full);
  background-color: var(--surface-alt);
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  font-weight: 700;
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.step-item--active .step-num {
  background-color: var(--action-primary);
  border-color: var(--action-primary);
  color: #ffffff;
}

.step-item--done .step-num {
  background-color: var(--status-success);
  border-color: var(--status-success);
  color: #ffffff;
}

.step-info {
  display: flex;
  flex-direction: column;
}

.step-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.step-sub {
  font-size: 11px;
  color: var(--text-muted);
}

.step-divider {
  width: 32px;
  height: 1px;
  background-color: var(--border-color);
  flex-shrink: 0;
}
</style>
