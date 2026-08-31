<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import {
  Printer,
  RotateCcw,
  X,
  CheckCircle2,
  Receipt,
} from 'lucide-vue-next'
import { usePrintStore } from '@/stores/printStore'

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
  created_at?: string
  items?: OrderItem[]
  subtotal?: number | string
  discount?: number | string
  discount_value?: number | string
  tax_amount?: number | string
  tax_rate?: number | string
  delivery_fee?: number | string
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
  notes?: string | null
}

interface Props {
  open: boolean
  order: OrderData | null
  storeName?: string
  storeTagline?: string
  storePhone?: string
  storeAddress?: string
}

const props = withDefaults(defineProps<Props>(), {
  open: false,
  storeName: 'KC Inventory & Retail',
  storeTagline: 'Omnichannel Point of Sale',
  storePhone: '+1 (555) 019-2834',
  storeAddress: '742 Evergreen Terrace, Suite 100',
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
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
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
      class="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
      @click="close"
    />

    <!-- Modal Container -->
    <div
      class="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-[#E8E2D9] overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in-0 zoom-in-95 duration-150"
    >
      <!-- Top Action Bar -->
      <div class="px-5 py-3.5 bg-[#FAF7F2] border-b border-[#E8E2D9] flex items-center justify-between">
        <div class="flex items-center gap-2 text-emerald-700 font-semibold text-sm">
          <CheckCircle2 class="w-5 h-5 text-emerald-600" />
          <span>Payment Successful</span>
        </div>

        <button
          type="button"
          @click="close"
          class="p-1.5 rounded-lg text-[#6B6358] hover:text-[#1A1C1C] hover:bg-[#F0EAE1] transition-colors"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Thermal Receipt Preview Scroll Area -->
      <div class="p-6 overflow-y-auto bg-[#F4EFE6] flex justify-center">
        <!-- Thermal Receipt Paper (80mm Simulation) -->
        <div
          id="pos-thermal-receipt"
          class="w-full max-w-[340px] bg-white text-[#1A1C1C] px-5 py-6 rounded-md shadow-md border border-[#E8E2D9] font-mono text-xs select-text"
        >
          <!-- Receipt Header -->
          <div class="text-center pb-4 border-b border-dashed border-[#D5CCC0] space-y-1">
            <div class="w-8 h-8 mx-auto rounded-full bg-[#924C00]/10 flex items-center justify-center text-[#924C00] font-bold text-sm mb-1">
              <Receipt class="w-4 h-4 text-[#924C00]" />
            </div>
            <h2 class="text-sm font-bold tracking-tight text-[#1A1C1C] uppercase font-display">
              {{ storeName }}
            </h2>
            <p class="text-2xs text-[#6B6358]">{{ storeTagline }}</p>
            <p class="text-2xs text-[#6B6358]">{{ storeAddress }}</p>
            <p class="text-2xs text-[#6B6358]">Tel: {{ storePhone }}</p>
          </div>

          <!-- Transaction Metadata -->
          <div class="py-3 border-b border-dashed border-[#D5CCC0] space-y-1 text-2xs text-[#574335]">
            <div class="flex justify-between">
              <span>Receipt #:</span>
              <span class="font-bold text-[#1A1C1C]">{{ orderNumber }}</span>
            </div>
            <div class="flex justify-between">
              <span>Date:</span>
              <span>{{ formattedDate }}</span>
            </div>
            <div v-if="order.seller?.name" class="flex justify-between">
              <span>Cashier:</span>
              <span>{{ order.seller.name }}</span>
            </div>
            <div v-if="order.channel_name" class="flex justify-between">
              <span>Terminal:</span>
              <span>{{ order.channel_name }}</span>
            </div>
            <div v-if="customerDisplay?.name" class="flex justify-between pt-1 border-t border-[#F0EAE1]">
              <span>Customer:</span>
              <span class="font-semibold">{{ customerDisplay.name }} {{ customerDisplay.loyalty_tier ? `(${customerDisplay.loyalty_tier})` : '' }}</span>
            </div>
          </div>

          <!-- Items Table -->
          <div class="py-3 border-b border-dashed border-[#D5CCC0] space-y-2">
            <div class="flex justify-between font-bold text-2xs text-[#1A1C1C] uppercase">
              <span>Item / Qty</span>
              <span>Amount</span>
            </div>

            <div
              v-for="(item, idx) in order.items || []"
              :key="idx"
              class="space-y-0.5"
            >
              <div class="flex justify-between items-start text-xs">
                <span class="font-semibold text-[#1A1C1C] pr-2 break-words">
                  {{ item.product_name || item.name || 'Product' }}
                </span>
                <span class="font-bold shrink-0 font-mono">
                  {{ formatMoney(item.total_price || item.line_total || (Number(item.unit_price) * item.quantity)) }}
                </span>
              </div>
              <div class="flex justify-between text-2xs text-[#6B6358]">
                <span>{{ item.quantity }} × {{ formatMoney(item.unit_price) }}</span>
                <span v-if="item.discount && item.discount > 0" class="text-amber-800 font-semibold">
                  (-{{ item.discount }}%)
                </span>
              </div>
              <div v-if="item.variant_name" class="text-2xs text-[#8C827A] italic">
                {{ item.variant_name }}
              </div>
            </div>
          </div>

          <!-- Financial Summary -->
          <div class="py-3 border-b border-dashed border-[#D5CCC0] space-y-1.5 text-xs">
            <div class="flex justify-between text-[#574335]">
              <span>Subtotal:</span>
              <span>{{ formatMoney(order.subtotal) }}</span>
            </div>

            <div
              v-if="order.discount && Number(order.discount) > 0"
              class="flex justify-between text-amber-800"
            >
              <span>Order Discount:</span>
              <span>-{{ formatMoney(order.discount) }}</span>
            </div>

            <div
              v-if="order.tax_amount && Number(order.tax_amount) > 0"
              class="flex justify-between text-[#574335]"
            >
              <span>Tax ({{ order.tax_rate || 0 }}%):</span>
              <span>{{ formatMoney(order.tax_amount) }}</span>
            </div>

            <div
              v-if="order.delivery_fee && Number(order.delivery_fee) > 0"
              class="flex justify-between text-[#574335]"
            >
              <span>Delivery Fee:</span>
              <span>{{ formatMoney(order.delivery_fee) }}</span>
            </div>

            <div class="flex justify-between font-bold text-sm text-[#1A1C1C] pt-1.5 border-t border-[#D5CCC0]">
              <span class="font-display uppercase tracking-tight">Grand Total:</span>
              <span class="font-display font-black">{{ formatMoney(order.total_amount) }}</span>
            </div>
          </div>

          <!-- Payment Breakdown -->
          <div class="py-3 border-b border-dashed border-[#D5CCC0] space-y-1 text-2xs text-[#574335]">
            <div class="flex justify-between">
              <span>Paid via:</span>
              <span class="font-bold text-[#1A1C1C] uppercase">{{ order.payment_method || 'CASH' }}</span>
            </div>
            <template v-if="isCashPayment(order.payment_method)">
              <div v-if="order.tendered_amount && Number(order.tendered_amount) > 0" class="flex justify-between">
                <span>Tendered:</span>
                <span>{{ formatMoney(order.tendered_amount) }}</span>
              </div>
              <div v-if="order.change_amount && Number(order.change_amount) > 0" class="flex justify-between font-bold text-emerald-800">
                <span>Change Due:</span>
                <span>{{ formatMoney(order.change_amount) }}</span>
              </div>
            </template>
          </div>

          <!-- Barcode Footer Simulation -->
          <div class="pt-4 text-center space-y-2">
            <!-- Simulated 1D Barcode -->
            <div class="flex justify-center items-center h-10 gap-0.5 px-4 overflow-hidden">
              <span class="w-1 bg-black h-8"></span>
              <span class="w-0.5 bg-black h-8"></span>
              <span class="w-1.5 bg-black h-8"></span>
              <span class="w-0.5 bg-black h-8"></span>
              <span class="w-2 bg-black h-8"></span>
              <span class="w-1 bg-black h-8"></span>
              <span class="w-0.5 bg-black h-8"></span>
              <span class="w-1.5 bg-black h-8"></span>
              <span class="w-0.5 bg-black h-8"></span>
              <span class="w-2 bg-black h-8"></span>
              <span class="w-1 bg-black h-8"></span>
              <span class="w-0.5 bg-black h-8"></span>
              <span class="w-1 bg-black h-8"></span>
              <span class="w-2 bg-black h-8"></span>
              <span class="w-0.5 bg-black h-8"></span>
              <span class="w-1.5 bg-black h-8"></span>
            </div>
            <p class="text-2xs text-[#6B6358] tracking-widest">{{ orderNumber }}</p>
            <p class="text-2xs text-[#6B6358] italic pt-1">
              Thank you for your business!<br />
              Please keep this receipt for returns or exchanges.
            </p>
          </div>
        </div>
      </div>

      <!-- Action Footer -->
      <div class="px-6 py-4 bg-[#FAF7F2] border-t border-[#E8E2D9] flex items-center justify-between gap-3">
        <button
          type="button"
          @click="handlePrint"
          class="flex-1 py-2.5 px-4 rounded-xl border border-[#E8E2D9] bg-white text-[#1A1C1C] font-bold text-xs hover:bg-[#FAF7F2] transition-all flex items-center justify-center gap-2 shadow-2xs cursor-pointer active:scale-95"
        >
          <Printer class="w-4 h-4 text-[#924C00]" />
          <span>Print Receipt (⌘P)</span>
        </button>

        <button
          type="button"
          @click="handleNewSale"
          class="flex-1 py-2.5 px-4 rounded-xl bg-[#FF8800] text-white font-bold text-xs hover:bg-[#E67A00] transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer active:scale-95"
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
    width: 80mm;
    margin: 0;
    padding: 10px;
    box-shadow: none;
    border: none;
  }
}
</style>
