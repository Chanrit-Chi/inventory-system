<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useSalesChannelStore, type SalesChannel } from '@/stores/salesChannelStore'
import {
  Share2,
  Plus,
  Search,
  RefreshCw,
  Edit2,
  Trash2,
  Globe,
  Store,
  MessageCircle,
  Instagram,
  Facebook,
  Music2,
  Smartphone,
  Star,
  CheckCircle2,
  Layers,
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
  Alert,
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  EmptyState,
  Skeleton,
} from '@/components/ui'

const salesChannelStore = useSalesChannelStore()

const search = ref('')
const filterType = ref('ALL')
const page = ref(1)

const isDeleteDialogOpen = ref(false)
const deletingChannel = ref<SalesChannel | null>(null)
const isDeleting = ref(false)

const filterTabs = [
  { label: 'All', value: 'ALL' },
  { label: 'Social Media', value: 'SOCIAL' },
  { label: 'POS & Web', value: 'POS_ONLINE' },
  { label: 'Active Only', value: 'ACTIVE' },
  { label: 'Inactive Only', value: 'INACTIVE' }
]

const formVisible = ref(false)
const formError = ref('')
const formSuccess = ref('')

const form = ref({
  name: '',
  platform: 'pos',
  code: '',
  type: '',
  image_url: '',
  is_active: true,
  is_default: false
})

const totalChannels = computed(() => salesChannelStore.salesChannels.length)
const activeChannels = computed(() => salesChannelStore.salesChannels.filter(c => c.is_active).length)
const platformCount = computed(() => new Set(salesChannelStore.salesChannels.map(c => c.platform)).size)

async function loadSalesChannels() {
  const params: Record<string, unknown> = {
    page: page.value
  }
  if (search.value.trim()) {
    params.search = search.value.trim()
  }
  if (filterType.value !== 'ALL') {
    params.filter_type = filterType.value
  }

  await salesChannelStore.fetchSalesChannels(params)
}

let searchTimer: ReturnType<typeof setTimeout> | null = null
function onSearchInput() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    page.value = 1
    loadSalesChannels()
  }, 300)
}

function onFilterChange(tab: string) {
  filterType.value = tab
  page.value = 1
  loadSalesChannels()
}

const editingChannel = ref<SalesChannel | null>(null)

function openCreateModal() {
  editingChannel.value = null
  form.value = {
    name: '',
    platform: 'pos',
    code: '',
    type: '',
    image_url: '',
    is_active: true,
    is_default: salesChannelStore.salesChannels.length === 0
  }
  formError.value = ''
  formSuccess.value = ''
  formVisible.value = true
}

function openEditModal(channel: any) {
  editingChannel.value = channel
  form.value = {
    name: channel.name,
    platform: channel.platform,
    code: channel.code || '',
    type: channel.type || channel.platform,
    image_url: channel.image_url || '',
    is_active: channel.is_active,
    is_default: channel.is_default
  }
  formError.value = ''
  formSuccess.value = ''
  formVisible.value = true
}

function closeModal() {
  formVisible.value = false
  editingChannel.value = null
}

async function handleSubmit() {
  formError.value = ''
  formSuccess.value = ''

  if (!form.value.name.trim()) {
    formError.value = 'Channel name is required'
    return
  }

  try {
    if (editingChannel.value) {
      await salesChannelStore.updateSalesChannel(editingChannel.value.id, {
        name: form.value.name.trim(),
        platform: form.value.platform as SalesChannel['platform'],
        code: form.value.code.trim() || undefined,
        type: form.value.type.trim() || form.value.platform,
        image_url: form.value.image_url.trim() || undefined,
        is_active: form.value.is_active,
        is_default: form.value.is_default
      })
      formSuccess.value = 'Channel updated successfully!'
    } else {
      await salesChannelStore.createSalesChannel({
        name: form.value.name.trim(),
        platform: form.value.platform as SalesChannel['platform'],
        code: form.value.code.trim() || undefined,
        type: form.value.type.trim() || form.value.platform,
        image_url: form.value.image_url.trim() || undefined,
        is_active: form.value.is_active,
        is_default: form.value.is_default
      })
      formSuccess.value = 'Channel created successfully!'
    }

    setTimeout(() => {
      closeModal()
      loadSalesChannels()
    }, 1000)
  } catch (e: any) {
    formError.value = e.message || 'Failed to save channel'
  }
}

function getPlatformIcon(platform: string) {
  const p = (platform || '').toLowerCase()
  if (p === 'telegram') return MessageCircle
  if (p === 'facebook') return Facebook
  if (p === 'instagram') return Instagram
  if (p === 'tiktok') return Music2
  if (p === 'web') return Globe
  if (p === 'pos') return Store
  return Smartphone
}

