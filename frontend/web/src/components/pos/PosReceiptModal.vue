<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import {
  Printer,
  RotateCcw,
  X,
  CheckCircle2,
  Receipt,
  Bike,
} from 'lucide-vue-next'
import { usePrintStore } from '@/stores/printStore'
import { getTierDetails } from '@/utils/loyalty'
import Badge from '@/components/ui/Badge.vue'
import SocialPlatformIcon, { getPlatformMeta } from './SocialPlatformIcon.vue'

interface OrderItem {
  id?: string
  product_name?: string
  name?: string
  variant_name?: string
  sku?: string
  quantity: number
  unit_price: number | string
  total_price?: number | string
  line_total?: number | string
  discount?: number
}

interface OrderData {
  id?: string
  order_number?: string
  order_id?: string
  invoice_number?: string
  channel_id?: string
  channel_name?: string
  channel_platform?: string
  created_at?: string
  items?: OrderItem[]
  subtotal?: number | string
  discount?: number | string
  discount_value?: number | string
  tax_amount?: number | string
  tax_rate?: number | string
  delivery_fee?: number | string
  delivery_company?: string | null
  delivery_address?: string | null
  total_amount?: number | string
  payment_method?: string
  tendered_amount?: number | string
  change_amount?: number | string
  customer_info?: {
    name?: string | null
    phone?: string | null
    email?: string | null
    loyalty_tier?: string | null
  }
  customer?: {
    name?: string | null
    phone?: string | null
    email?: string | null
    loyalty_tier?: string | null
  }
  seller?: {
    name?: string | null
    role?: string | null
  }
  cashier?: {
    name?: string | null
    role?: string | null
  }
  notes?: string | null
}

interface Props {
  open: boolean
  order: OrderData | null
  storeName?: string
  storeTagline?: string
  storePhone?: string
  storeAddress?: string
  receiptHeader?: string
  footerMessage?: string
}

const props = withDefaults(defineProps<Props>(), {
  open: false,
  storeName: 'KC Shop',
  storeTagline: 'Official Omnichannel Retail Store',
  storePhone: '+855 (0) 12 345 678',
  storeAddress: 'Phnom Penh, Cambodia',
  receiptHeader: 'Official Digital Tax Receipt',
  footerMessage: 'Thank you for shopping with us! Please keep this receipt for returns or exchanges within 7 days.',
})

const emit = defineEmits<{
  'update:open': [value: boolean]
  'new-sale': []
}>()

const printStore = usePrintStore()

const orderNumber = computed(() => {
  if (!props.order) return 'ORD-00000'
  return props.order.order_number || props.order.invoice_number || props.order.id || 'ORD-00000'
})

const formattedDate = computed(() => {
  const date = props.order?.created_at ? new Date(props.order.created_at) : new Date()
  return date.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
})

function formatMoney(val: number | string | null | undefined): string {
  if (val == null) return '$0.00'
  const num = typeof val === 'string' ? parseFloat(val) : val
  return isNaN(num) ? '$0.00' : `$${num.toFixed(2)}`
}

const customerDisplay = computed(() => {
  return props.order?.customer_info || props.order?.customer
})

const channelMeta = computed(() => {
  return getPlatformMeta(props.order?.channel_platform, props.order?.channel_name)
})

function isCashPayment(method: string | null | undefined): boolean {
  if (!method) return true
  const m = method.toLowerCase()
  return m.includes('cash') || m.includes('drawer') || m.includes('register')
}

async function handlePrint() {
  if (props.order?.id) {
    try {
      await printStore.printReceipt(props.order.id)
    } catch {
      window.print()
    }
  } else {
    window.print()
  }
}

function handleNewSale() {
  emit('update:open', false)
  emit('new-sale')
}

function close() {
  emit('update:open', false)
}

