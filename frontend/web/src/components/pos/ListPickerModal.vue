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
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 20px;
}

.modal-container {
  width: 100%;
  max-width: 480px;
  max-height: 80vh;
  background: var(--color-card);
  border-radius: var(--radius-xl);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: var(--shadow-xl);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border);
}

.modal-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--color-foreground);
  margin: 0;
}

.close-btn {
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

.close-btn:hover {
  background: var(--color-muted);
}

.modal-search {
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border);
}

.search-input {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-muted);
  font-size: 14px;
  color: var(--color-foreground);
}

.search-input:focus {
  outline: none;
  border-color: var(--color-cta);
  background: var(--color-card);
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.list-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background 0.15s ease;
}

.list-item:hover {
  background: var(--color-muted);
}

.list-item.selected {
  background: var(--color-cta);
  color: var(--color-cta-foreground);
}

.item-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.item-icon {
  font-size: 20px;
}

.item-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.item-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-foreground);
}

.list-item.selected .item-name {
  color: var(--color-cta-foreground);
}

.item-description {
  font-size: 12px;
  color: var(--color-muted-foreground);
}

.check-icon {
  color: var(--color-cta-foreground);
}

.empty-state {
  text-align: center;
  padding: 32px 16px;
  color: var(--color-muted-foreground);
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