function toggleActive(channel: any) {
  salesChannelStore.updateSalesChannel(channel.id, {
    is_active: !channel.is_active
  }).then(() => {
    loadSalesChannels()
  })
}

function setAsDefault(channel: any) {
  salesChannelStore.updateSalesChannel(channel.id, {
    is_default: true
  }).then(() => {
    loadSalesChannels()
  })
}

function confirmDelete(channel: SalesChannel) {
  deletingChannel.value = channel
  isDeleteDialogOpen.value = true
}

function cancelDelete() {
  deletingChannel.value = null
  isDeleteDialogOpen.value = false
}

async function executeDelete() {
  if (!deletingChannel.value) return
  isDeleting.value = true
  try {
    await salesChannelStore.deleteSalesChannel(deletingChannel.value.id)
    isDeleteDialogOpen.value = false
    deletingChannel.value = null
    await loadSalesChannels()
  } catch {
    // handled
  } finally {
    isDeleting.value = false
  }
}

onMounted(loadSalesChannels)
</script>

<template>
  <div class="flex flex-col gap-6 max-w-6xl mx-auto w-full">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-3">
          <h1 class="text-2xl sm:text-3xl font-display font-bold text-foreground tracking-tight">Sales Channels</h1>
          <Badge variant="info" class="font-mono text-xs px-2.5 py-0.5">
            {{ totalChannels }} Channels
          </Badge>
        </div>
        <p class="text-xs text-muted-foreground mt-0.5">
          Configure omnichannel touchpoints: Store POS, Telegram mini-app, Facebook Shop, TikTok, and Web storefronts.
        </p>
      </div>

      <div class="flex items-center gap-2">
        <Button variant="outline" size="sm" class="h-9 px-3 gap-1.5 text-xs" :disabled="salesChannelStore.loading" @click="loadSalesChannels">
          <RefreshCw :size="14" :class="{ 'animate-spin': salesChannelStore.loading }" />
          <span>Refresh</span>
        </Button>
        <Button variant="primary" size="sm" class="h-9 px-3.5 gap-1.5" @click="openCreateModal">
          <Plus :size="15" />
          <span>Add Channel</span>
        </Button>
      </div>
    </div>

    <!-- Stat Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <StatCard
        label="Total Sales Channels"
        :value="totalChannels"
        sub="Connected sales touchpoints"
        :icon="Share2"
        icon-variant="primary"
      />
      <StatCard
        label="Active Channels"
        :value="activeChannels"
        sub="Enabled order routing"
        :icon="CheckCircle2"
        icon-variant="success"
      />
      <StatCard
        label="Integrated Platforms"
        :value="platformCount"
        sub="POS, Web & Social channels"
        :icon="Layers"
        icon-variant="warning"
      />
    </div>

    <!-- Filter Bar & Tabs -->
    <div class="rounded-xl border border-border bg-card p-3.5 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
      <div class="flex items-center gap-1.5 flex-wrap">
        <Button
          v-for="t in filterTabs"
          :key="t.value"
          :variant="filterType === t.value ? 'primary' : 'ghost'"
          size="sm"
          class="h-9 px-3.5 text-xs font-medium"
          @click="onFilterChange(t.value)"
        >
          {{ t.label }}
        </Button>
      </div>

      <div class="min-w-[240px]">
        <Input
          v-model="search"
          type="text"
          placeholder="Search channels…"
          class="bg-surface"
          @input="onSearchInput"
        >
          <template #prefix>
            <Search :size="15" />
          </template>
        </Input>
      </div>
    </div>

    <!-- Sales Channels Table Container -->
    <div class="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
      <div v-if="salesChannelStore.loading" class="p-6 space-y-3">
        <Skeleton v-for="i in 3" :key="i" class="h-12 w-full" />
      </div>

      <EmptyState
        v-else-if="!salesChannelStore.salesChannels.length"
        :icon="Share2"
        title="No sales channels found"
        description="No channels configured or match the filter parameters."
      >
        <template #action>
          <Button variant="primary" size="sm" class="gap-1.5" @click="openCreateModal">
            <Plus :size="15" />
            <span>Add First Channel</span>
          </Button>
        </template>
      </EmptyState>

      <div v-else class="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow class="bg-muted/40">
              <TableHead>Sales Channel</TableHead>
              <TableHead>Platform</TableHead>
              <TableHead class="font-mono">Code</TableHead>
              <TableHead>Type</TableHead>
              <TableHead class="text-center">Status</TableHead>
              <TableHead class="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="c in salesChannelStore.salesChannels" :key="c.id" class="hover:bg-surface-subtle/80 transition-colors">
              <TableCell>
                <div class="flex items-center gap-2.5">
                  <div class="w-8 h-8 rounded-lg bg-primary/10 text-primary border border-primary/20 flex items-center justify-center flex-shrink-0">
                    <component :is="getPlatformIcon(c.platform)" :size="16" />
                  </div>
                  <div>
                    <div class="font-semibold text-foreground flex items-center gap-1.5">
                      <span>{{ c.name }}</span>
                      <Badge v-if="c.is_default" variant="success" class="text-[9px] px-1 py-0">Default</Badge>
                    </div>
                  </div>
                </div>
              </TableCell>

              <TableCell class="text-xs capitalize text-muted-foreground">
                {{ c.platform }}
              </TableCell>

              <TableCell class="font-mono text-xs text-primary font-semibold">
                {{ c.code || '—' }}
              </TableCell>

              <TableCell>
                <Badge variant="neutral" class="text-[10px] px-2 py-0.5 uppercase">
                  {{ c.type || c.platform }}
                </Badge>
              </TableCell>

              <TableCell class="text-center">
                <Switch
                  :checked="c.is_active"
                  @update:checked="() => toggleActive(c)"
                />
              </TableCell>

              <TableCell class="text-right">
                <div class="flex items-center justify-end gap-1.5">
                  <Button
                    v-if="!c.is_default"
                    variant="ghost"
                    size="sm"
                    class="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                    title="Set as Default"
                    @click="setAsDefault(c)"
                  >
                    <Star :size="13" />
                  </Button>
                  <Button variant="ghost" size="sm" class="h-8 px-2.5 text-xs gap-1" @click="openEditModal(c)">
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

    <!-- Sales Channel Modal Dialog -->
    <Dialog :open="formVisible" @update:open="(val) => { if (!val) closeModal(); }">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle class="font-display">{{ editingChannel ? 'Edit Sales Channel' : 'Create Sales Channel' }}</DialogTitle>
          <DialogDescription>
            Configure channel identity, integration platform, and active checkout routing.
          </DialogDescription>
        </DialogHeader>

        <Alert v-if="formError" variant="error">
          {{ formError }}
        </Alert>
        <Alert v-if="formSuccess" variant="success">
          {{ formSuccess }}
        </Alert>

        <div class="flex flex-col gap-3 py-2">
          <div>
            <label class="block text-xs font-semibold text-foreground mb-1">Channel Name *</label>
            <Input v-model="form.name" placeholder="e.g. Counter Register #1, Telegram Shop" class="h-9 bg-surface text-sm" />
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-semibold text-foreground mb-1">Platform</label>
              <select
                v-model="form.platform"
                class="w-full h-9 px-3 text-xs bg-surface border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-cta/30 focus:border-cta"
              >
                <option value="pos">Store POS</option>
                <option value="telegram">Telegram Mini-App</option>
                <option value="facebook">Facebook Shop</option>
                <option value="instagram">Instagram Direct</option>
                <option value="tiktok">TikTok Store</option>
                <option value="web">Web Storefront</option>
              </select>
            </div>

            <div>
              <label class="block text-xs font-semibold text-foreground mb-1">Channel Code</label>
              <Input v-model="form.code" placeholder="POS-01" class="h-9 bg-surface text-sm font-mono" />
            </div>
          </div>

          <div class="flex items-center justify-between pt-2 border-t border-border">
            <div>
              <span class="text-xs font-semibold text-foreground block">Active Channel</span>
              <span class="text-[11px] text-muted-foreground">Accepts incoming orders</span>
            </div>
            <Switch
              :checked="form.is_active"
              @update:checked="(val) => form.is_active = val"
            />
          </div>

          <div class="flex items-center justify-between pt-2 border-t border-border">
            <div>
              <span class="text-xs font-semibold text-foreground block">Default Channel</span>
              <span class="text-[11px] text-muted-foreground">Primary checkout fallback</span>
            </div>
            <Switch
              :checked="form.is_default"
              @update:checked="(val) => form.is_default = val"
            />
          </div>
        </div>

        <DialogFooter class="gap-2 sm:gap-0 mt-4">
          <Button variant="outline" @click="closeModal">Cancel</Button>
          <Button variant="primary" @click="handleSubmit">
            {{ editingChannel ? 'Update Channel' : 'Create Channel' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Delete Confirmation Dialog -->
    <Dialog :open="isDeleteDialogOpen" @update:open="(val) => { isDeleteDialogOpen = val; if (!val) cancelDelete(); }">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle class="text-destructive font-display">Confirm Channel Deletion</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete sales channel <strong>"{{ deletingChannel?.name }}"</strong>? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter class="gap-2 sm:gap-0 mt-4">
          <Button variant="outline" :disabled="isDeleting" @click="cancelDelete">
            Cancel
          </Button>
          <Button variant="destructive" :disabled="isDeleting" @click="executeDelete">
            <span v-if="isDeleting" class="animate-spin mr-1.5">⏳</span>
            <span>{{ isDeleting ? 'Deleting…' : 'Delete Channel' }}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>