<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useCategoryStore, type Category } from '@/stores/categoryStore'
import { useToast } from '@/composables/useToast'
import {
  FolderTree,
  Plus,
  Search,
  Edit2,
  Trash2,
  Package,
  Layers,
} from 'lucide-vue-next'
import {
  Button,
  Badge,
  Input,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  StatCard,
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  EmptyState,
  Skeleton,
} from '@/components/ui'

const toast = useToast()
const store = useCategoryStore()

const showEditModal = ref(false)
const editing = ref<Partial<Category> | null>(null)
const search = ref('')

const isDeleteDialogOpen = ref(false)
const deletingCategory = ref<Category | null>(null)
const isDeleting = ref(false)

const categories = computed(() => {
  if (!search.value.trim()) return store.categories
  const q = search.value.toLowerCase().trim()
  return store.categories.filter(
    c => c.name.toLowerCase().includes(q) || (c.slug && c.slug.toLowerCase().includes(q))
  )
})

const totalProducts = computed(() =>
  store.categories.reduce((acc, c) => acc + (c.product_count || 0), 0)
)

async function load() {
  try {
    await store.fetchCategories()
  } catch (err) {
    const e = err as { message?: string }
    toast.error(e.message || 'Failed to load categories')
  }
}

function openCreate() {
  editing.value = { name: '', slug: '', description: '' }
  showEditModal.value = true
}

function openEdit(c: Category) {
  editing.value = { ...c }
  showEditModal.value = true
}

async function save() {
  if (!editing.value || !editing.value.name?.trim()) {
    toast.error('Category name is required')
    return
  }
  try {
    if (editing.value.id) {
      await store.updateCategory(editing.value.id, editing.value)
      toast.success('Category updated successfully')
    } else {
      await store.createCategory(editing.value)
      toast.success('Category created successfully')
    }
    showEditModal.value = false
    await load()
  } catch (err) {
    const e = err as { message?: string }
    toast.error(e.message || 'Failed to save category')
  }
}

function confirmDelete(c: Category) {
  deletingCategory.value = c
  isDeleteDialogOpen.value = true
}

function cancelDelete() {
  deletingCategory.value = null
  isDeleteDialogOpen.value = false
}