function handleKeydown(e: KeyboardEvent) {
  if (!props.open) return
  if (e.key === 'Escape') {
    e.preventDefault()
    close()
  } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
    e.preventDefault()
    handlePrint()
  } else if (e.key === ' ' && (e.target as HTMLElement)?.tagName !== 'INPUT') {
    e.preventDefault()
    handleNewSale()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div v-if="open && order" class="fixed inset-0 z-100 flex items-center justify-center p-4">
    <!-- Backdrop -->
    <div
      class="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
      @click="close"
    />

    <!-- Modal Container -->
    <div
      class="relative w-full max-w-lg rounded-2xl bg-card shadow-2xl border border-border overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in-0 zoom-in-95 duration-150 text-foreground"
    >
      <!-- Top Action Bar -->
      <div class="px-5 py-3.5 bg-surface-subtle border-b border-border flex items-center justify-between">
        <div class="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold text-sm">
          <CheckCircle2 class="w-5 h-5 text-emerald-500" />
          <span>Payment Successful</span>
        </div>

        <button
          type="button"
          @click="close"
          class="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-subtle transition-colors cursor-pointer"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Thermal Receipt Preview Scroll Area -->
      <div class="p-6 overflow-y-auto bg-background/80 flex justify-center min-h-0 flex-1">
        <!-- Thermal Receipt Paper (80mm Simulation & Dynamic Height) -->
        <div
          id="pos-thermal-receipt"
          class="relative w-full max-w-[360px] bg-card text-foreground px-5 py-6 rounded-xl shadow-lg border border-border font-mono text-xs select-text h-auto min-h-fit"
        >
          <!-- Brand Header -->
          <div class="text-center pb-4 space-y-1">
            <div class="w-9 h-9 mx-auto rounded-full bg-cta-muted border border-border-strong flex items-center justify-center text-primary font-bold text-sm mb-1.5 shadow-2xs">
              <Receipt class="w-4.5 h-4.5 text-primary" />
            </div>
            <h2 class="text-base font-bold tracking-tight text-foreground uppercase font-display">
              {{ storeName }}
            </h2>
            <p class="text-2xs font-semibold text-primary uppercase tracking-wider">{{ receiptHeader }}</p>
            <p v-if="storeAddress || storePhone" class="text-3xs text-muted-foreground pt-0.5">
              {{ [storeAddress, storePhone].filter(Boolean).join(' • ') }}
            </p>
          </div>

          <!-- Top Tear Line with Notches -->
          <div class="relative my-2.5 -mx-5 flex items-center justify-between">
            <div class="w-3.5 h-3.5 rounded-r-full bg-background border-r border-t border-b border-border/70 shrink-0"></div>
            <div class="flex-1 border-b border-dashed border-border mx-2"></div>
            <div class="w-3.5 h-3.5 rounded-l-full bg-background border-l border-t border-b border-border/70 shrink-0"></div>
          </div>

          <!-- Transaction & Channel Metadata -->
          <div class="py-2 space-y-1.5 text-2xs text-muted-foreground">
            <!-- Sales Channel Platform Pill with Real Vector Logo -->
            <div class="flex items-center justify-between">
              <span class="text-muted-foreground">Sales Channel:</span>
              <div
                class="px-2 py-0.5 rounded-md flex items-center gap-1.5 font-bold text-[10px] border"
                :style="{
                  backgroundColor: channelMeta.badgeBg,
                  borderColor: channelMeta.border,
                  color: channelMeta.badgeText,
                }"
              >
                <SocialPlatformIcon :platform="order.channel_platform" :name="order.channel_name" :size="12" />
                <span>{{ order.channel_name || channelMeta.label }}</span>
                <span v-if="order.channel_name && order.channel_name.toLowerCase() !== channelMeta.label.toLowerCase()" class="opacity-70 font-mono text-[9px]">
                  ({{ channelMeta.label }})
                </span>
              </div>
            </div>

            <div class="flex justify-between">
              <span class="text-muted-foreground">Order Number:</span>
              <span class="font-bold text-foreground">{{ orderNumber }}</span>
            </div>

            <div class="flex justify-between">
              <span class="text-muted-foreground">Date & Time:</span>
              <span>{{ formattedDate }}</span>
            </div>

            <div v-if="order.seller?.name" class="flex justify-between">
              <span class="text-muted-foreground">Sold By:</span>
              <span class="font-semibold text-foreground">{{ order.seller.name }}</span>
            </div>

            <div v-if="order.cashier?.name && order.cashier.name !== order.seller?.name" class="flex justify-between">
              <span class="text-muted-foreground">Cashier:</span>
              <span class="font-semibold text-foreground">{{ order.cashier.name }}</span>
            </div>
          </div>

          <!-- Bill To / Customer & Delivery Card -->
          <div v-if="customerDisplay?.name || order.delivery_address" class="mt-2 pt-2.5 border-t border-dashed border-border space-y-1 text-2xs text-muted-foreground">
            <div class="text-[9px] uppercase font-bold text-muted-foreground tracking-wider">Bill To</div>
            <div v-if="customerDisplay?.name" class="font-bold text-xs text-foreground flex items-center gap-1.5">
              <span>{{ customerDisplay.name }}</span>
              <Badge
                v-if="customerDisplay.loyalty_tier"
                :variant="getTierDetails(customerDisplay.loyalty_tier).variant"
                class="text-xs font-mono font-semibold"
              >
                {{ customerDisplay.loyalty_tier }}
              </Badge>
            </div>
            <div v-if="customerDisplay?.phone" class="text-muted-foreground font-mono">
              {{ customerDisplay.phone }}
            </div>

            <!-- Delivery Fulfillment Badge -->
            <div v-if="order.delivery_address || order.delivery_company" class="mt-1.5 p-2 rounded-lg bg-surface-subtle border border-border space-y-0.5">
              <div class="flex items-center gap-1.5 text-primary font-bold text-[10px]">
                <Bike class="w-3 h-3 shrink-0" />
                <span>{{ order.delivery_company || 'Delivery' }}</span>
              </div>
              <p v-if="order.delivery_address" class="text-3xs text-muted-foreground leading-tight break-words">
                {{ order.delivery_address }}
              </p>
            </div>
          </div>

          <!-- Middle Tear Line with Notches -->
          <div class="relative my-2.5 -mx-5 flex items-center justify-between">
            <div class="w-3.5 h-3.5 rounded-r-full bg-background border-r border-t border-b border-border/70 shrink-0"></div>
            <div class="flex-1 border-b border-dashed border-border mx-2"></div>
            <div class="w-3.5 h-3.5 rounded-l-full bg-background border-l border-t border-b border-border/70 shrink-0"></div>
          </div>

          <!-- Items Table -->
          <div class="py-1 space-y-2">
            <div class="flex justify-between font-bold text-[10px] text-foreground uppercase tracking-wider pb-1 border-b border-border">
              <span>Item Description</span>
              <span>Total</span>
            </div>

            <div
              v-for="(item, idx) in order.items || []"
              :key="idx"
              class="space-y-0.5"
            >
              <div class="flex justify-between items-start text-xs">
                <span class="font-semibold text-foreground pr-2 break-words leading-snug">
                  {{ item.product_name || item.name || 'Product' }}
                </span>
                <span class="font-bold shrink-0 font-mono">
                  {{ formatMoney(item.total_price || item.line_total || (Number(item.unit_price) * item.quantity)) }}
                </span>
              </div>
              <div class="flex justify-between text-2xs text-muted-foreground">
                <span>
                  <span v-if="item.sku">{{ item.sku }} • </span>
                  {{ item.quantity }} × {{ formatMoney(item.unit_price) }}
                </span>
                <span v-if="item.discount && item.discount > 0" class="text-emerald-600 dark:text-emerald-400 font-semibold">
                  (-{{ item.discount }}%)
                </span>
              </div>
              <div v-if="item.variant_name" class="text-2xs text-primary italic">
                {{ item.variant_name }}
              </div>
            </div>
          </div>

          <!-- Bottom Tear Line with Notches -->
          <div class="relative my-2.5 -mx-5 flex items-center justify-between">
            <div class="w-3.5 h-3.5 rounded-r-full bg-background border-r border-t border-b border-border/70 shrink-0"></div>
            <div class="flex-1 border-b border-dashed border-border mx-2"></div>
            <div class="w-3.5 h-3.5 rounded-l-full bg-background border-l border-t border-b border-border/70 shrink-0"></div>
          </div>

          <!-- Financial Breakdown -->
          <div class="py-1 space-y-1.5 text-xs">
            <div class="flex justify-between text-muted-foreground">
              <span>Subtotal:</span>
              <span class="font-mono text-foreground">{{ formatMoney(order.subtotal) }}</span>
            </div>

            <div
              v-if="order.discount && Number(order.discount) > 0"
              class="flex justify-between text-amber-700 dark:text-amber-400 font-medium"
            >
              <span>Discount:</span>
              <span class="font-mono font-semibold">-{{ formatMoney(order.discount) }}</span>
            </div>

            <div
              v-if="order.delivery_fee && Number(order.delivery_fee) > 0"
              class="flex justify-between text-muted-foreground"
            >
              <span>Delivery Fee{{ order.delivery_company ? ` (${order.delivery_company})` : '' }}:</span>
              <span class="font-mono text-foreground">+{{ formatMoney(order.delivery_fee) }}</span>
            </div>

            <div
              v-if="order.tax_amount && Number(order.tax_amount) > 0"
              class="flex justify-between text-muted-foreground"
            >
              <span>Tax ({{ order.tax_rate || 0 }}%):</span>
              <span class="font-mono text-foreground">+{{ formatMoney(order.tax_amount) }}</span>
            </div>

            <!-- Grand Total Highlight Box (Matching Mobile) -->
            <div class="mt-2 p-2.5 rounded-xl bg-surface-subtle border border-border flex items-center justify-between">
              <div>
                <span class="text-xs font-bold font-display uppercase tracking-tight text-foreground block">Total Paid</span>
                <span class="text-[10px] text-muted-foreground block">Authorized via {{ order.payment_method || 'Cash' }}</span>
              </div>
              <span class="text-base font-bold font-mono font-display text-primary">
                {{ formatMoney(order.total_amount) }}
              </span>
            </div>
          </div>

          <!-- Cash Payment Details (Tendered & Change) -->
          <div v-if="isCashPayment(order.payment_method) && (order.tendered_amount || order.change_amount)" class="mt-2 pt-2 border-t border-dashed border-border space-y-1 text-2xs text-muted-foreground">
            <div v-if="order.tendered_amount && Number(order.tendered_amount) > 0" class="flex justify-between">
              <span class="text-muted-foreground">Amount Tendered:</span>
              <span class="font-mono font-semibold text-foreground">{{ formatMoney(order.tendered_amount) }}</span>
            </div>
            <div v-if="order.change_amount && Number(order.change_amount) > 0" class="flex justify-between font-bold text-emerald-600 dark:text-emerald-400">
              <span>Change Due:</span>
              <span class="font-mono">{{ formatMoney(order.change_amount) }}</span>
            </div>
          </div>

          <!-- Barcode & Footer Section -->
          <div class="pt-4 text-center space-y-2 border-t border-dashed border-border mt-3">
            <!-- Simulated 1D Barcode Graphic -->
            <div class="flex justify-center items-center h-9 gap-0.5 px-4 overflow-hidden dark:invert">
              <span class="w-1 bg-black h-7"></span>
              <span class="w-0.5 bg-black h-7"></span>
              <span class="w-1.5 bg-black h-7"></span>
              <span class="w-0.5 bg-black h-7"></span>
              <span class="w-2 bg-black h-7"></span>
              <span class="w-1 bg-black h-7"></span>
              <span class="w-0.5 bg-black h-7"></span>
              <span class="w-1.5 bg-black h-7"></span>
              <span class="w-0.5 bg-black h-7"></span>
              <span class="w-2 bg-black h-7"></span>
              <span class="w-1 bg-black h-7"></span>
              <span class="w-0.5 bg-black h-7"></span>
              <span class="w-1.5 bg-black h-7"></span>
              <span class="w-2 bg-black h-7"></span>
              <span class="w-0.5 bg-black h-7"></span>
              <span class="w-1.5 bg-black h-7"></span>
            </div>
            <p class="text-3xs font-mono text-muted-foreground tracking-widest">{{ orderNumber }}</p>
            <p class="text-3xs text-muted-foreground leading-tight pt-0.5">
              {{ footerMessage }}
            </p>
          </div>
        </div>
      </div>

      <!-- Action Footer -->
      <div class="px-6 py-4 bg-surface-subtle border-t border-border flex items-center justify-between gap-3">
        <button
          type="button"
          @click="handlePrint"
          class="flex-1 py-2.5 px-4 rounded-xl border border-border bg-card text-foreground font-bold text-xs hover:bg-surface-subtle transition-all flex items-center justify-center gap-2 shadow-2xs cursor-pointer active:scale-95"
        >
          <Printer class="w-4 h-4 text-primary" />
          <span>Print Receipt (⌘P)</span>
        </button>

        <button
          type="button"
          @click="handleNewSale"
          class="flex-1 py-2.5 px-4 rounded-xl bg-cta text-cta-foreground font-bold text-xs hover:brightness-110 transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer active:scale-95"
        >
          <RotateCcw class="w-4 h-4 stroke-[2.5]" />
          <span>New Sale (Space)</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
@media print {
  @page {
    size: 80mm auto;
    margin: 0;
  }
  html, body {
    margin: 0 !important;
    padding: 0 !important;
    background: #ffffff !important;
    height: auto !important;
    min-height: 100% !important;
  }
  body * {
    visibility: hidden;
  }
  #pos-thermal-receipt,
  #pos-thermal-receipt * {
    visibility: visible;
  }
  #pos-thermal-receipt {
    position: absolute;
    left: 0;
    top: 0;
    width: 80mm !important;
    max-width: 80mm !important;
    height: auto !important;
    min-height: auto !important;
    margin: 0 !important;
    padding: 16px !important;
    box-shadow: none !important;
    border: none !important;
    border-radius: 0 !important;
    background: #ffffff !important;
    overflow: visible !important;
  }
}
</style>
