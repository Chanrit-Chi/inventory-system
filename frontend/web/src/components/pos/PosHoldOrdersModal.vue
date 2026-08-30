<script setup lang="ts">
import {
  X,
  Clock,
  Play,
  Trash2,
  User,
  ShoppingBag
} from 'lucide-vue-next'
import type { HeldOrder } from '@/stores/posStore'

interface Props {
  open: boolean
  heldOrders: HeldOrder[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'resume': [heldId: string]
  'delete': [heldId: string]
}>()

function formatMoney(val: number | string | null | undefined): string {
  if (val == null) return '$0.00'
  const num = typeof val === 'string' ? parseFloat(val) : val
  return isNaN(num) ? '$0.00' : `$${num.toFixed(2)}`
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function getOrderTotal(order: HeldOrder): number {
  const sub = order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0)
  let disc = 0
  if (order.discount_type === 'flat') disc = order.discount_value || 0
  else if (order.discount_type === 'percentage') disc = (sub * (order.discount_value || 0)) / 100
  const afterDisc = Math.max(0, sub - disc)
  const tax = (afterDisc * (order.tax_rate || 0)) / 100
  const fee = order.is_delivery ? (order.delivery_fee || 0) : 0
  return Math.max(0, afterDisc + tax + fee)
}

function getItemCount(order: HeldOrder): number {
  return order.items.reduce((sum, item) => sum + item.quantity, 0)
}

function close() {
  emit('update:open', false)
}
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <!-- Backdrop -->
    <div
      class="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
      @click="close"
    />

    <!-- Dialog -->
    <div
      class="relative w-full max-w-xl rounded-2xl bg-white shadow-2xl border border-[#E8E2D9] overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in-0 zoom-in-95 duration-150"
    >
      <!-- Header -->
      <div class="px-6 py-4 bg-[#FAF7F2] border-b border-[#E8E2D9] flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <div class="w-9 h-9 rounded-xl bg-[#FFF3E0] border border-[#FFDCC4] flex items-center justify-center text-[#924C00]">
            <Clock class="w-5 h-5" />
          </div>
          <div>
            <h3 class="text-base font-bold text-[#1A1C1C] font-display">Parked / Held Orders</h3>
            <p class="text-2xs text-[#6B6358]">Resume or manage open transactions on hold</p>
          </div>
        </div>

        <button
          type="button"
          @click="close"
          class="p-1.5 rounded-xl text-[#6B6358] hover:text-[#1A1C1C] hover:bg-[#F0EAE1] transition-colors"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Orders List -->
      <div class="p-6 overflow-y-auto space-y-3 flex-1">
        <div
          v-if="heldOrders.length === 0"
          class="py-12 text-center text-[#6B6358] space-y-2"
        >
          <ShoppingBag class="w-10 h-10 mx-auto text-[#924C00]/30" />
          <p class="text-sm font-semibold text-[#1A1C1C]">No orders currently on hold</p>
          <p class="text-xs">You can hold an active cart anytime using the Hold button or F3 key.</p>
        </div>

        <div
          v-for="order in heldOrders"
          :key="order.id"
          class="p-4 rounded-xl border border-[#E8E2D9] bg-[#FAF7F2] hover:border-[#FF8800] transition-all flex items-center justify-between gap-4 group"
        >
          <!-- Order Details -->
          <div class="space-y-1 flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span class="text-sm font-bold text-[#1A1C1C] truncate">
                {{ order.name }}
              </span>
              <span class="px-2 py-0.5 text-2xs font-semibold rounded-md bg-white border border-[#E8E2D9] text-[#6B6358] font-mono shrink-0">
                {{ formatTime(order.timestamp) }}
              </span>
            </div>

            <div class="flex items-center gap-3 text-xs text-[#6B6358]">
              <span>{{ getItemCount(order) }} items</span>
              <span v-if="order.customer?.name" class="flex items-center gap-1 text-[#924C00] font-medium">
                <User class="w-3 h-3" />
                {{ order.customer.name }}
              </span>
            </div>

            <!-- Items snippet -->
            <p class="text-2xs text-[#8C827A] truncate">
              {{ order.items.map(i => `${i.quantity}x ${i.name}`).join(', ') }}
            </p>
          </div>

          <!-- Total & Actions -->
          <div class="flex items-center gap-3 shrink-0">
            <div class="text-right">
              <div class="text-base font-bold font-display text-[#1A1C1C]">
                {{ formatMoney(getOrderTotal(order)) }}
              </div>
            </div>

            <button
              type="button"
              @click="() => { emit('resume', order.id); close(); }"
              class="px-3.5 py-2 rounded-xl bg-[#FF8800] text-[#1A1C1C] text-xs font-bold hover:bg-[#E67A00] transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <Play class="w-3.5 h-3.5 fill-current" />
              <span>Resume</span>
            </button>

            <button
              type="button"
              @click="emit('delete', order.id)"
              class="p-2 rounded-xl text-[#6B6358] hover:text-red-600 hover:bg-red-50 transition-colors"
              title="Delete held order"
            >
              <Trash2 class="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="px-6 py-3 bg-[#FAF7F2] border-t border-[#E8E2D9] flex items-center justify-between text-xs text-[#6B6358]">
        <span>Total {{ heldOrders.length }} held order(s)</span>
        <button
          type="button"
          @click="close"
          class="font-semibold hover:text-[#1A1C1C] transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  </div>
</template>