async function executeDelete() {
  if (!deletingCategory.value?.id) return
  isDeleting.value = true
  try {
    await store.deleteCategory(deletingCategory.value.id)
    toast.success('Category deleted')
    isDeleteDialogOpen.value = false
    deletingCategory.value = null
    await load()
  } catch (err) {
    const e = err as { message?: string }
    toast.error(e.message || 'Failed to delete category')
  } finally {
    isDeleting.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="flex flex-col gap-6 max-w-6xl mx-auto w-full">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-3">
          <h1 class="text-2xl sm:text-3xl font-display font-bold text-foreground tracking-tight">Categories</h1>
          <Badge variant="info" class="font-mono text-xs px-2.5 py-0.5">
            {{ store.categories.length }} Categories
          </Badge>
        </div>
        <p class="text-xs text-muted-foreground mt-0.5">
          Organize master products and catalog taxonomies for POS navigation.
        </p>
      </div>

      <Button variant="primary" size="sm" class="h-9 px-3.5 gap-1.5" @click="openCreate">
        <Plus :size="15" />
        <span>Add Category</span>
      </Button>
    </div>

    <!-- Stat Cards Row -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <StatCard
        label="Total Categories"
        :value="store.categories.length"
        sub="Active catalog groups"
        :icon="FolderTree"
        icon-variant="primary"
      />
      <StatCard
        label="Categorized Items"
        :value="totalProducts"
        sub="Assigned master products"
        :icon="Package"
        icon-variant="success"
      />
      <StatCard
        label="Active Taxonomies"
        :value="store.categories.filter(c => !!c.slug).length"
        sub="Indexed taxonomy slugs"
        :icon="Layers"
        icon-variant="warning"
      />
    </div>

    <!-- Search Toolbar -->
    <div class="rounded-xl border border-border bg-card p-3.5 shadow-xs flex items-center justify-between gap-3">
      <div class="flex-1 max-w-md">
        <Input
          v-model="search"
          type="text"
          placeholder="Filter categories by name or slug…"
          class="bg-surface"
        >
          <template #prefix>
            <Search :size="16" />
          </template>
        </Input>
      </div>
    </div>

    <!-- Table Container -->
    <div class="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
      <div v-if="store.loading" class="p-6 space-y-3">
        <Skeleton v-for="i in 4" :key="i" class="h-10 w-full" />
      </div>

      <EmptyState
        v-else-if="!categories.length"
        :icon="FolderTree"
        title="No categories found"
        description="No categories match your search or none have been created yet."
      >
        <template #action>
          <Button variant="primary" size="sm" class="gap-1.5" @click="openCreate">
            <Plus :size="15" />
            <span>Add First Category</span>
          </Button>
        </template>
      </EmptyState>

      <div v-else class="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow class="bg-muted/40">
              <TableHead>Category Name</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Products</TableHead>
              <TableHead class="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="c in categories" :key="c.id" class="hover:bg-surface-subtle/80 transition-colors">
              <TableCell>
                <div class="font-semibold text-foreground flex items-center gap-2">
                  <FolderTree :size="15" class="text-primary" />
                  <span>{{ c.name }}</span>
                </div>
              </TableCell>
              <TableCell class="font-mono text-xs text-muted-foreground">
                {{ c.slug || '—' }}
              </TableCell>
              <TableCell class="text-xs text-muted-foreground max-w-xs truncate">
                {{ c.description || '—' }}
              </TableCell>
              <TableCell>
                <Badge variant="neutral" class="font-mono text-xs px-2 py-0.5">
                  {{ c.product_count ?? 0 }} items
                </Badge>
              </TableCell>
              <TableCell class="text-right">
                <div class="flex items-center justify-end gap-1.5">
                  <Button variant="ghost" size="sm" class="h-8 px-2.5 text-xs gap-1" @click="openEdit(c)">
                    <Edit2 :size="13" />
                    <span>Edit</span>
                  </Button>
                  <Button variant="ghost" size="sm" class="h-8 px-2 text-xs text-destructive hover:bg-destructive/10" @click="confirmDelete(c)">
                    <Trash2 :size="14" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>

    <!-- Category Create/Edit Modal Dialog -->
    <Dialog :open="showEditModal" @update:open="(val) => showEditModal = val">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle class="font-display">{{ editing?.id ? 'Edit Category' : 'Add Category' }}</DialogTitle>
          <DialogDescription>
            Configure category metadata for product taxonomy and POS navigation menus.
          </DialogDescription>
        </DialogHeader>

        <div v-if="editing" class="flex flex-col gap-3.5 py-2">
          <div>
            <label class="block text-xs font-semibold text-foreground mb-1">Category Name *</label>
            <Input v-model="editing.name" placeholder="e.g. Apparel, Beverages" class="h-9 bg-surface text-sm" />
          </div>
          <div>
            <label class="block text-xs font-semibold text-foreground mb-1">URL Slug</label>
            <Input v-model="editing.slug" placeholder="e.g. apparel, beverages" class="h-9 bg-surface text-sm font-mono" />
          </div>
          <div>
            <label class="block text-xs font-semibold text-foreground mb-1">Description</label>
            <textarea
              v-model="editing.description"
              rows="3"
              placeholder="Category overview and classification notes…"
              class="w-full px-3 py-2 text-sm bg-surface border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-cta/30 focus:border-cta"
            ></textarea>
          </div>
        </div>

        <DialogFooter class="gap-2 sm:gap-0 mt-4">
          <Button variant="outline" @click="showEditModal = false">Cancel</Button>
          <Button variant="primary" @click="save">Save Category</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Delete Confirmation Dialog -->
    <Dialog :open="isDeleteDialogOpen" @update:open="(val) => { isDeleteDialogOpen = val; if (!val) cancelDelete(); }">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle class="text-destructive font-display">Confirm Category Deletion</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete category <strong>"{{ deletingCategory?.name }}"</strong>? Products in this category will become unassigned.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter class="gap-2 sm:gap-0 mt-4">
          <Button variant="outline" :disabled="isDeleting" @click="cancelDelete">
            Cancel
          </Button>
          <Button variant="destructive" :disabled="isDeleting" @click="executeDelete">
            <span v-if="isDeleting" class="animate-spin mr-1.5">⏳</span>
            <span>{{ isDeleting ? 'Deleting…' : 'Delete Category' }}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
