<script setup lang="ts">
import {
  X,
  Clock,
  Play,
  Trash2,
  User,
  ShoppingBag
} from 'lucide-vue-next'
import Badge from '@/components/ui/Badge.vue'
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
  <div v-if="open" class="fixed inset-0 z-100 flex items-center justify-center p-4">
    <!-- Backdrop -->
    <div
      class="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
      @click="close"
    />

    <!-- Dialog -->
    <div
      class="relative w-full max-w-xl rounded-2xl bg-card shadow-2xl border border-border overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in-0 zoom-in-95 duration-150 text-foreground"
    >
      <!-- Header -->
      <div class="px-5 py-3.5 bg-surface-subtle border-b border-border flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg bg-cta-muted border border-border-strong flex items-center justify-center text-primary shadow-2xs">
            <Clock class="w-4 h-4" />
          </div>
          <div>
            <h3 class="text-sm font-bold text-foreground font-display">Parked / Held Orders</h3>
            <p class="text-3xs text-muted-foreground">Resume or manage open transactions on hold</p>
          </div>
        </div>

        <button
          type="button"
          @click="close"
          class="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-subtle transition-colors cursor-pointer"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Orders List -->
      <div class="p-4 sm:p-5 overflow-y-auto space-y-2.5 flex-1 bg-background">
        <div
          v-if="heldOrders.length === 0"
          class="py-10 text-center text-muted-foreground space-y-1.5"
        >
          <ShoppingBag class="w-8 h-8 mx-auto text-primary/30" />
          <p class="text-xs font-bold text-foreground">No orders currently on hold</p>
          <p class="text-3xs">You can hold an active cart anytime using the Hold button or F3 key.</p>
        </div>

        <div
          v-for="order in heldOrders"
          :key="order.id"
          class="p-3 rounded-xl border border-border bg-card hover:border-cta transition-all flex items-center justify-between gap-3 group"
        >
          <!-- Order Details -->
          <div class="space-y-1 flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span class="text-xs font-bold text-foreground truncate">
                {{ order.name }}
              </span>
              <Badge variant="neutral" class="text-xs font-mono">
                {{ formatTime(order.timestamp) }}
              </Badge>
            </div>

            <div class="flex items-center gap-2.5 text-3xs text-muted-foreground">
              <span>{{ getItemCount(order) }} items</span>
              <span v-if="order.customer?.name" class="flex items-center gap-1 text-primary font-medium">
                <User class="w-3 h-3" />
                {{ order.customer.name }}
              </span>
            </div>

            <!-- Items snippet -->
            <p class="text-3xs text-muted-foreground font-mono truncate">
              {{ order.items.map(i => `${i.quantity}x ${i.name}`).join(', ') }}
            </p>
          </div>

          <!-- Total & Actions -->
          <div class="flex items-center gap-2.5 shrink-0">
            <div class="text-right">
              <div class="text-sm font-bold font-mono text-foreground">
                {{ formatMoney(getOrderTotal(order)) }}
              </div>
            </div>

            <button
              type="button"
              @click="() => { emit('resume', order.id); close(); }"
              class="h-7.5 px-3 rounded-lg bg-cta text-cta-foreground text-xs font-bold hover:brightness-110 transition-all shadow-2xs flex items-center gap-1 cursor-pointer active:scale-95"
            >
              <Play class="w-3 h-3 fill-current" />
              <span>Resume</span>
            </button>

            <button
              type="button"
              @click="emit('delete', order.id)"
              class="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
              title="Delete held order"
            >
              <Trash2 class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="px-5 py-2.5 bg-surface-subtle border-t border-border flex items-center justify-between text-xs text-muted-foreground">
        <span class="text-3xs">Total {{ heldOrders.length }} held order(s)</span>
        <button
          type="button"
          @click="close"
          class="font-semibold hover:text-foreground transition-colors cursor-pointer text-xs"
        >
          Close
        </button>
      </div>
    </div>
  </div>
</template>
