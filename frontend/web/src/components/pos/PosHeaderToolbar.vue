<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  ShoppingCart,
  Search,
  Filter,
  User,
  ScanBarcode,
  X,
  ChevronDown,
  Store,
} from 'lucide-vue-next'
import ListPickerModal from './ListPickerModal.vue'

interface Category {
  id: string
  name: string
}

interface Channel {
  id: string
  name: string
}

interface Props {
  searchQuery?: string
  selectedCategory?: string
  categories?: Category[]
  channels?: Channel[]
  selectedChannel?: string
  selectedChannelId?: string
  selectedSeller?: string
  cartItemCount?: number
  total?: number
}

const props = withDefaults(defineProps<Props>(), {
  searchQuery: '',
  selectedCategory: '',
  categories: () => [],
  channels: () => [],
  selectedChannel: '',
  selectedSeller: '',
  selectedChannelId: '',
  cartItemCount: 0,
  total: 0,
})

const emit = defineEmits<{
  search: [value: string]
  'clear-search': []
  'toggle-search': []
  'open-scan': []
  'open-customer': []
  'open-seller': []
  'open-checkout': []
  'category-select': [category: string]
  'channel-select': [channel: Channel]
}>()

const channelItems = computed(() =>
  props.channels?.map((ch) => ({ id: ch.id, name: ch.name })) ?? []
)

const localSearch = ref(props.searchQuery)
const showCategoryDropdown = ref(false)
const showChannelPicker = ref(false)

const handleSearch = () => {
  emit('search', localSearch.value)
}

const clearSearch = () => {
  localSearch.value = ''
  emit('clear-search')
}

const selectCategory = (cat: string) => {
  emit('category-select', cat)
  showCategoryDropdown.value = false
}

const selectChannel = (channel: Channel) => {
  emit('channel-select', channel)
  showChannelPicker.value = false
}

const formatMoney = (amount: number): string => {
  return `$${amount.toFixed(2)}`
}
</script>

<template>
  <header class="pos-header">
    <div class="pos-header-left">
      <div class="header-brand">
        <span class="brand-icon">🛒</span>
        <h1 class="brand-title">POS Terminal</h1>
      </div>

      <div class="header-search" v-if="props.searchQuery !== undefined">
        <div class="search-input-wrapper">
          <Search :size="16" class="search-icon" />
          <input
            v-model="localSearch"
            type="text"
            placeholder="Search products..."
            class="search-input"
            @input="emit('search', localSearch)"
            @keyup.enter="handleSearch"
          />
          <button
            v-if="localSearch"
            @click="clearSearch"
            class="search-clear"
          >
            <X :size="14" />
          </button>
        </div>
      </div>

      <div class="header-filters">
        <!-- Category Dropdown -->
        <div class="dropdown-wrapper">
          <button
            class="filter-btn"
            @click="showCategoryDropdown = !showCategoryDropdown"
          >
            <Filter :size="14" />
            <span>{{ props.selectedCategory || 'Category' }}</span>
            <ChevronDown :size="14" />
          </button>
          <div v-if="showCategoryDropdown" class="dropdown-menu">
            <button
              class="dropdown-item"
              @click="selectCategory('')"
            >
              All Categories
            </button>
            <button
              v-for="cat in props.categories"
              :key="cat.id"
              class="dropdown-item"
              :class="{ active: props.selectedCategory === cat.name }"
              @click="selectCategory(cat.name)"
            >
              {{ cat.name }}
            </button>
          </div>
        </div>

        <!-- Channel Picker -->
        <div class="dropdown-wrapper" v-if="props.channels?.length">
          <button
            class="filter-btn"
            @click="showChannelPicker = true"
          >
            <Store :size="14" />
            <span>{{ props.selectedChannel || 'Channel' }}</span>
            <ChevronDown :size="14" />
          </button>
        </div>

        <ListPickerModal
          v-if="props.channels?.length"
          :open="showChannelPicker"
          title="Select Sales Channel"
          :items="channelItems"
          :selected-id="props.selectedChannelId || null"
          searchable
          @update:open="showChannelPicker = $event"
          @select="selectChannel"
        />
      </div>
    </div>

    <div class="pos-header-right">
      <button class="header-btn" @click="emit('open-scan')" title="Barcode Scanner">
        <ScanBarcode :size="18" />
      </button>

      <button class="header-btn" @click="emit('open-customer')" title="Customer Lookup">
        <User :size="18" />
      </button>

      <button
        v-if="props.selectedSeller"
        class="header-btn seller-btn"
        @click="emit('open-seller')"
        title="Change Seller"
      >
        <User :size="18" />
        <span class="seller-name">{{ props.selectedSeller }}</span>
      </button>
      <button
        v-else
        class="header-btn"
        @click="emit('open-seller')"
        title="Assign Seller"
      >
        <User :size="18" />
      </button>

      <button class="checkout-btn" @click="emit('open-checkout')">
        <ShoppingCart :size="16" />
        <span>Checkout</span>
        <span v-if="props.cartItemCount > 0" class="cart-badge">
          {{ props.cartItemCount }}
        </span>
      </button>

      <div class="header-total" v-if="props.total > 0">
        {{ formatMoney(props.total) }}
      </div>
    </div>
  </header>
