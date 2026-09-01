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
  Star,
  CheckCircle2,
  Layers,
  Sparkles,
} from 'lucide-vue-next'
import SocialPlatformIcon, { getPlatformMeta } from '@/components/pos/SocialPlatformIcon.vue'
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
  SelectField,
} from '@/components/ui'

const salesChannelStore = useSalesChannelStore()

const search = ref('')
const filterType = ref('ALL')

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

const platformOptions = [
  { label: 'Store POS', value: 'pos' },
  { label: 'Facebook', value: 'facebook' },
  { label: 'TikTok Live', value: 'tiktok' },
  { label: 'Telegram', value: 'telegram' },
  { label: 'Instagram', value: 'instagram' },
  { label: 'WhatsApp', value: 'whatsapp' },
  { label: 'LINE', value: 'line' },
  { label: 'Shopee', value: 'shopee' },
  { label: 'Lazada', value: 'lazada' },
  { label: 'Webstore', value: 'web' },
  { label: 'Wholesale / B2B', value: 'wholesale' },
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
const activeChannels = computed(() => salesChannelStore.salesChannels.filter(c => c.is_active !== false).length)
const platformCount = computed(() => new Set(salesChannelStore.salesChannels.map(c => c.platform || c.type || 'pos')).size)

const filteredChannels = computed(() => {
  let list = salesChannelStore.salesChannels || []

  if (filterType.value === 'ACTIVE') {
    list = list.filter(c => c.is_active !== false)
  } else if (filterType.value === 'INACTIVE') {
    list = list.filter(c => c.is_active === false)
  } else if (filterType.value === 'SOCIAL') {
    const socialSet = new Set(['facebook', 'tiktok', 'telegram', 'instagram', 'whatsapp', 'line'])
    list = list.filter(c => socialSet.has((c.platform || c.type || '').toLowerCase()))
  } else if (filterType.value === 'POS_ONLINE') {
    const posSet = new Set(['pos', 'web', 'online', 'website', 'shopee', 'lazada', 'wholesale', 'b2b'])
    list = list.filter(c => posSet.has((c.platform || c.type || '').toLowerCase()))
  }

  if (search.value.trim()) {
    const q = search.value.trim().toLowerCase()
    list = list.filter(c =>
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.code && c.code.toLowerCase().includes(q)) ||
      (c.platform && c.platform.toLowerCase().includes(q)) ||
      (c.type && c.type.toLowerCase().includes(q))
    )
  }

  return list
})

async function loadSalesChannels() {
  await salesChannelStore.fetchSalesChannels({ include_inactive: true })
}

function onSearchInput() {
  // instant client-side filter via computed filteredChannels
}

function onFilterChange(tab: string) {
  filterType.value = tab
}

const editingChannel = ref<SalesChannel | null>(null)
const isCodeCustomized = ref(false)

function generateCodeFromName(name: string, platform: string): string {
  const prefixMap: Record<string, string> = {
    pos: 'POS',
    facebook: 'FB',
    tiktok: 'TT',
    telegram: 'TG',
    instagram: 'IG',
    whatsapp: 'WA',
    line: 'LN',
    shopee: 'SP',
    lazada: 'LZ',
    web: 'WEB',
    online: 'WEB',
    wholesale: 'B2B',
  }
  const prefix = prefixMap[(platform || 'pos').toLowerCase()] || (platform || 'POS').substring(0, 3).toUpperCase()
  const slug = name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return slug ? `${prefix}-${slug}` : prefix
}

function onNameOrPlatformInput() {
  if (!isCodeCustomized.value && form.value.name.trim()) {
    form.value.code = generateCodeFromName(form.value.name, form.value.platform)
  }
}

function regenerateCode() {
  isCodeCustomized.value = false
  form.value.code = generateCodeFromName(form.value.name, form.value.platform)
}

