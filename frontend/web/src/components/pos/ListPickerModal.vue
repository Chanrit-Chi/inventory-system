<script setup lang="ts">
import { ref } from 'vue'
import { X, Check } from 'lucide-vue-next'

interface ListItem {
  id: string
  name: string
  description?: string
  icon?: string
}

interface Props {
  open: boolean
  title: string
  items: ListItem[]
  selectedId?: string | null
  searchable?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  selectedId: null,
  searchable: true,
})

const emit = defineEmits<{
  'update:open': [value: boolean]
  select: [item: ListItem]
  close: []
}>()

const searchQuery = ref('')

const filteredItems = ref(props.items)

const close = () => {
  emit('update:open', false)
  searchQuery.value = ''
  emit('close')
}

const selectItem = (item: ListItem) => {
  emit('select', item)
  close()
}

const handleSearch = (query: string) => {
  searchQuery.value = query
  filteredItems.value = props.items.filter((item) =>
    item.name.toLowerCase().includes(query.toLowerCase())
  )
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open" class="modal-overlay" @click.self="close">
        <div class="modal-container" @click.stop>
          <header class="modal-header">
            <h2 class="modal-title">{{ title }}</h2>
            <button @click="close" class="close-btn">
              <X :size="18" />
            </button>
          </header>

          <div v-if="searchable" class="modal-search">
            <input
              type="text"
              v-model="searchQuery"
              placeholder="Search..."
              class="search-input"
              @input="handleSearch(searchQuery)"
            />
          </div>

          <div class="modal-body">
            <div
              v-for="item in filteredItems"
              :key="item.id"
              class="list-item"
              :class="{ selected: item.id === selectedId }"
              @click="selectItem(item)"
            >
              <div class="item-content">
                <span v-if="item.icon" class="item-icon">{{ item.icon }}</span>
                <div class="item-text">
                  <span class="item-name">{{ item.name }}</span>
                  <span v-if="item.description" class="item-description">
                    {{ item.description }}
                  </span>
                </div>
              </div>
              <Check
                v-if="item.id === selectedId"
                :size="16"
                class="check-icon"
              />
            </div>

            <div v-if="filteredItems.length === 0" class="empty-state">
              <p>No items found</p>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 20px;
}

.modal-container {
  width: 100%;
  max-width: 440px;
  max-height: 80vh;
  background: var(--color-card, #FFFFFF);
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.2);
  border: 1px solid var(--color-border, #E8E2D9);
  color: var(--color-foreground, #1A1C1C);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  background: var(--color-surface-subtle, #FAF7F2);
  border-bottom: 1px solid var(--color-border, #E8E2D9);
}

.modal-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--color-foreground, #1A1C1C);
  margin: 0;
  font-family: var(--font-display, inherit);
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: none;
  border: 1px solid var(--color-border, #E8E2D9);
  border-radius: 8px;
  color: var(--color-muted-foreground, #6B6358);
  cursor: pointer;
  transition: all 0.15s ease;
}

.close-btn:hover {
  background: var(--color-surface-subtle, #F0EAE1);
  color: var(--color-foreground, #1A1C1C);
}

.modal-search {
  padding: 10px 16px;
  border-bottom: 1px solid var(--color-border, #E8E2D9);
  background: var(--color-card, #FFFFFF);
}

.search-input {
  width: 100%;
  padding: 7px 12px;
  border: 1px solid var(--color-input, #E8E2D9);
  border-radius: 8px;
  background: var(--color-surface-subtle, #FAF7F2);
  font-size: 12px;
  color: var(--color-foreground, #1A1C1C);
  transition: all 0.15s ease;
}

.search-input:focus {
  outline: none;
  border-color: var(--color-cta, #FF8800);
  background: var(--color-card, #FFFFFF);
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  background: var(--color-background, transparent);
}

.list-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.15s ease;
  margin-bottom: 4px;
}

.list-item:hover {
  background: var(--color-surface-subtle, #FAF7F2);
}

.list-item.selected {
  background: var(--color-cta-muted, #FFF3E0);
  border: 1px solid var(--color-border-strong, #FFDCC4);
  color: var(--color-primary, #924C00);
}

.item-content {
  display: flex;
  align-items: center;
  gap: 10px;
}

.item-icon {
  font-size: 16px;
}

.item-text {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.item-name {
  font-size: 12.5px;
  font-weight: 700;
  color: var(--color-foreground, #1A1C1C);
}

.list-item.selected .item-name {
  color: var(--color-primary, #924C00);
}

.item-description {
  font-size: 11px;
  color: var(--color-muted-foreground, #6B6358);
}

.check-icon {
  color: var(--color-cta, #924C00);
}

.empty-state {
  text-align: center;
  padding: 24px 16px;
  font-size: 12px;
  color: var(--color-muted-foreground, #6B6358);
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>
