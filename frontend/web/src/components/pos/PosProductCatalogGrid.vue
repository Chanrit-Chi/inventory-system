<script setup lang="ts">
import { computed } from 'vue'
import { ScanBarcode, User } from 'lucide-vue-next'

interface ProductVariant {
  id: string
  sku: string
  selling_price: number | string | null
  quantity_on_hand: number
}

interface Product {
  id: string
  name: string
  selling_price?: number | string | null
  image_url?: string | null
  sku?: string | null
  category?: { id: string; name: string } | null
  variants?: ProductVariant[]
}

interface Props {
  products: Product[]
  category?: string
  searchQuery?: string
  channels?: any[]
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'add-to-cart', product: Product): void
  (e: 'open-scan'): void
  (e: 'open-customer'): void
}>()

// Filter products based on category and search
const filteredProducts = computed(() => {
  let result = props.products

  if (props.category) {
    result = result.filter(p => p.category?.name === props.category)
  }

  if (props.searchQuery) {
    const q = props.searchQuery.toLowerCase()
    result = result.filter(p => p.name.toLowerCase().includes(q))
  }

  return result
})

const getStockForProduct = (product: Product): number => {
  if (!product.variants || product.variants.length === 0) return 0
  return product.variants.reduce(
    (sum, v) => sum + (v.quantity_on_hand || 0),
    0
  )
}

const addToCartHandler = (product: Product) => {
  emit('add-to-cart', product)
}

const formatMoney = (amount: number | string | undefined): string => {
  if (amount === undefined || amount === null) return '$0.00'
  const val = typeof amount === 'string' ? parseFloat(amount) : amount
  return isNaN(val) ? '$0.00' : `$${val.toFixed(2)}`
}
</script>

<template>
  <div class="product-catalog">
    <div class="product-header">
      <h2 class="product-title">
        {{ props.category || 'All Products' }}
        <span v-if="filteredProducts.length !== props.products.length" class="filter-count">
          ({{ filteredProducts.length }})
        </span>
      </h2>

      <div class="product-actions">
        <button
          @click="$emit('open-scan')"
          class="action-btn scan-btn"
          title="Scan Barcode"
        >
          <ScanBarcode :size="16" />
        </button>

        <button
          @click="$emit('open-customer')"
          class="action-btn customer-btn"
          title="Customer Lookup"
        >
          <User :size="16" />
        </button>
      </div>
    </div>

    <div v-if="filteredProducts.length === 0" class="empty-state">
      <p class="empty-message">No products found</p>
      <p class="empty-subtext">
        Try adjusting your search or filters
      </p>
    </div>

    <div v-else class="products-grid">
      <div
        v-for="product in filteredProducts"
        :key="product.id"
        class="product-card"
        @click="addToCartHandler(product)"
        :class="{ 'out-of-stock': getStockForProduct(product) <= 0 }"
      >
        <div class="product-image-wrapper">
          <img
            :src="product.image_url || '/placeholder-product.svg'"
            :alt="product.name"
            class="product-image"
          />
          <div v-if="getStockForProduct(product) <= 0" class="stock-badge out-of-stock">
            Out of Stock
          </div>
          <div v-else-if="getStockForProduct(product) <= 5" class="stock-badge low-stock">
            Low Stock
          </div>
          <div v-else class="stock-badge in-stock">
            In Stock
          </div>
        </div>

        <div class="product-info">
          <h3 class="product-name">{{ product.name }}</h3>
          <div class="product-price">
            {{ formatMoney(
              product.variants?.[0]?.selling_price ??
              product.selling_price ?? 0
            ) }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.product-catalog {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  background: var(--color-background);
}

.product-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.product-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--color-foreground);
  margin: 0;
}

.filter-count {
  font-size: 14px;
  color: var(--color-muted-foreground);
  font-weight: 500;
  margin-left: 8px;
}

.product-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-card);
  color: var(--color-foreground);
  cursor: pointer;
  transition: all 0.15s ease;
}

.action-btn:hover {
  border-color: var(--color-cta);
  background: var(--color-muted);
}

.scan-btn {
  border-color: var(--color-cta);
  color: var(--color-primary);
}

.scan-btn:hover {
  background: var(--color-cta);
  color: var(--color-cta-foreground);
}

.customer-btn {
  border-color: var(--color-success);
  color: var(--color-success-text);
}

.customer-btn:hover {
  background: #047857;
  color: #FFFFFF;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
  color: var(--color-muted-foreground);
}

.empty-message {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 8px;
}

.empty-subtext {
  font-size: 14px;
  max-width: 300px;
  line-height: 1.5;
}

.products-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 20px;
}

.product-card {
  background: var(--color-card);
  border-radius: var(--radius-xl);
  overflow: hidden;
  cursor: pointer;
  border: 1px solid var(--color-border);
  transition: all 0.2s ease;
  position: relative;
}

.product-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-lg);
  border-color: var(--color-cta);
}

.product-card.out-of-stock {
  opacity: 0.7;
  cursor: not-allowed;
}

.product-card.out-of-stock:hover {
  transform: none;
  box-shadow: none;
}

.product-image-wrapper {
  position: relative;
  aspect-ratio: 1/1;
  background: var(--color-muted);
  overflow: hidden;
}

.product-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
}

.product-card:hover .product-image {
  transform: scale(1.05);
}

.stock-badge {
  position: absolute;
  top: 12px;
  right: 12px;
  padding: 4px 8px;
  border-radius: var(--radius-full);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stock-badge.out-of-stock {
  background: var(--color-error);
  color: var(--color-error-foreground);
}

.stock-badge.low-stock {
  background: var(--color-warning);
  color: var(--color-warning-foreground);
}

.stock-badge.in-stock {
  background: var(--color-success);
  color: var(--color-success-foreground);
}

.product-info {
  padding: 16px;
}

.product-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-foreground);
  margin: 0 0 8px 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.product-price {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-foreground);
  font-variant-numeric: tabular-nums;
}
</style>