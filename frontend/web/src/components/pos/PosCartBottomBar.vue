<script setup lang="ts">
import { computed } from 'vue'
import { X, ShoppingCart, Minus, Plus, ChevronUp, ChevronDown } from 'lucide-vue-next'

interface CartItem {
  id: string
  product_id: string
  product_name: string
  sku: string
  quantity: number
  unit_price: number
  lineTotal: number
}

interface Props {
  items: CartItem[]
  subtotal: number
  total: number
  itemCount: number
  totalItems?: number
  cartOpen: boolean
}

const props = withDefaults(defineProps<Props>(), {
  totalItems: 0,
})

const emit = defineEmits<{
  'update:qty': [itemId: string, quantity: number]
  remove: [itemId: string]
  checkout: []
  'update:cart-open': [open: boolean]
}>()

const formatMoney = (amount: number): string => {
  return `$${amount.toFixed(2)}`
}

const incrementQty = (item: CartItem) => {
  emit('update:qty', item.id, item.quantity + 1)
}

const decrementQty = (item: CartItem) => {
  emit('update:qty', item.id, item.quantity - 1)
}

const removeItem = (itemId: string) => {
  emit('remove', itemId)
}

const toggleCart = () => {
  emit('update:cart-open', !props.cartOpen)
}

const handleCheckout = () => {
  if (props.items.length === 0) return
  emit('checkout')
}

const isEmpty = computed(() => props.items.length === 0)
</script>

<template>
  <div class="pos-cart" :class="{ 'cart-collapsed': !cartOpen }">
    <div class="cart-header" @click="toggleCart">
      <div class="cart-header-left">
        <ShoppingCart :size="18" />
        <span class="cart-title">Cart</span>
        <span v-if="itemCount > 0" class="cart-count">{{ itemCount }} items</span>
      </div>
      <div class="cart-header-right">
        <span v-if="!isEmpty" class="cart-total">
          {{ formatMoney(total) }}
        </span>
        <button class="cart-toggle-btn">
          <ChevronUp v-if="cartOpen" :size="18" />
          <ChevronDown v-else :size="18" />
        </button>
      </div>
    </div>

    <div v-if="cartOpen" class="cart-body">
      <div v-if="isEmpty" class="empty-cart">
        <ShoppingCart :size="48" class="empty-icon" />
        <p class="empty-message">Your cart is empty</p>
        <p class="empty-subtext">Scan a barcode or tap a product to add</p>
      </div>

      <div v-else class="cart-items">
        <div
          v-for="item in props.items"
          :key="item.id"
          class="cart-item"
        >
          <div class="item-info">
            <div class="item-name">{{ item.product_name }}</div>
            <div class="item-sku">SKU: {{ item.sku }}</div>
            <div class="item-price">
              {{ formatMoney(item.unit_price) }} each
            </div>
          </div>

          <div class="item-actions">
            <div class="qty-control">
              <button
                class="qty-btn qty-decrement"
                @click.stop="decrementQty(item)"
                :disabled="item.quantity <= 1"
              >
                <Minus :size="14" />
              </button>
              <span class="qty-value">{{ item.quantity }}</span>
              <button
                class="qty-btn qty-increment"
                @click.stop="incrementQty(item)"
              >
                <Plus :size="14" />
              </button>
            </div>

            <div class="item-line-total">
              {{ formatMoney(item.lineTotal) }}
            </div>

            <button
              class="remove-btn"
              @click.stop="removeItem(item.id)"
              title="Remove item"
            >
              <X :size="16" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="cartOpen" class="cart-footer">
      <div class="cart-summary">
        <div class="summary-row">
          <span>Subtotal</span>
          <span class="summary-value">{{ formatMoney(subtotal) }}</span>
        </div>
        <div class="summary-row total-row">
          <span>Total</span>
          <span class="summary-value total-value">{{ formatMoney(total) }}</span>
        </div>
      </div>

      <button
        class="checkout-btn"
        :disabled="isEmpty"
        @click="handleCheckout"
      >
        <ShoppingCart :size="16" />
        <span>Proceed to Checkout</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.pos-cart {
  width: 380px;
  background: var(--color-card);
  border-left: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  height: 100vh;
  transition: width 0.3s ease;
}

.pos-cart.cart-collapsed {
  width: 380px;
  height: auto;
}

.cart-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border);
  cursor: pointer;
  user-select: none;
  background: var(--color-muted);
}

.cart-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.cart-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--color-foreground);
}

.cart-count {
  font-size: 12px;
  color: var(--color-muted-foreground);
  font-weight: 500;
}

.cart-header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.cart-total {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-foreground);
  font-variant-numeric: tabular-nums;
}

.cart-toggle-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: none;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-foreground);
  cursor: pointer;
}

.cart-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
}

.empty-cart {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 16px;
  text-align: center;
  color: var(--color-muted-foreground);
  min-height: 300px;
}

.empty-icon {
  color: var(--color-muted-foreground);
  opacity: 0.5;
  margin-bottom: 16px;
}

.empty-message {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 4px;
}

.empty-subtext {
  font-size: 13px;
  color: var(--color-muted-foreground);
  max-width: 200px;
  line-height: 1.4;
}

.cart-items {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.cart-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: var(--color-muted);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
}

.item-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.item-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-foreground);
}

.item-sku {
  font-size: 11px;
  color: var(--color-muted-foreground);
  font-family: monospace;
}

.item-price {
  font-size: 12px;
  color: var(--color-muted-foreground);
}

.item-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.qty-control {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 2px;
}

.qty-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: none;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--color-foreground);
  cursor: pointer;
}

.qty-btn:hover {
  background: var(--color-muted);
}

.qty-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.qty-value {
  min-width: 24px;
  text-align: center;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-foreground);
}

.item-line-total {
  font-size: 14px;
  font-weight: 700;
  color: var(--color-foreground);
  font-variant-numeric: tabular-nums;
  flex: 1;
  text-align: right;
}

.remove-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: none;
  border: 1px solid var(--color-error);
  border-radius: var(--radius-md);
  color: var(--color-error);
  cursor: pointer;
}

.remove-btn:hover {
  background: var(--color-error);
  color: var(--color-error-foreground);
}

.cart-footer {
  border-top: 1px solid var(--color-border);
  padding: 16px 20px;
  background: var(--color-card);
}

.cart-summary {
  margin-bottom: 16px;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 14px;
  color: var(--color-foreground);
}

.summary-row.total-row {
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 0;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--color-border);
}

.summary-value {
  font-variant-numeric: tabular-nums;
}

.total-value {
  color: var(--color-primary);
}

.checkout-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 14px 16px;
  background: var(--color-cta);
  border: none;
  border-radius: var(--radius-lg);
  font-size: 15px;
  font-weight: 600;
  color: var(--color-cta-foreground);
  cursor: pointer;
  transition: all 0.15s ease;
}

.checkout-btn:hover:not(:disabled) {
  background: var(--color-cta-hover);
}

.checkout-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>