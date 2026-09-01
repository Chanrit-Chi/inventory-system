<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useBankAccountStore, type BankAccount } from '@/stores/bankAccountStore'
import { useToast } from '@/composables/useToast'
import BankBrandIcon from '@/components/pos/BankBrandIcon.vue'
import api from '@/api/axios'
import {
  Building2,
  Plus,
  RefreshCw,
  Edit2,
  Trash2,
  CheckCircle2,
  Wallet,
  Coins,
  Upload,
  X,
  QrCode,
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
  SelectField,
} from '@/components/ui'

const toast = useToast()
const store = useBankAccountStore()

const showEditModal = ref(false)
const editing = ref<Partial<BankAccount> | null>(null)

const isDeleteDialogOpen = ref(false)
const deletingAccountId = ref<string | null>(null)
const isDeleting = ref(false)

const logoFileInputRef = ref<HTMLInputElement | null>(null)
const qrFileInputRef = ref<HTMLInputElement | null>(null)
const isUploadingLogo = ref(false)
const isUploadingQr = ref(false)

const bankColorPresets = [
  { label: 'ABA Blue', hex: '#004F71' },
  { label: 'ACLEDA Navy', hex: '#0B3060' },
  { label: 'Wing Green', hex: '#00A651' },
  { label: 'Canadia Red', hex: '#E31B23' },
  { label: 'Bakong Red', hex: '#E11B22' },
  { label: 'Sathapana Blue', hex: '#003B70' },
  { label: 'Prince Purple', hex: '#6C1D5F' },
  { label: 'Chip Mong Blue', hex: '#195AA5' },
]

const accountTypeOptions = [
  { label: 'Checking', value: 'checking' },
  { label: 'Savings', value: 'savings' },
  { label: 'Corporate / Business', value: 'business' },
]

const currencyOptions = [
  { label: 'USD ($)', value: 'USD' },
  { label: 'KHR (៛)', value: 'KHR' },
  { label: 'Dual Currency (USD/KHR)', value: 'Dual' },
]

const accounts = computed(() => store.accounts)
const totalAccounts = computed(() => accounts.value.length)
const defaultAccount = computed(() => accounts.value.find(a => a.is_default)?.bank_name || 'None Set')
const currencies = computed(() => [...new Set(accounts.value.map(a => a.currency || 'USD'))].join(', ') || 'USD')

async function load() {
  try {
    await store.fetchAccounts()
  } catch (err) {
    const e = err as { message?: string }
    toast.error(e.message || 'Failed to load bank accounts')
  }
}

function openCreate() {
  editing.value = {
    bank_name: '',
    account_name: '',
    account_number: '',
    account_type: 'checking',
    currency: 'USD',
    color: '#004F71',
    is_default: false,
    is_active: true,
    logo_icon: '',
    qr_image_url: '',
  }
  showEditModal.value = true
}

function openEdit(a: BankAccount) {
  editing.value = {
    ...a,
    account_type: a.account_type || 'checking',
    color: a.color || '#004F71',
    is_active: a.is_active !== false,
  }
  showEditModal.value = true
}

function handleLogoInput(val: string | number) {
  if (editing.value) {
    editing.value.logo_icon = String(val ?? '')
  }
}

function handleQrInput(val: string | number) {
  if (editing.value) {
    editing.value.qr_image_url = String(val ?? '')
  }
}

