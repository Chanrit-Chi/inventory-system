<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useAttributeStore, type Attribute } from '@/stores/attributeStore'
import { useToast } from '@/composables/useToast'
import {
  Layers,
  Plus,
  Search,
  Edit2,
  Trash2,
  Tag,
  Sliders,
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
const store = useAttributeStore()

const showEditModal = ref(false)
const editing = ref<Partial<Attribute> | null>(null)
const valuesText = ref('')
const search = ref('')

const isDeleteDialogOpen = ref(false)
const deletingAttribute = ref<Attribute | null>(null)
const isDeleting = ref(false)

const attributes = computed(() => {
  if (!search.value.trim()) return store.attributes
  const q = search.value.toLowerCase().trim()
  return store.attributes.filter(
    a => a.name.toLowerCase().includes(q) || (a.slug && a.slug.toLowerCase().includes(q))
  )
})

const totalValues = computed(() =>
  store.attributes.reduce((acc, a) => acc + (a.values?.length || 0), 0)
)

const totalTypes = computed(() =>
  new Set(store.attributes.map(a => a.type)).size
)

async function load() {
  try {
    await store.fetchAttributes()
  } catch (err) {
    const e = err as { message?: string }
    toast.error(e.message || 'Failed to load attributes')
  }
}

function openCreate() {
  editing.value = { name: '', slug: '', type: 'text', values: [] }
  valuesText.value = ''
  showEditModal.value = true
}

function openEdit(a: Attribute) {
  editing.value = { ...a }
  valuesText.value = (a.values || []).map(v => typeof v === 'string' ? v : (v as any).value_name || (v as any).id).join(', ')
  showEditModal.value = true
}

async function save() {
  if (!editing.value || !editing.value.name?.trim()) {
    toast.error('Attribute name is required')
    return
  }
  editing.value.values = valuesText.value
    .split(',')
    .map(v => v.trim())
    .filter(Boolean)
  try {
    if (editing.value.id) {
      await store.updateAttribute(editing.value.id, editing.value)
      toast.success('Attribute updated successfully')
    } else {
      await store.createAttribute(editing.value)
      toast.success('Attribute created successfully')
    }
    showEditModal.value = false
    await load()
  } catch (err) {
    const e = err as { message?: string }
    toast.error(e.message || 'Failed to save attribute')
  }
}

function confirmDelete(a: Attribute) {
  deletingAttribute.value = a
  isDeleteDialogOpen.value = true
}

function cancelDelete() {
  deletingAttribute.value = null
  isDeleteDialogOpen.value = false
}

async function executeDelete() {
  if (!deletingAttribute.value?.id) return
  isDeleting.value = true
  try {
    await store.deleteAttribute(deletingAttribute.value.id)
    toast.success('Attribute deleted')
    isDeleteDialogOpen.value = false
    deletingAttribute.value = null
    await load()
  } catch (err) {
    const e = err as { message?: string }
    toast.error(e.message || 'Failed to delete attribute')
  } finally {
    isDeleting.value = false
  }
}

function typeBadge(type: string) {
  if (type === 'color') return 'purple' as const
  if (type === 'size') return 'info' as const
  if (type === 'number') return 'warning' as const
  return 'neutral' as const
}

onMounted(load)
</script>

<template>
  <div class="flex flex-col gap-6 max-w-6xl mx-auto w-full">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-3">
          <h1 class="text-2xl sm:text-3xl font-display font-bold text-foreground tracking-tight">Variant Attributes</h1>
          <Badge variant="info" class="font-mono text-xs px-2.5 py-0.5">
            {{ store.attributes.length }} Attributes
          </Badge>
        </div>
        <p class="text-xs text-muted-foreground mt-0.5">
          Define product variation dimensions (Size, Color, Material) used to construct Cartesian matrices.
        </p>
      </div>

      <Button variant="primary" size="sm" class="h-9 px-3.5 gap-1.5" @click="openCreate">
        <Plus :size="15" />
        <span>Add Attribute</span>
      </Button>
    </div>

    <!-- Stat Cards Row -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <StatCard
        label="Total Attributes"
        :value="store.attributes.length"
        sub="Configured dimensions"
        :icon="Layers"
        icon-variant="primary"
      />
      <StatCard
        label="Defined Option Values"
        :value="totalValues"
        sub="Total selectable choices"
        :icon="Tag"
        icon-variant="success"
      />
      <StatCard
        label="Dimension Matrix Types"
        :value="totalTypes"
        sub="Text, color, size & numeric"
        :icon="Sliders"
        icon-variant="warning"
      />
    </div>

    <!-- Search Toolbar -->
    <div class="rounded-xl border border-border bg-card p-3.5 shadow-xs flex items-center justify-between gap-3">
      <div class="flex-1 max-w-md">
        <Input
          v-model="search"
          type="text"
          placeholder="Filter attributes by name or slug…"
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
        v-else-if="!attributes.length"
        :icon="Layers"
        title="No attributes found"
        description="No variant attributes have been defined yet. Create your first attribute (like Size or Color)."
      >
        <template #action>
          <Button variant="primary" size="sm" class="gap-1.5" @click="openCreate">
            <Plus :size="15" />
            <span>Add First Attribute</span>
          </Button>
        </template>
      </EmptyState>

      <div v-else class="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow class="bg-muted/40">
              <TableHead>Attribute Name</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Defined Values</TableHead>
              <TableHead class="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="a in attributes" :key="a.id" class="hover:bg-surface-subtle/80 transition-colors">
              <TableCell>
                <div class="font-semibold text-foreground flex items-center gap-2">
                  <Tag :size="15" class="text-primary" />
                  <span>{{ a.name }}</span>
                </div>
              </TableCell>
              <TableCell class="font-mono text-xs text-muted-foreground">
                {{ a.slug || '—' }}
              </TableCell>
              <TableCell>
                <Badge :variant="typeBadge(a.type)" class="text-[10px] px-2 py-0.5 uppercase tracking-wider font-semibold">
                  {{ a.type }}
                </Badge>
              </TableCell>
              <TableCell>
                <div class="flex flex-wrap gap-1 max-w-md">
                  <Badge
                    v-for="v in (a.values || [])"
                    :key="typeof v === 'string' ? v : (v as any).value_name || (v as any).id"
                    variant="neutral"
                    class="text-[11px] px-2 py-0.5 font-medium"
                  >
                    {{ typeof v === 'string' ? v : (v as any).value_name || (v as any).id }}
                  </Badge>
                  <span v-if="!a.values?.length" class="text-xs text-muted-foreground italic">None configured</span>
                </div>
              </TableCell>
              <TableCell class="text-right">
                <div class="flex items-center justify-end gap-1.5">
                  <Button variant="ghost" size="sm" class="h-8 px-2.5 text-xs gap-1" @click="openEdit(a)">
                    <Edit2 :size="13" />
                    <span>Edit</span>
                  </Button>
                  <Button variant="ghost" size="sm" class="h-8 px-2 text-xs text-destructive hover:bg-destructive/10" @click="confirmDelete(a)">
                    <Trash2 :size="14" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>

    <!-- Attribute Create/Edit Modal Dialog -->
    <Dialog :open="showEditModal" @update:open="(val) => showEditModal = val">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle class="font-display">{{ editing?.id ? 'Edit Attribute' : 'Add Attribute' }}</DialogTitle>
          <DialogDescription>
            Define options and value lists for Cartesian product matrix generation.
          </DialogDescription>
        </DialogHeader>

        <div v-if="editing" class="flex flex-col gap-3.5 py-2">
          <div>
            <label class="block text-xs font-semibold text-foreground mb-1">Attribute Name *</label>
            <Input v-model="editing.name" placeholder="e.g. Size, Color, Material" class="h-9 bg-surface text-sm" />
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-semibold text-foreground mb-1">Slug</label>
              <Input v-model="editing.slug" placeholder="e.g. size, color" class="h-9 bg-surface text-sm font-mono" />
            </div>

            <div>
              <label class="block text-xs font-semibold text-foreground mb-1">Display Type</label>
              <select
                v-model="editing.type"
                class="w-full h-9 px-3 text-sm bg-surface border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-cta/30 focus:border-cta"
              >
                <option value="text">Text / Label</option>
                <option value="size">Size</option>
                <option value="color">Color</option>
                <option value="number">Number</option>
              </select>
            </div>
          </div>

          <div>
            <label class="block text-xs font-semibold text-foreground mb-1">Values (comma-separated)</label>
            <Input
              v-model="valuesText"
              placeholder="e.g. S, M, L, XL or Red, Navy, Olive"
              class="h-9 bg-surface text-sm"
            />
            <p class="text-[11px] text-muted-foreground mt-1">Separate options with commas to produce individual value chips.</p>
          </div>
        </div>

        <DialogFooter class="gap-2 sm:gap-0 mt-4">
          <Button variant="outline" @click="showEditModal = false">Cancel</Button>
          <Button variant="primary" @click="save">Save Attribute</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Delete Confirmation Dialog -->
    <Dialog :open="isDeleteDialogOpen" @update:open="(val) => { isDeleteDialogOpen = val; if (!val) cancelDelete(); }">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle class="text-destructive font-display">Confirm Attribute Deletion</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete attribute <strong>"{{ deletingAttribute?.name }}"</strong>? This will remove these option choices from new products.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter class="gap-2 sm:gap-0 mt-4">
          <Button variant="outline" :disabled="isDeleting" @click="cancelDelete">
            Cancel
          </Button>
          <Button variant="destructive" :disabled="isDeleting" @click="executeDelete">
            <span v-if="isDeleting" class="animate-spin mr-1.5">⏳</span>
            <span>{{ isDeleting ? 'Deleting…' : 'Delete Attribute' }}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