</template>

<style scoped>
.pos-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  background: var(--color-card);
  border-bottom: 1px solid var(--color-border);
  gap: 16px;
  min-height: 64px;
}

.pos-header-left {
  display: flex;
  align-items: center;
  gap: 16px;
  flex: 1;
}

.header-brand {
  display: flex;
  align-items: center;
  gap: 8px;
}

.brand-icon {
  font-size: 24px;
}

.brand-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-foreground);
  margin: 0;
}

.header-search {
  flex: 1;
  max-width: 400px;
}

.search-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 12px;
  color: var(--color-muted-foreground);
  pointer-events: none;
}

.search-input {
  width: 100%;
  padding: 8px 36px 8px 36px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-muted);
  font-family: var(--font-sans, 'Poppins', sans-serif);
  font-size: 14px;
  color: var(--color-foreground);
}

.search-input:focus {
  outline: none;
  border-color: var(--color-cta);
  background: var(--color-card);
}

.search-clear {
  position: absolute;
  right: 8px;
  background: none;
  border: none;
  padding: 4px;
  cursor: pointer;
  color: var(--color-muted-foreground);
  border-radius: var(--radius-sm);
}

.search-clear:hover {
  background: var(--color-muted);
}

.header-filters {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: 13px;
  color: var(--color-foreground);
  cursor: pointer;
  transition: all 0.15s ease;
}

.filter-btn:hover {
  border-color: var(--color-cta);
  background: var(--color-muted);
}

.dropdown-wrapper {
  position: relative;
}

.dropdown-menu {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 4px;
  min-width: 180px;
  background: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  z-index: 50;
  max-height: 240px;
  overflow-y: auto;
}

.dropdown-item {
  display: block;
  width: 100%;
  padding: 8px 12px;
  text-align: left;
  background: none;
  border: none;
  font-size: 13px;
  color: var(--color-foreground);
  cursor: pointer;
}

.dropdown-item:hover {
  background: var(--color-muted);
}

.dropdown-item.active {
  background: var(--color-cta);
  color: var(--color-cta-foreground);
}

.pos-header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-foreground);
  cursor: pointer;
  transition: all 0.15s ease;
}

.header-btn:hover {
  border-color: var(--color-cta);
  background: var(--color-muted);
}

.checkout-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: var(--color-cta);
  border: none;
  border-radius: var(--radius-lg);
  font-size: 14px;
  font-weight: 600;
  color: var(--color-cta-foreground);
  cursor: pointer;
  transition: all 0.15s ease;
}

.checkout-btn:hover {
  background: var(--color-cta-hover);
}

.cart-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  background: #FFFFFF;
  color: #924C00;
  border-radius: var(--radius-full);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.02em;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
  line-height: 1;
}

.seller-btn {
  border-color: var(--color-success-border);
  color: var(--color-success-text);
  background: var(--color-success-bg);
}

.seller-btn:hover {
  background: var(--color-success);
  color: #FFFFFF;
}

.seller-name {
  font-size: 11px;
  font-weight: 600;
}

.header-total {
  padding: 8px 16px;
  background: var(--color-muted);
  border-radius: var(--radius-md);
  font-size: 16px;
  font-weight: 700;
  color: var(--color-foreground);
  font-variant-numeric: tabular-nums;
}
</style>