async function handleLogoFileUpload(e: Event) {
  const input = e.target as HTMLInputElement
  if (!input.files || input.files.length === 0) return
  const file = input.files[0]

  // 1. Instant preview using client data URL
  const reader = new FileReader()
  reader.onload = (event) => {
    if (editing.value && event.target?.result) {
      editing.value.logo_icon = event.target.result as string
    }
  }
  reader.readAsDataURL(file)

  // 2. Upload to server media storage
  try {
    isUploadingLogo.value = true
    const formData = new FormData()
    formData.append('image', file)
    formData.append('folder', 'banks')
    const res = await api.post('/media/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    const uploadedUrl = res.data?.data?.url
    if (uploadedUrl && editing.value) {
      editing.value.logo_icon = uploadedUrl
    }
    toast.success('Bank logo uploaded successfully')
  } catch {
    // Fallback stays as base64 data URL
    toast.info('Logo loaded from local image file')
  } finally {
    isUploadingLogo.value = false
    input.value = ''
  }
}

async function handleQrFileUpload(e: Event) {
  const input = e.target as HTMLInputElement
  if (!input.files || input.files.length === 0) return
  const file = input.files[0]

  const reader = new FileReader()
  reader.onload = (event) => {
    if (editing.value && event.target?.result) {
      editing.value.qr_image_url = event.target.result as string
    }
  }
  reader.readAsDataURL(file)

  try {
    isUploadingQr.value = true
    const formData = new FormData()
    formData.append('image', file)
    formData.append('folder', 'qr')
    const res = await api.post('/media/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    const uploadedUrl = res.data?.data?.url
    if (uploadedUrl && editing.value) {
      editing.value.qr_image_url = uploadedUrl
    }
    toast.success('QR image uploaded successfully')
  } catch {
    toast.info('QR image loaded from local file')
  } finally {
    isUploadingQr.value = false
    input.value = ''
  }
}

async function save() {
  if (!editing.value || !editing.value.bank_name?.trim() || !editing.value.account_number?.trim()) {
    toast.error('Bank name and account number are required')
    return
  }
  if (!editing.value.account_name?.trim()) {
    toast.error('Account holder name is required')
    return
  }
  try {
    const logoVal = editing.value.logo_icon || ''
    if (editing.value.bank_name) {
      const bankKey = editing.value.bank_name.toLowerCase().trim()
      if (logoVal) {
        try {
          localStorage.setItem(`bank_logo_${bankKey}`, logoVal)
        } catch {
          // ignore
        }
      }
    }

    if (editing.value.id) {
      await store.updateAccount(editing.value.id, editing.value)
      toast.success('Bank account updated')
    } else {
      await store.createAccount(editing.value)
      toast.success('Bank account created')
    }
    showEditModal.value = false
    await load()
  } catch (err) {
    const e = err as { message?: string }
    toast.error(e.message || 'Failed to save account')
  }
}

function confirmDelete(id: string) {
  deletingAccountId.value = id
  isDeleteDialogOpen.value = true
}

function cancelDelete() {
  deletingAccountId.value = null
  isDeleteDialogOpen.value = false
}

async function executeDelete() {
  if (!deletingAccountId.value) return
  isDeleting.value = true
  try {
    await store.deleteAccount(deletingAccountId.value)
    toast.success('Account deleted')
    isDeleteDialogOpen.value = false
    deletingAccountId.value = null
    await load()
  } catch (err) {
    const e = err as { message?: string }
    toast.error(e.message || 'Failed to delete account')
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
          <h1 class="text-2xl sm:text-3xl font-display font-bold text-foreground tracking-tight">Bank Accounts</h1>
          <Badge variant="info" class="font-mono text-xs px-2.5 py-0.5">
            {{ totalAccounts }} Accounts
          </Badge>
        </div>
        <p class="text-xs text-muted-foreground mt-0.5">
          Designated bank accounts for customer invoice settlements, ABA PayWay funds, and vendor wire payouts.
        </p>
      </div>

      <div class="flex items-center gap-2 flex-wrap">
        <Button variant="outline" size="sm" class="h-9 px-3 gap-1.5 text-xs" :disabled="store.loading" @click="load">
          <RefreshCw :size="14" :class="{ 'animate-spin': store.loading }" />
          <span>Refresh</span>
        </Button>
        <Button variant="primary" size="sm" class="h-9 px-3.5 gap-1.5" @click="openCreate">
          <Plus :size="15" />
          <span>Add Account</span>
        </Button>
      </div>
    </div>

    <!-- Stat Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <StatCard
        label="Total Bank Accounts"
        :value="totalAccounts"
        sub="Connected financial accounts"
        :icon="Building2"
        icon-variant="primary"
      />
      <StatCard
        label="Default Primary Account"
        :value="defaultAccount"
        sub="Used for invoice settlements"
        :icon="Wallet"
        icon-variant="success"
      />
      <StatCard
        label="Supported Currencies"
        :value="currencies"
        sub="Settlement denominations"
        :icon="Coins"
        icon-variant="warning"
      />
    </div>

    <!-- Accounts Table Container -->
    <div class="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
      <div v-if="store.loading" class="p-6 space-y-3">
        <Skeleton v-for="i in 3" :key="i" class="h-12 w-full" />
      </div>

      <EmptyState
        v-else-if="!accounts.length"
        :icon="Building2"
        title="No bank accounts configured"
        description="Add company bank accounts to associate with customer invoices and payouts."
      >
        <template #action>
          <Button variant="primary" size="sm" class="gap-1.5" @click="openCreate">
            <Plus :size="15" />
            <span>Add First Account</span>
          </Button>
        </template>
      </EmptyState>

      <div v-else class="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow class="bg-muted/40">
              <TableHead>Bank Institution</TableHead>
              <TableHead>Account Holder</TableHead>
              <TableHead class="font-mono">Account #</TableHead>
              <TableHead>Type</TableHead>
              <TableHead class="font-mono">Currency</TableHead>
              <TableHead>Default</TableHead>
              <TableHead class="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="a in accounts" :key="a.id" class="hover:bg-surface-subtle/80 transition-colors">
              <TableCell class="font-semibold text-foreground flex items-center gap-2.5">
                <BankBrandIcon :bank-name="a.bank_name" :logo-url="a.logo_icon" :size="20" />
                <span>{{ a.bank_name }}</span>
              </TableCell>
              <TableCell class="text-xs text-foreground">
                {{ a.account_name }}
              </TableCell>
              <TableCell class="font-mono text-xs text-primary font-semibold">
                {{ a.account_number }}
              </TableCell>
              <TableCell class="text-xs text-muted-foreground capitalize">
                {{ a.account_type }}
              </TableCell>
              <TableCell class="font-mono text-xs text-foreground font-semibold">
                {{ a.currency }}
              </TableCell>
              <TableCell>
                <Badge v-if="a.is_default" variant="success" class="text-[10px] px-2 py-0.5 gap-1">
                  <CheckCircle2 :size="11" />
                  <span>Default</span>
                </Badge>
                <span v-else class="text-muted-foreground text-xs">—</span>
              </TableCell>
              <TableCell class="text-right">
                <div class="flex items-center justify-end gap-1.5">
                  <Button variant="ghost" size="sm" class="h-8 px-2.5 text-xs gap-1" @click="openEdit(a)">
                    <Edit2 :size="13" />
                    <span>Edit</span>
                  </Button>
                  <Button variant="ghost" size="sm" class="h-8 px-2 text-xs text-destructive hover:bg-destructive/10" @click="confirmDelete(a.id)">
                    <Trash2 :size="14" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>

    <!-- Account Modal Dialog -->
    <Dialog :open="showEditModal" @update:open="(val) => showEditModal = val">
      <DialogContent class="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle class="font-display">{{ editing?.id ? 'Edit Bank Account' : 'Add Bank Account' }}</DialogTitle>
          <DialogDescription>
            Configure bank institution name, custom logo, account details, and payment settlement options.
          </DialogDescription>
        </DialogHeader>

        <!-- Hidden File Inputs -->
        <input
          type="file"
          ref="logoFileInputRef"
          accept="image/png,image/jpeg,image/svg+xml,image/webp"
          class="hidden"
          @change="handleLogoFileUpload"
        />
        <input
          type="file"
          ref="qrFileInputRef"
          accept="image/png,image/jpeg,image/svg+xml,image/webp"
          class="hidden"
          @change="handleQrFileUpload"
        />

        <div v-if="editing" class="flex flex-col gap-4 py-2">
          <!-- 1. Bank Brand Logo Upload Section -->
          <div class="p-3 rounded-xl border border-border bg-surface-subtle/50 space-y-2">
            <label class="block text-xs font-semibold text-foreground">Bank Brand Logo</label>
            <div class="flex items-center gap-3">
              <!-- Live Preview -->
              <div class="relative shrink-0">
                <BankBrandIcon
                  :bank-name="editing.bank_name"
                  :logo-url="editing.logo_icon"
                  :size="26"
                />
              </div>

              <!-- Upload Button & Direct URL Input -->
              <div class="flex-1 flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  class="h-9 px-3 gap-1.5 text-xs shrink-0 cursor-pointer"
                  :disabled="isUploadingLogo"
                  @click="logoFileInputRef?.click()"
                >
                  <Upload :size="13" :class="{ 'animate-bounce': isUploadingLogo }" />
                  <span>{{ isUploadingLogo ? 'Uploading…' : 'Upload Logo' }}</span>
                </Button>

                <Input
                  :model-value="editing.logo_icon"
                  placeholder="Or paste Logo Image URL (https://...)"
                  class="h-9 bg-surface text-xs flex-1"
                  @update:model-value="handleLogoInput"
                />

                <Button
                  v-if="editing.logo_icon"
                  type="button"
                  variant="ghost"
                  size="sm"
                  class="h-9 px-2 text-muted-foreground hover:text-destructive shrink-0"
                  title="Clear custom logo"
                  @click="editing.logo_icon = ''"
                >
                  <X :size="14" />
                </Button>
              </div>
            </div>
            <p class="text-[10px] text-muted-foreground">
              Upload PNG/SVG/JPG, or leave empty to auto-detect ABA, ACLEDA, Wing, Canadia, Bakong, Sathapana, Prince, Chip Mong.
            </p>
          </div>

          <!-- 2. Bank Name & Account Holder -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-semibold text-foreground mb-1">Bank Name *</label>
              <Input v-model="editing.bank_name" placeholder="e.g. ABA Bank, ACLEDA Bank" class="h-9 bg-surface text-sm" />
            </div>

            <div>
              <label class="block text-xs font-semibold text-foreground mb-1">Account Holder Name *</label>
              <Input v-model="editing.account_name" placeholder="e.g. OMNIPOS RETAIL CO., LTD." class="h-9 bg-surface text-sm" />
            </div>
          </div>

          <!-- 3. Account Number, Type & Currency -->
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label class="block text-xs font-semibold text-foreground mb-1">Account Number *</label>
              <Input v-model="editing.account_number" placeholder="000 123 456" class="h-9 bg-surface text-sm font-mono" />
            </div>

            <div>
              <label class="block text-xs font-semibold text-foreground mb-1">Account Type</label>
              <SelectField
                v-model="editing.account_type"
                :options="accountTypeOptions"
                placeholder="Select Type"
                class="w-full h-9 bg-surface text-xs"
              />
            </div>

            <div>
              <label class="block text-xs font-semibold text-foreground mb-1">Currency</label>
              <SelectField
                v-model="editing.currency"
                :options="currencyOptions"
                placeholder="Select Currency"
                class="w-full h-9 bg-surface text-xs font-mono"
              />
            </div>
          </div>

          <!-- 4. Brand Color Presets -->
          <div class="space-y-1.5">
            <label class="block text-xs font-semibold text-foreground">Brand Color Accent</label>
            <div class="flex items-center gap-2 flex-wrap">
              <button
                v-for="preset in bankColorPresets"
                :key="preset.hex"
                type="button"
                @click="editing.color = preset.hex"
                :class="[
                  'px-2 py-1 rounded-md text-[11px] font-semibold border flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs',
                  editing.color === preset.hex
                    ? 'border-primary ring-2 ring-primary/25 text-foreground bg-surface'
                    : 'border-border text-muted-foreground bg-surface-subtle hover:text-foreground'
                ]"
              >
                <span class="w-3 h-3 rounded-full shrink-0" :style="{ backgroundColor: preset.hex }"></span>
                <span>{{ preset.label }}</span>
              </button>
            </div>
          </div>

          <!-- 5. Optional KHQR / Payment QR Image Upload -->
          <div class="p-3 rounded-xl border border-border bg-surface-subtle/30 space-y-2">
            <div class="flex items-center justify-between">
              <label class="block text-xs font-semibold text-foreground flex items-center gap-1.5">
                <QrCode :size="13" class="text-primary" />
                <span>Customer Payment QR Code (Optional)</span>
              </label>
              <span class="text-[10px] text-muted-foreground">For KHQR scan slips</span>
            </div>

            <div class="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                class="h-9 px-3 gap-1.5 text-xs shrink-0 cursor-pointer"
                :disabled="isUploadingQr"
                @click="qrFileInputRef?.click()"
              >
                <Upload :size="13" :class="{ 'animate-bounce': isUploadingQr }" />
                <span>{{ isUploadingQr ? 'Uploading…' : 'Upload QR' }}</span>
              </Button>

              <Input
                :model-value="editing.qr_image_url"
                placeholder="Or paste QR Image URL (https://...)"
                class="h-9 bg-surface text-xs flex-1"
                @update:model-value="handleQrInput"
              />

              <Button
                v-if="editing.qr_image_url"
                type="button"
                variant="ghost"
                size="sm"
                class="h-9 px-2 text-muted-foreground hover:text-destructive shrink-0"
                title="Clear QR image"
                @click="editing.qr_image_url = ''"
              >
                <X :size="14" />
              </Button>
            </div>
          </div>

          <!-- 6. Account Status Toggles -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border">
            <div class="flex items-center justify-between p-2 rounded-lg border border-border bg-surface">
              <div>
                <span class="text-xs font-semibold text-foreground block">Default Account</span>
                <span class="text-[10px] text-muted-foreground">Primary account for POS & Invoices</span>
              </div>
              <Switch
                :checked="editing.is_default"
                @update:checked="(val) => editing!.is_default = val"
              />
            </div>

            <div class="flex items-center justify-between p-2 rounded-lg border border-border bg-surface">
              <div>
                <span class="text-xs font-semibold text-foreground block">Active Status</span>
                <span class="text-[10px] text-muted-foreground">Visible at POS checkout</span>
              </div>
              <Switch
                :checked="editing.is_active"
                @update:checked="(val) => editing!.is_active = val"
              />
            </div>
          </div>
        </div>

        <DialogFooter class="gap-2 sm:gap-0 mt-4">
          <Button variant="outline" @click="showEditModal = false">Cancel</Button>
          <Button variant="primary" @click="save">Save Bank Account</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Delete Confirmation Dialog -->
    <Dialog :open="isDeleteDialogOpen" @update:open="(val) => { isDeleteDialogOpen = val; if (!val) cancelDelete(); }">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle class="text-destructive font-display">Confirm Account Deletion</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this bank account? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter class="gap-2 sm:gap-0 mt-4">
          <Button variant="outline" :disabled="isDeleting" @click="cancelDelete">
            Cancel
          </Button>
          <Button variant="destructive" :disabled="isDeleting" @click="executeDelete">
            <span v-if="isDeleting" class="animate-spin mr-1.5">⏳</span>
            <span>{{ isDeleting ? 'Deleting…' : 'Delete Account' }}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
