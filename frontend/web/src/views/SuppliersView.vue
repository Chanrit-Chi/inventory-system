<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useSupplierStore, type Supplier } from '@/stores/supplierStore'
import { useToast } from '@/composables/useToast'
import {
  Truck,
  Plus,
  Search,
  RefreshCw,
  Edit2,
  Trash2,
  Phone,
  Mail,
  User,
  ChevronLeft,
  ChevronRight,
  Building2,
  CheckCircle2,
  Contact,
} from 'lucide-vue-next'
import {
  Button,
  Badge,
  Input,
  Switch,
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
const store = useSupplierStore()

const showEditModal = ref(false)
const editing = ref<Partial<Supplier> | null>(null)
const filters = ref({ page: 1, per_page: 15, search: '' })

const isDeleteDialogOpen = ref(false)
const deletingSupplier = ref<Supplier | null>(null)
const isDeleting = ref(false)

const suppliers = computed(() => store.suppliers)

const totalSuppliers = computed(() => store.meta?.total ?? store.suppliers.length)
const activeSuppliers = computed(() => store.suppliers.filter(s => s.is_active).length)
const withContactPerson = computed(() => store.suppliers.filter(s => !!s.contact_person).length)

async function load() {
  try {
    await store.fetchSuppliers({
      page: filters.value.page,
      per_page: filters.value.per_page,
      search: filters.value.search || undefined,
    })
  } catch (err) {
    const e = err as { message?: string }
    toast.error(e.message || 'Failed to load suppliers')
  }
}

function openCreate() {
  editing.value = { name: '', contact_person: '', phone: '', email: '', address: '', is_active: true }
  showEditModal.value = true
}

function openEdit(s: Supplier) {
  editing.value = { ...s }
  showEditModal.value = true
}

async function save() {
  if (!editing.value || !editing.value.name?.trim()) {
    toast.error('Supplier name is required')
    return
  }
  try {
    if (editing.value.id) {
      await store.updateSupplier(editing.value.id, editing.value)
      toast.success('Supplier updated successfully')
    } else {
      await store.createSupplier(editing.value)
      toast.success('Supplier created successfully')
    }
    showEditModal.value = false
    await load()
  } catch (err) {
    const e = err as { message?: string }
    toast.error(e.message || 'Failed to save supplier')
  }
}

function confirmDelete(s: Supplier) {
  deletingSupplier.value = s
  isDeleteDialogOpen.value = true
}

function cancelDelete() {
  deletingSupplier.value = null
  isDeleteDialogOpen.value = false
}

async function executeDelete() {
  if (!deletingSupplier.value?.id) return
  isDeleting.value = true
  try {
    await store.deleteSupplier(deletingSupplier.value.id)
    toast.success('Supplier deleted')
    isDeleteDialogOpen.value = false
    deletingSupplier.value = null
    await load()
  } catch (err) {
    const e = err as { message?: string }
    toast.error(e.message || 'Failed to delete supplier')
  } finally {
    isDeleting.value = false
  }
}

function nextPage() {
  if (store.meta && filters.value.page < store.meta.last_page) {
    filters.value.page += 1
    load()
  }
}
function prevPage() {
  if (filters.value.page > 1) {
    filters.value.page -= 1
    load()
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
          <h1 class="text-2xl sm:text-3xl font-display font-bold text-foreground tracking-tight">Suppliers & Vendors</h1>
          <Badge variant="info" class="font-mono text-xs px-2.5 py-0.5">
            {{ totalSuppliers }} Vendors
          </Badge>
        </div>
        <p class="text-xs text-muted-foreground mt-0.5">
          Manage procurement vendors, wholesale supplier contacts, and restock accounts.
        </p>
      </div>

      <Button variant="primary" size="sm" class="h-9 px-3.5 gap-1.5" @click="openCreate">
        <Plus :size="15" />
        <span>Add Supplier</span>
      </Button>
    </div>

    <!-- Stat Cards Row -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <StatCard
        label="Total Suppliers"
        :value="totalSuppliers"
        sub="Registered vendor profiles"
        :icon="Building2"
        icon-variant="primary"
      />
      <StatCard
        label="Active Restock Vendors"
        :value="activeSuppliers"
        sub="Enabled for purchase intake"
        :icon="CheckCircle2"
        icon-variant="success"
      />
      <StatCard
        label="Procurement Accounts"
        :value="withContactPerson"
        sub="With dedicated representatives"
        :icon="Contact"
        icon-variant="warning"
      />
    </div>

    <!-- Search Toolbar -->
    <div class="rounded-xl border border-border bg-card p-3.5 shadow-xs flex items-center justify-between gap-3">
      <div class="flex-1 max-w-md">
        <Input
          v-model="filters.search"
          type="text"
          placeholder="Search suppliers by name, contact, or email…"
          class="bg-surface"
          @keyup.enter="load"
        >
          <template #prefix>
            <Search :size="16" />
          </template>
        </Input>
      </div>

      <Button variant="outline" size="sm" class="h-9 px-3.5 text-xs gap-1.5" :disabled="store.loading" @click="load">
        <RefreshCw :size="14" :class="{ 'animate-spin': store.loading }" />
        <span>Search</span>
      </Button>
    </div>

    <!-- Suppliers Table Container -->
    <div class="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
      <div v-if="store.loading" class="p-6 space-y-3">
        <Skeleton v-for="i in 4" :key="i" class="h-10 w-full" />
      </div>

      <EmptyState
        v-else-if="!suppliers.length"
        :icon="Truck"
        title="No suppliers found"
        description="No supplier vendors configured in the directory."
      >
        <template #action>
          <Button variant="primary" size="sm" class="gap-1.5" @click="openCreate">
            <Plus :size="15" />
            <span>Add First Supplier</span>
          </Button>
        </template>
      </EmptyState>

      <div v-else class="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow class="bg-muted/40">
              <TableHead>Supplier Name</TableHead>
              <TableHead>Contact Person</TableHead>
              <TableHead class="font-mono">Phone</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead class="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="s in suppliers" :key="s.id" class="hover:bg-surface-subtle/80 transition-colors">
              <TableCell>
                <div class="font-semibold text-foreground flex items-center gap-2">
                  <Truck :size="15" class="text-primary" />
                  <span>{{ s.name }}</span>
                </div>
                <div v-if="s.address" class="text-xs text-muted-foreground mt-0.5 truncate max-w-xs">{{ s.address }}</div>
              </TableCell>
              <TableCell class="text-xs text-foreground">
                <div v-if="s.contact_person" class="flex items-center gap-1.5 font-medium">
                  <User :size="13" class="text-muted-foreground" />
                  <span>{{ s.contact_person }}</span>
                </div>
                <span v-else class="text-muted-foreground">—</span>
              </TableCell>
              <TableCell class="font-mono text-xs text-foreground">
                <div v-if="s.phone" class="flex items-center gap-1.5">
                  <Phone :size="13" class="text-muted-foreground" />
                  <span>{{ s.phone }}</span>
                </div>
                <span v-else class="text-muted-foreground">—</span>
              </TableCell>
              <TableCell class="text-xs text-muted-foreground">
                <div v-if="s.email" class="flex items-center gap-1.5">
                  <Mail :size="13" class="text-muted-foreground" />
                  <span>{{ s.email }}</span>
                </div>
                <span v-else class="text-muted-foreground">—</span>
              </TableCell>
              <TableCell>
                <Badge :variant="s.is_active ? 'success' : 'neutral'" class="text-[10px] px-2 py-0.5">
                  {{ s.is_active ? 'Active' : 'Inactive' }}
                </Badge>
              </TableCell>
              <TableCell class="text-right">
                <div class="flex items-center justify-end gap-1.5">
                  <Button variant="ghost" size="sm" class="h-8 px-2.5 text-xs gap-1" @click="openEdit(s)">
                    <Edit2 :size="13" />
                    <span>Edit</span>
                  </Button>
                  <Button variant="ghost" size="sm" class="h-8 px-2 text-xs text-destructive hover:bg-destructive/10" @click="confirmDelete(s)">
                    <Trash2 :size="14" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <!-- Pagination -->
      <div
        v-if="store.meta && store.meta.last_page > 1"
        class="flex items-center justify-between px-4 py-3 border-t border-border bg-surface-subtle/50 text-xs text-muted-foreground"
      >
        <span class="font-mono">
          Page {{ filters.page }} of {{ store.meta.last_page }}
        </span>
        <div class="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            class="h-8 px-2.5 text-xs gap-1"
            :disabled="filters.page === 1"
            @click="prevPage"
          >
            <ChevronLeft :size="14" />
            <span>Previous</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            class="h-8 px-2.5 text-xs gap-1"
            :disabled="!store.meta || filters.page >= store.meta.last_page"
            @click="nextPage"
          >
            <span>Next</span>
            <ChevronRight :size="14" />
          </Button>
        </div>
      </div>
    </div>

    <!-- Supplier Create/Edit Modal Dialog -->
    <Dialog :open="showEditModal" @update:open="(val) => showEditModal = val">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle class="font-display">{{ editing?.id ? 'Edit Supplier' : 'Add Supplier' }}</DialogTitle>
          <DialogDescription>
            Configure vendor contact details, representative information, and active intake status.
          </DialogDescription>
        </DialogHeader>

        <div v-if="editing" class="flex flex-col gap-3 py-2">
          <div>
            <label class="block text-xs font-semibold text-foreground mb-1">Company / Supplier Name *</label>
            <Input v-model="editing.name" placeholder="e.g. Acme Wholesale Supplies Ltd." class="h-9 bg-surface text-sm" />
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-semibold text-foreground mb-1">Contact Person</label>
              <Input v-model="editing.contact_person" placeholder="e.g. Jane Doe" class="h-9 bg-surface text-sm" />
            </div>

            <div>
              <label class="block text-xs font-semibold text-foreground mb-1">Phone Number</label>
              <Input v-model="editing.phone" placeholder="+855 12 345 678" class="h-9 bg-surface text-sm font-mono" />
            </div>
          </div>

          <div>
            <label class="block text-xs font-semibold text-foreground mb-1">Email Address</label>
            <Input v-model="editing.email" type="email" placeholder="orders@supplier.com" class="h-9 bg-surface text-sm" />
          </div>

          <div>
            <label class="block text-xs font-semibold text-foreground mb-1">Office / Warehouse Address</label>
            <textarea
              v-model="editing.address"
              rows="2"
              placeholder="Warehouse address, delivery instructions…"
              class="w-full px-3 py-1.5 text-xs bg-surface border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-cta/30 focus:border-cta"
            ></textarea>
          </div>

          <div class="flex items-center justify-between pt-2 border-t border-border">
            <div>
              <span class="text-xs font-semibold text-foreground block">Active Vendor</span>
              <span class="text-[11px] text-muted-foreground">Enabled for restock purchase orders</span>
            </div>
            <Switch
              :checked="editing.is_active"
              @update:checked="(val) => editing!.is_active = val"
            />
          </div>
        </div>

        <DialogFooter class="gap-2 sm:gap-0 mt-4">
          <Button variant="outline" @click="showEditModal = false">Cancel</Button>
          <Button variant="primary" @click="save">Save Supplier</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Delete Confirmation Dialog -->
    <Dialog :open="isDeleteDialogOpen" @update:open="(val) => { isDeleteDialogOpen = val; if (!val) cancelDelete(); }">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle class="text-destructive font-display">Confirm Supplier Deletion</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete supplier <strong>"{{ deletingSupplier?.name }}"</strong>? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter class="gap-2 sm:gap-0 mt-4">
          <Button variant="outline" :disabled="isDeleting" @click="cancelDelete">
            Cancel
          </Button>
          <Button variant="destructive" :disabled="isDeleting" @click="executeDelete">
            <span v-if="isDeleting" class="animate-spin mr-1.5">⏳</span>
            <span>{{ isDeleting ? 'Deleting…' : 'Delete Supplier' }}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
