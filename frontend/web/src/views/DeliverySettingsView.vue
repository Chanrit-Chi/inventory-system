<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useDeliveryZoneStore, type DeliveryCompany, type DeliveryZone } from '@/stores/deliveryZoneStore'
import { useToast } from '@/composables/useToast'
import {
  Truck,
  MapPin,
  Plus,
  Edit2,
  Trash2,
  RefreshCw,
  DollarSign,
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
const store = useDeliveryZoneStore()

const activeTab = ref<'companies' | 'zones'>('companies')
const showCompanyModal = ref(false)
const showZoneModal = ref(false)
const editingCompany = ref<Partial<DeliveryCompany> | null>(null)
const editingZone = ref<Partial<DeliveryZone> | null>(null)

const isDeleteDialogOpen = ref(false)
const deleteTargetType = ref<'company' | 'zone'>('company')
const deleteTargetId = ref<string | null>(null)
const isDeleting = ref(false)

const companies = computed(() => store.companies)
const zones = computed(() => store.zones)

const totalCouriers = computed(() => companies.value.length)
const activeZonesCount = computed(() => zones.value.filter(z => z.is_active).length)
const avgDeliveryFee = computed(() => {
  if (!zones.value.length) return '$0.00'
  const sum = zones.value.reduce((acc, z) => acc + (parseFloat(String(z.fee)) || 0), 0)
  return '$' + (sum / zones.value.length).toFixed(2)
})

async function loadAll() {
  try {
    await Promise.all([store.fetchCompanies(), store.fetchZones()])
  } catch (err) {
    const e = err as { message?: string }
    toast.error(e.message || 'Failed to load delivery data')
  }
}

function openCompanyCreate() {
  editingCompany.value = { name: '', phone: '', email: '', website: '', is_active: true }
  showCompanyModal.value = true
}

function openCompanyEdit(c: DeliveryCompany) {
  editingCompany.value = { ...c }
  showCompanyModal.value = true
}

async function saveCompany() {
  if (!editingCompany.value || !editingCompany.value.name?.trim()) {
    toast.error('Company name is required')
    return
  }
  try {
    if (editingCompany.value.id) {
      await store.updateCompany(editingCompany.value.id, editingCompany.value)
      toast.success('Company updated')
    } else {
      await store.createCompany(editingCompany.value)
      toast.success('Company created')
    }
    showCompanyModal.value = false
    await store.fetchCompanies()
  } catch (err) {
    const e = err as { message?: string }
    toast.error(e.message || 'Failed to save company')
  }
}

function confirmDeleteCompany(id: string) {
  deleteTargetType.value = 'company'
  deleteTargetId.value = id
  isDeleteDialogOpen.value = true
}

function openZoneCreate() {
  editingZone.value = { company_id: companies.value[0]?.id || '', zone_name: '', fee: 0, estimated_days: '1-2', is_active: true }
  showZoneModal.value = true
}

function openZoneEdit(z: DeliveryZone) {
  editingZone.value = { ...z }
  showZoneModal.value = true
}

async function saveZone() {
  if (!editingZone.value || !editingZone.value.zone_name?.trim()) {
    toast.error('Zone name is required')
    return
  }
  try {
    if (editingZone.value.id) {
      await store.updateZone(editingZone.value.id, editingZone.value)
      toast.success('Zone updated')
    } else {
      await store.createZone(editingZone.value)
      toast.success('Zone created')
    }
    showZoneModal.value = false
    await store.fetchZones()
  } catch (err) {
    const e = err as { message?: string }
    toast.error(e.message || 'Failed to save zone')
  }
}

function confirmDeleteZone(id: string) {
  deleteTargetType.value = 'zone'
  deleteTargetId.value = id
  isDeleteDialogOpen.value = true
}

function cancelDelete() {
  deleteTargetId.value = null
  isDeleteDialogOpen.value = false
}

async function executeDelete() {
  if (!deleteTargetId.value) return
  isDeleting.value = true
  try {
    if (deleteTargetType.value === 'company') {
      await store.deleteCompany(deleteTargetId.value)
      toast.success('Company deleted')
      await store.fetchCompanies()
    } else {
      await store.deleteZone(deleteTargetId.value)
      toast.success('Zone deleted')
      await store.fetchZones()
    }
    isDeleteDialogOpen.value = false
    deleteTargetId.value = null
  } catch (err) {
    const e = err as { message?: string }
    toast.error(e.message || 'Failed to delete')
  } finally {
    isDeleting.value = false
  }
}

onMounted(loadAll)
</script>

<template>
  <div class="flex flex-col gap-6 max-w-6xl mx-auto w-full">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-3">
          <h1 class="text-2xl sm:text-3xl font-display font-bold text-foreground tracking-tight">Delivery & Logistics</h1>
          <Badge variant="info" class="font-mono text-xs px-2.5 py-0.5">
            {{ totalCouriers }} Couriers / {{ zones.length }} Zones
          </Badge>
        </div>
        <p class="text-xs text-muted-foreground mt-0.5">
          Manage logistics courier partners, delivery coverage zones, shipping rates, and turnaround times.
        </p>
      </div>

      <div class="flex items-center gap-2">
        <Button variant="outline" size="sm" class="h-9 px-3 gap-1.5 text-xs" :disabled="store.loading" @click="loadAll">
          <RefreshCw :size="14" :class="{ 'animate-spin': store.loading }" />
          <span>Refresh</span>
        </Button>
      </div>
    </div>

    <!-- Stat Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <StatCard
        label="Delivery Couriers"
        :value="totalCouriers"
        sub="Connected logistics carriers"
        :icon="Truck"
        icon-variant="primary"
      />
      <StatCard
        label="Active Shipping Zones"
        :value="activeZonesCount"
        sub="Enabled coverage areas"
        :icon="MapPin"
        icon-variant="success"
      />
      <StatCard
        label="Avg. Delivery Fee"
        :value="avgDeliveryFee"
        sub="Standard parcel rate"
        :icon="DollarSign"
        icon-variant="warning"
      />
    </div>

    <!-- Navigation Tabs -->
    <div class="flex border-b border-border gap-2">
      <button
        class="px-4 py-2 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5"
        :class="activeTab === 'companies' ? 'border-cta text-cta' : 'border-transparent text-muted-foreground hover:text-foreground'"
        @click="activeTab = 'companies'"
      >
        <Truck :size="14" />
        <span>Delivery Couriers ({{ companies.length }})</span>
      </button>

      <button
        class="px-4 py-2 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5"
        :class="activeTab === 'zones' ? 'border-cta text-cta' : 'border-transparent text-muted-foreground hover:text-foreground'"
        @click="activeTab = 'zones'"
      >
        <MapPin :size="14" />
        <span>Shipping Zones & Rates ({{ zones.length }})</span>
      </button>
    </div>

    <!-- Tab 1: Companies -->
    <div v-if="activeTab === 'companies'" class="space-y-4">
      <div class="flex justify-end">
        <Button variant="primary" size="sm" class="h-9 px-3.5 gap-1.5" @click="openCompanyCreate">
          <Plus :size="15" />
          <span>Add Courier</span>
        </Button>
      </div>

      <div class="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
        <div v-if="store.loading" class="p-6 space-y-3">
          <Skeleton v-for="i in 3" :key="i" class="h-10 w-full" />
        </div>

        <EmptyState
          v-else-if="!companies.length"
          :icon="Truck"
          title="No couriers configured"
          description="Add courier companies to handle dispatch and delivery operations."
        >
          <template #action>
            <Button variant="primary" size="sm" class="gap-1.5" @click="openCompanyCreate">
              <Plus :size="15" />
              <span>Add First Courier</span>
            </Button>
          </template>
        </EmptyState>

        <div v-else class="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow class="bg-muted/40">
                <TableHead>Courier Name</TableHead>
                <TableHead class="font-mono">Phone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead class="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="c in companies" :key="c.id" class="hover:bg-surface-subtle/80 transition-colors">
                <TableCell class="font-semibold text-foreground flex items-center gap-2">
                  <Truck :size="15" class="text-primary flex-shrink-0" />
                  <span>{{ c.name }}</span>
                </TableCell>
                <TableCell class="font-mono text-xs text-muted-foreground">
                  {{ c.phone || '—' }}
                </TableCell>
                <TableCell class="text-xs text-muted-foreground">
                  {{ c.email || '—' }}
                </TableCell>
                <TableCell>
                  <Badge :variant="c.is_active ? 'success' : 'neutral'" class="text-[10px] px-2 py-0.5">
                    {{ c.is_active ? 'Active' : 'Inactive' }}
                  </Badge>
                </TableCell>
                <TableCell class="text-right">
                  <div class="flex items-center justify-end gap-1.5">
                    <Button variant="ghost" size="sm" class="h-8 px-2.5 text-xs gap-1" @click="openCompanyEdit(c)">
                      <Edit2 :size="13" />
                      <span>Edit</span>
                    </Button>
                    <Button variant="ghost" size="sm" class="h-8 px-2 text-xs text-destructive hover:bg-destructive/10" @click="confirmDeleteCompany(c.id)">
                      <Trash2 :size="14" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>
    </div>

    <!-- Tab 2: Zones -->
    <div v-if="activeTab === 'zones'" class="space-y-4">
      <div class="flex justify-end">
        <Button variant="primary" size="sm" class="h-9 px-3.5 gap-1.5" @click="openZoneCreate">
          <Plus :size="15" />
          <span>Add Shipping Zone</span>
        </Button>
      </div>

      <div class="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
        <div v-if="store.loading" class="p-6 space-y-3">
          <Skeleton v-for="i in 3" :key="i" class="h-10 w-full" />
        </div>

        <EmptyState
          v-else-if="!zones.length"
          :icon="MapPin"
          title="No delivery zones configured"
          description="Add regional delivery coverage zones and base delivery fees."
        >
          <template #action>
            <Button variant="primary" size="sm" class="gap-1.5" @click="openZoneCreate">
              <Plus :size="15" />
              <span>Add First Zone</span>
            </Button>
          </template>
        </EmptyState>

        <div v-else class="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow class="bg-muted/40">
                <TableHead>Courier Partner</TableHead>
                <TableHead>Coverage Zone</TableHead>
                <TableHead class="font-mono">Delivery Fee</TableHead>
                <TableHead class="font-mono">Turnaround</TableHead>
                <TableHead>Status</TableHead>
                <TableHead class="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="z in zones" :key="z.id" class="hover:bg-surface-subtle/80 transition-colors">
                <TableCell class="text-xs font-semibold text-foreground">
                  {{ z.company_name || z.company_id }}
                </TableCell>
                <TableCell class="font-semibold text-foreground flex items-center gap-1.5">
                  <MapPin :size="14" class="text-primary flex-shrink-0" />
                  <span>{{ z.zone_name }}</span>
                </TableCell>
                <TableCell class="font-mono text-sm font-bold text-primary tabular-nums">
                  ${{ parseFloat(String(z.fee)).toFixed(2) }}
                </TableCell>
                <TableCell class="font-mono text-xs text-muted-foreground tabular-nums">
                  {{ z.estimated_days }} days
                </TableCell>
                <TableCell>
                  <Badge :variant="z.is_active ? 'success' : 'neutral'" class="text-[10px] px-2 py-0.5">
                    {{ z.is_active ? 'Active' : 'Inactive' }}
                  </Badge>
                </TableCell>
                <TableCell class="text-right">
                  <div class="flex items-center justify-end gap-1.5">
                    <Button variant="ghost" size="sm" class="h-8 px-2.5 text-xs gap-1" @click="openZoneEdit(z)">
                      <Edit2 :size="13" />
                      <span>Edit</span>
                    </Button>
                    <Button variant="ghost" size="sm" class="h-8 px-2 text-xs text-destructive hover:bg-destructive/10" @click="confirmDeleteZone(z.id)">
                      <Trash2 :size="14" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>
    </div>

    <!-- Company Modal Dialog -->
    <Dialog :open="showCompanyModal" @update:open="(val) => showCompanyModal = val">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle class="font-display">{{ editingCompany?.id ? 'Edit Courier' : 'Add Courier' }}</DialogTitle>
          <DialogDescription>
            Configure courier provider name, dispatch contact number, and email.
          </DialogDescription>
        </DialogHeader>

        <div v-if="editingCompany" class="flex flex-col gap-3 py-2">
          <div>
            <label class="block text-xs font-semibold text-foreground mb-1">Company Name *</label>
            <Input v-model="editingCompany.name" placeholder="e.g. J&T Express, Grab Express" class="h-9 bg-surface text-sm" />
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-semibold text-foreground mb-1">Phone Number</label>
              <Input v-model="editingCompany.phone" placeholder="+855 12 345 678" class="h-9 bg-surface text-sm font-mono" />
            </div>

            <div>
              <label class="block text-xs font-semibold text-foreground mb-1">Email</label>
              <Input v-model="editingCompany.email" placeholder="dispatch@courier.com" class="h-9 bg-surface text-sm" />
            </div>
          </div>

          <div class="flex items-center justify-between pt-2 border-t border-border">
            <div>
              <span class="text-xs font-semibold text-foreground block">Active Courier</span>
              <span class="text-[11px] text-muted-foreground">Enabled for order shipment routing</span>
            </div>
            <Switch
              :checked="editingCompany.is_active"
              @update:checked="(val) => editingCompany!.is_active = val"
            />
          </div>
        </div>

        <DialogFooter class="gap-2 sm:gap-0 mt-4">
          <Button variant="outline" @click="showCompanyModal = false">Cancel</Button>
          <Button variant="primary" @click="saveCompany">Save Courier</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Zone Modal Dialog -->
    <Dialog :open="showZoneModal" @update:open="(val) => showZoneModal = val">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle class="font-display">{{ editingZone?.id ? 'Edit Delivery Zone' : 'Add Delivery Zone' }}</DialogTitle>
          <DialogDescription>
            Configure regional coverage zone, base delivery fee, and turnaround estimation.
          </DialogDescription>
        </DialogHeader>

        <div v-if="editingZone" class="flex flex-col gap-3 py-2">
          <div>
            <label class="block text-xs font-semibold text-foreground mb-1">Courier Partner *</label>
            <select
              v-model="editingZone.company_id"
              class="w-full h-9 px-3 text-xs bg-surface border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-cta/30 focus:border-cta"
            >
              <option v-for="c in companies" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
          </div>

          <div>
            <label class="block text-xs font-semibold text-foreground mb-1">Zone Name *</label>
            <Input v-model="editingZone.zone_name" placeholder="e.g. Phnom Penh Central, Provinces" class="h-9 bg-surface text-sm" />
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-semibold text-foreground mb-1">Delivery Fee ($) *</label>
              <Input v-model.number="editingZone.fee" type="number" step="0.01" min="0" class="h-9 bg-surface text-sm font-mono" />
            </div>

            <div>
              <label class="block text-xs font-semibold text-foreground mb-1">Est. Days</label>
              <Input v-model="editingZone.estimated_days" placeholder="1-2" class="h-9 bg-surface text-sm font-mono" />
            </div>
          </div>

          <div class="flex items-center justify-between pt-2 border-t border-border">
            <div>
              <span class="text-xs font-semibold text-foreground block">Active Zone</span>
              <span class="text-[11px] text-muted-foreground">Available at POS checkout</span>
            </div>
            <Switch
              :checked="editingZone.is_active"
              @update:checked="(val) => editingZone!.is_active = val"
            />
          </div>
        </div>

        <DialogFooter class="gap-2 sm:gap-0 mt-4">
          <Button variant="outline" @click="showZoneModal = false">Cancel</Button>
          <Button variant="primary" @click="saveZone">Save Zone</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Delete Confirmation Dialog -->
    <Dialog :open="isDeleteDialogOpen" @update:open="(val) => { isDeleteDialogOpen = val; if (!val) cancelDelete(); }">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle class="text-destructive font-display">Confirm Deletion</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this {{ deleteTargetType === 'company' ? 'courier company' : 'delivery zone' }}? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter class="gap-2 sm:gap-0 mt-4">
          <Button variant="outline" :disabled="isDeleting" @click="cancelDelete">
            Cancel
          </Button>
          <Button variant="destructive" :disabled="isDeleting" @click="executeDelete">
            <span v-if="isDeleting" class="animate-spin mr-1.5">⏳</span>
            <span>{{ isDeleting ? 'Deleting…' : 'Delete' }}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