function openCreateModal() {
  editingChannel.value = null
  isCodeCustomized.value = false
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
  isCodeCustomized.value = Boolean(channel.code)
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

  // Same-platform uniqueness validation check:
  // Names can be identical across different platforms (e.g. Facebook vs TikTok), but must be unique within the same platform.
  const normalizedName = form.value.name.trim().toLowerCase()
  const normalizedPlatform = (form.value.platform || 'pos').toLowerCase()

  const existingOnSamePlatform = salesChannelStore.salesChannels.find(
    (c) =>
      c.name.trim().toLowerCase() === normalizedName &&
      (c.platform || c.type || 'pos').toLowerCase() === normalizedPlatform &&
      c.id !== editingChannel.value?.id
  )

  if (existingOnSamePlatform) {
    const meta = getPlatformMeta(form.value.platform)
    formError.value = `A sales channel named "${form.value.name.trim()}" already exists on the ${meta.label} platform. Channel names can be identical across different platforms, but must be unique within the same platform.`
    return
  }

  // Ensure code is populated if blank
  const finalCode = form.value.code.trim() || generateCodeFromName(form.value.name, form.value.platform)

  try {
    if (editingChannel.value) {
      await salesChannelStore.updateSalesChannel(editingChannel.value.id, {
        name: form.value.name.trim(),
        platform: form.value.platform as SalesChannel['platform'],
        code: finalCode,
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
        code: finalCode,
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

      <div class="flex items-center gap-2 flex-wrap">
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
      <div class="inline-flex items-center gap-1 p-1 bg-surface-subtle border border-border rounded-lg flex-wrap">
        <button
          v-for="t in filterTabs"
          :key="t.value"
          type="button"
          class="h-7.5 px-3 rounded-md text-xs font-medium transition-colors cursor-pointer select-none"
          :class="filterType === t.value ? 'bg-cta text-white font-semibold shadow-xs' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'"
          @click="onFilterChange(t.value)"
        >
          {{ t.label }}
        </button>
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
        v-else-if="!filteredChannels.length"
        :icon="Share2"
        :title="salesChannelStore.salesChannels.length ? 'No channels match filters' : 'No sales channels found'"
        :description="salesChannelStore.salesChannels.length ? 'Try selecting a different filter tab or clearing your search.' : 'No channels configured yet. Add your first sales channel to begin.'"
      >
        <template #action>
          <Button v-if="!salesChannelStore.salesChannels.length" variant="primary" size="sm" class="gap-1.5" @click="openCreateModal">
            <Plus :size="15" />
            <span>Add First Channel</span>
          </Button>
          <Button v-else variant="outline" size="sm" class="gap-1.5" @click="() => { filterType = 'ALL'; search = ''; }">
            <span>Reset Filters</span>
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
            <TableRow v-for="c in filteredChannels" :key="c.id" class="hover:bg-surface-subtle/80 transition-colors">
              <TableCell>
                <div class="flex items-center gap-2.5">
                  <div
                    class="w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 shadow-2xs"
                    :style="{
                      backgroundColor: getPlatformMeta(c.platform, c.name).bg,
                      borderColor: getPlatformMeta(c.platform, c.name).border,
                    }"
                  >
                    <SocialPlatformIcon :platform="c.platform" :name="c.name" :size="18" />
                  </div>
                  <div>
                    <div class="font-semibold text-foreground flex items-center gap-1.5">
                      <span>{{ c.name }}</span>
                      <Badge v-if="c.is_default" variant="success" class="text-[9px] px-1.5 py-0 font-bold font-mono uppercase">Default</Badge>
                    </div>
                  </div>
                </div>
              </TableCell>

              <TableCell>
                <span
                  class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-bold font-mono border"
                  :style="{
                    backgroundColor: getPlatformMeta(c.platform, c.name).badgeBg,
                    borderColor: getPlatformMeta(c.platform, c.name).border,
                    color: getPlatformMeta(c.platform, c.name).badgeText,
                  }"
                >
                  <SocialPlatformIcon :platform="c.platform" :name="c.name" :size="12" />
                  <span>{{ getPlatformMeta(c.platform, c.name).label }}</span>
                </span>
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
                  <Button
                    variant="ghost"
                    size="sm"
                    class="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                    title="Edit Channel"
                    @click="openEditModal(c)"
                  >
                    <Edit2 :size="13" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    class="h-8 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                    title="Delete Channel"
                    @click="confirmDelete(c)"
                  >
                    <Trash2 :size="13" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>

    <!-- Sales Channel Modal Dialog -->
    <Dialog :open="formVisible" @update:open="(val) => !val && closeModal()">
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
            <Input
              v-model="form.name"
              placeholder="e.g. Counter Register #1, TikTok Live, Telegram Shop"
              class="h-9 bg-surface text-sm"
              @input="onNameOrPlatformInput"
            />
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-semibold text-foreground mb-1">Platform</label>
              <SelectField
                v-model="form.platform"
                :options="platformOptions"
                placeholder="Select Platform"
                class="w-full h-9 bg-surface text-xs"
                @change="onNameOrPlatformInput"
              />
            </div>

            <div>
              <div class="flex items-center justify-between mb-1">
                <label class="text-xs font-semibold text-foreground">
                  Channel Code
                  <span class="text-3xs text-muted-foreground font-normal">(Optional)</span>
                </label>
                <button
                  type="button"
                  class="text-3xs text-primary hover:underline font-mono cursor-pointer flex items-center gap-1"
                  title="Auto generate code from name & platform"
                  @click="regenerateCode"
                >
                  <Sparkles :size="10" />
                  <span>Auto</span>
                </button>
              </div>
              <Input
                v-model="form.code"
                placeholder="e.g. POS-01, FB-LIVE"
                class="h-9 bg-surface text-sm font-mono"
                @input="() => isCodeCustomized = true"
              />
            </div>
          </div>
          <p class="text-3xs text-muted-foreground -mt-1">
            Channel code is optional and will be auto-generated if left blank.
          </p>

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