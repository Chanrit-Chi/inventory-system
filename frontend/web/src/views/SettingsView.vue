<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useToast } from '@/composables/useToast'
import api from '@/api/axios'
import {
  Palette,
  Printer,
  Activity,
  User,
  Plus,
  RefreshCw,
  Edit2,
  Trash2,
  Key,
  LogOut,
  Image as ImageIcon,
  Database,
  Server,
  Sun,
  Moon,
  Laptop,
  Check,
} from 'lucide-vue-next'
import { useThemeStore } from '@/stores/themeStore'
import {
  Button,
  Badge,
  Input,
  Switch,
  StatCard,
  Card,
  Alert,
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  EmptyState,
  Skeleton,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui'

// ============================================================================
// Types
// ============================================================================
const toast = useToast()

const showDeletePrinterDialog = ref(false)
const printerToDelete = ref<PrinterDevice | null>(null)
const showLogoutDialog = ref(false)

interface StoreBranding {
  store_name: string
  tagline?: string
  logo_url?: string
  store_address?: string
  store_phone?: string
  primary_color?: string
  receipt_header?: string
  invoice_header?: string
  quotation_header?: string
  receipt_footer?: string
  include_tax?: boolean
}

interface PrinterDevice {
  id: string
  name: string
  connectionType: 'wifi' | 'bluetooth'
  ipAddress: string
  port: number
  bluetoothName?: string
  paperWidth: '80mm' | '58mm'
  role: 'receipt' | 'kitchen'
  isDefault: boolean
  autoCut: boolean
}

interface HealthStatus {
  connected: boolean
  status: string
  version: string
  app: string
  database: string
  latency: string
}

interface CurrentUser {
  id: string
  name: string
  email: string
  role: string
}

const themeStore = useThemeStore()

type TabKey = 'branding' | 'printers' | 'diagnostics' | 'account'

// ============================================================================
// Tabs
// ============================================================================
const activeTab = ref<TabKey>('branding')
const tabs = [
  { key: 'branding' as TabKey, label: 'Branding & Appearance', icon: Palette },
  { key: 'printers' as TabKey, label: 'Thermal Printers', icon: Printer },
  { key: 'diagnostics' as TabKey, label: 'Diagnostics', icon: Activity },
  { key: 'account' as TabKey, label: 'Account', icon: User },
]

// ============================================================================
// Store Branding State
// ============================================================================
const brandingLoading = ref(false)
const brandingSaving = ref(false)
const brandingError = ref('')
const brandingSuccess = ref('')

const brandStoreName = ref('')
const brandTagline = ref('')
const brandAddress = ref('')
const brandPhone = ref('')
const brandPrimaryColor = ref('#924c00')
const brandReceiptHeader = ref('')
const brandInvoiceHeader = ref('')
const brandQuotationHeader = ref('')
const brandReceiptFooter = ref('')
const brandIncludeTax = ref(false)

const logoFile = ref<File | null>(null)
const logoPreview = ref<string | null>(null)
const existingLogoUrl = ref<string | null>(null)
const removeLogoFlag = ref(false)
const logoFileInput = ref<HTMLInputElement | null>(null)

function resetBrandingForm(data: Partial<StoreBranding> = {}) {
  brandStoreName.value = data.store_name ?? 'KC Inventory'
  brandTagline.value = data.tagline ?? 'Omnichannel Suite'
  brandAddress.value = data.store_address ?? ''
  brandPhone.value = data.store_phone ?? ''
  brandPrimaryColor.value = data.primary_color ?? '#924c00'
  brandReceiptHeader.value = data.receipt_header ?? 'TAX INVOICE / RECEIPT'
  brandInvoiceHeader.value = data.invoice_header ?? 'INVOICE'
  brandQuotationHeader.value = data.quotation_header ?? 'QUOTATION'
  brandReceiptFooter.value = data.receipt_footer ?? 'Thank you for your business!'
  brandIncludeTax.value = data.include_tax ?? false
  existingLogoUrl.value = data.logo_url ?? null
  logoPreview.value = data.logo_url ?? null
  logoFile.value = null
  removeLogoFlag.value = false
}

async function fetchBranding() {
  brandingLoading.value = true
  brandingError.value = ''
  try {
    const res = await api.get('/settings/branding')
    const data = res.data?.data ?? res.data
    resetBrandingForm(data)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to load store branding'
    brandingError.value = msg
    resetBrandingForm()
  } finally {
    brandingLoading.value = false
  }
}

function onLogoFileChange(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  if (!file.type.startsWith('image/')) {
    brandingError.value = 'Please select a valid image file.'
    return
  }
  if (file.size > 5 * 1024 * 1024) {
    brandingError.value = 'Logo file size must be less than 5MB.'
    return
  }
  logoFile.value = file
  removeLogoFlag.value = false
  const reader = new FileReader()
  reader.onload = (ev) => {
    logoPreview.value = ev.target?.result as string
  }
  reader.readAsDataURL(file)
}

function clearLogo() {
  logoFile.value = null
  logoPreview.value = null
  removeLogoFlag.value = true
  if (logoFileInput.value) logoFileInput.value.value = ''
}

async function saveBranding() {
  brandingSaving.value = true
  brandingError.value = ''
  brandingSuccess.value = ''
  try {
    const formData = new FormData()
    formData.append('store_name', brandStoreName.value.trim() || 'KC Inventory')
    formData.append('tagline', brandTagline.value.trim())
    formData.append('store_address', brandAddress.value.trim())
    formData.append('store_phone', brandPhone.value.trim())
    formData.append('primary_color', brandPrimaryColor.value || '#924c00')
    formData.append('receipt_header', brandReceiptHeader.value.trim())
    formData.append('invoice_header', brandInvoiceHeader.value.trim())
    formData.append('quotation_header', brandQuotationHeader.value.trim())
    formData.append('receipt_footer', brandReceiptFooter.value.trim())
    formData.append('include_tax', brandIncludeTax.value ? '1' : '0')

    if (logoFile.value) {
      formData.append('logo', logoFile.value, logoFile.value.name)
    }
    if (removeLogoFlag.value) {
      formData.append('remove_logo', '1')
    }

    const res = await api.post('/settings/branding', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    const data = res.data?.data ?? res.data
    resetBrandingForm(data)
    brandingSuccess.value = 'Store branding saved successfully.'
    setTimeout(() => (brandingSuccess.value = ''), 4000)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to save store branding'
    brandingError.value = msg
  } finally {
    brandingSaving.value = false
  }
}

// ============================================================================
// Printer Stations State
// ============================================================================
const printers = ref<PrinterDevice[]>([])
const printersLoading = ref(false)
const printersError = ref('')

const showPrinterModal = ref(false)
const editingPrinter = ref<PrinterDevice | null>(null)
const printerSaving = ref(false)
const testingPrinterId = ref<string | null>(null)
const testResultMessage = ref('')

const pName = ref('')
const pConnectionType = ref<'wifi' | 'bluetooth'>('wifi')
const pIpAddress = ref('192.168.1.100')
const pPort = ref<number>(9100)
const pBluetoothName = ref('')
const pPaperWidth = ref<'80mm' | '58mm'>('80mm')
const pRole = ref<'receipt' | 'kitchen'>('receipt')
const pIsDefault = ref(false)
const pAutoCut = ref(true)

function openAddPrinter() {
  editingPrinter.value = null
  pName.value = ''
  pConnectionType.value = 'wifi'
  pIpAddress.value = '192.168.1.100'
  pPort.value = 9100
  pBluetoothName.value = ''
  pPaperWidth.value = '80mm'
  pRole.value = 'receipt'
  pIsDefault.value = printers.value.length === 0
  pAutoCut.value = true
  showPrinterModal.value = true
}

function openEditPrinter(printer: PrinterDevice) {
  editingPrinter.value = { ...printer }
  pName.value = printer.name
  pConnectionType.value = printer.connectionType
  pIpAddress.value = printer.ipAddress
  pPort.value = printer.port
  pBluetoothName.value = printer.bluetoothName ?? ''
  pPaperWidth.value = printer.paperWidth
  pRole.value = printer.role
  pIsDefault.value = printer.isDefault
  pAutoCut.value = printer.autoCut
  showPrinterModal.value = true
}

function closePrinterModal() {
  showPrinterModal.value = false
  editingPrinter.value = null
  printersError.value = ''
}

async function savePrinter() {
  if (!pName.value.trim()) {
    printersError.value = 'Please enter a name for this printer station.'
    return
  }
  if (pConnectionType.value === 'wifi') {
    if (!pIpAddress.value.trim()) {
      printersError.value = 'IP address is required for WiFi printers.'
      return
    }
    if (!pPort.value || pPort.value < 1 || pPort.value > 65535) {
      printersError.value = 'Port must be between 1 and 65535.'
      return
    }
  }

  printerSaving.value = true
  printersError.value = ''
  try {
    if (editingPrinter.value) {
      const idx = printers.value.findIndex((p) => p.id === editingPrinter.value!.id)
      if (idx >= 0) {
        const updated: PrinterDevice = {
          ...editingPrinter.value,
          name: pName.value.trim(),
          connectionType: pConnectionType.value,
          ipAddress: pIpAddress.value.trim(),
          port: pPort.value,
          bluetoothName: pBluetoothName.value.trim(),
          paperWidth: pPaperWidth.value,
          role: pRole.value,
          isDefault: pIsDefault.value,
          autoCut: pAutoCut.value,
        }
        printers.value[idx] = updated
        if (pIsDefault.value) {
          printers.value.forEach((p, i) => {
            if (i !== idx) p.isDefault = false
          })
        }
      }
    } else {
      const newPrinter: PrinterDevice = {
        id: `prn-${Date.now()}`,
        name: pName.value.trim(),
        connectionType: pConnectionType.value,
        ipAddress: pIpAddress.value.trim(),
        port: pPort.value,
        bluetoothName: pBluetoothName.value.trim(),
        paperWidth: pPaperWidth.value,
        role: pRole.value,
        isDefault: pIsDefault.value,
        autoCut: pAutoCut.value,
      }
      printers.value = [...printers.value, newPrinter]
      if (pIsDefault.value) {
        printers.value.forEach((p, i) => {
          if (i !== printers.value.length - 1) p.isDefault = false
        })
      }
    }
    persistPrinters()
    closePrinterModal()
  } catch (err) {
    printersError.value = err instanceof Error ? err.message : 'Failed to save printer'
  } finally {
    printerSaving.value = false
  }
}

function deletePrinter(id: string) {
  const printer = printers.value.find((p) => p.id === id)
  if (!printer) return
  printerToDelete.value = printer
  showDeletePrinterDialog.value = true
}

function confirmDeletePrinter() {
  if (!printerToDelete.value) return
  printers.value = printers.value.filter((p) => p.id !== printerToDelete.value!.id)
  persistPrinters()
  showDeletePrinterDialog.value = false
  printerToDelete.value = null
  toast.success('Printer removed successfully')
}

async function testPrinter(printer: PrinterDevice) {
  testingPrinterId.value = printer.id
  testResultMessage.value = ''
  try {
    const sample = `\x1B@\x1B!Testing printer: ${printer.name}\nConnection: ${printer.connectionType}\nPaper: ${printer.paperWidth}\n\x1Bm\n`
    const res = await api.post('/printer/raw-print', {
      ip: printer.ipAddress,
      port: printer.port,
      data: sample,
    })
    testResultMessage.value = res.data?.message || `Test print sent to ${printer.name}`
    toast.success(testResultMessage.value)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Could not send test print'
    toast.error(`Printer Notice: ${msg}`)
  } finally {
    testingPrinterId.value = null
  }
}

function persistPrinters() {
  try {
    localStorage.setItem('omnipos_printers', JSON.stringify(printers.value))
  } catch {
    // ignore storage errors
  }
}

function loadPrinters() {
  printersLoading.value = true
  try {
    const raw = localStorage.getItem('omnipos_printers')
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        printers.value = parsed as PrinterDevice[]
      }
    }
  } catch {
    printers.value = []
  } finally {
    printersLoading.value = false
  }
}

// ============================================================================
// Diagnostics State
// ============================================================================
const healthStatus = ref<HealthStatus>({
  connected: false,
  status: 'Not Checked',
  version: '—',
  app: 'KC Inventory Core',
  database: 'Unknown',
  latency: '—',
})
const healthLoading = ref(false)
const cacheClearing = ref(false)

async function checkBackendHealth() {
  healthLoading.value = true
  const start = performance.now()
  try {
    const res = await api.get('/health')
    const elapsed = Math.round(performance.now() - start)
    const data = res.data?.data ?? res.data
    healthStatus.value = {
      connected: true,
      status: data?.status || 'Operational',
      version: data?.version || 'v1.0.0',
      app: data?.app || 'KC Inventory Core',
      database: data?.database || 'Connected',
      latency: `${elapsed}ms`,
    }
  } catch {
    const elapsed = Math.round(performance.now() - start)
    healthStatus.value = {
      connected: false,
      status: 'Offline / Unreachable',
      version: 'Local Cache',
      app: 'KC Inventory Core',
      database: 'Offline Queue Active',
      latency: `${elapsed}ms (timeout)`,
    }
  } finally {
    healthLoading.value = false
  }
}

async function clearCache() {
  cacheClearing.value = true
  try {
    try {
      localStorage.removeItem('omnipos_printers')
    } catch {
      // ignore
    }
    try {
      sessionStorage.clear()
    } catch {
      // ignore
    }
    await new Promise((r) => setTimeout(r, 700))
    toast.success('Local cache cleared successfully.')
  } finally {
    cacheClearing.value = false
  }
}

// ============================================================================
// Account State
// ============================================================================
const currentUser = ref<CurrentUser | null>(null)
const accountLoading = ref(false)
const showPasswordModal = ref(false)
const passwordSaving = ref(false)
const passwordError = ref('')

const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')

async function fetchCurrentUser() {
  accountLoading.value = true
  try {
    const res = await api.get('/auth/me')
    const data = res.data?.data ?? res.data
    if (data && typeof data === 'object') {
      currentUser.value = {
        id: data.id,
        name: data.name,
        email: data.email,
        role: data.role ?? 'Staff',
      }
    }
  } catch {
    currentUser.value = null
  } finally {
    accountLoading.value = false
  }
}

function openPasswordModal() {
  currentPassword.value = ''
  newPassword.value = ''
  confirmPassword.value = ''
  passwordError.value = ''
  showPasswordModal.value = true
}

function closePasswordModal() {
  showPasswordModal.value = false
  passwordError.value = ''
}

async function submitPasswordChange() {
  passwordError.value = ''
  if (!currentPassword.value || !newPassword.value || !confirmPassword.value) {
    passwordError.value = 'Please fill in all password fields.'
    return
  }
  if (newPassword.value.length < 8) {
    passwordError.value = 'New password must be at least 8 characters.'
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    passwordError.value = 'New password and confirmation do not match.'
    return
  }
  passwordSaving.value = true
  try {
    await api.patch('/auth/password', {
      current_password: currentPassword.value,
      new_password: newPassword.value,
    })
    toast.success('Password changed successfully.')
    closePasswordModal()
  } catch (err) {
    passwordError.value = err instanceof Error ? err.message : 'Failed to change password'
  } finally {
    passwordSaving.value = false
  }
}

function promptLogout() {
  showLogoutDialog.value = true
}

async function confirmLogout() {
  showLogoutDialog.value = false
  try {
    await api.post('/auth/logout')
  } catch {
    // proceed to redirect even if request fails
  }
  try {
    localStorage.clear()
    sessionStorage.clear()
  } catch {
    // ignore
  }
  window.location.href = '/login'
}

// ============================================================================
// Lifecycle
// ============================================================================
onMounted(() => {
  fetchBranding()
  loadPrinters()
  checkBackendHealth()
  fetchCurrentUser()
})

// ============================================================================
// Helpers
// ============================================================================
const userInitials = (name: string | undefined): string => {
  if (!name) return '?'
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}
</script>

<template>
  <div class="flex flex-col gap-6 max-w-6xl mx-auto w-full">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-3">
          <h1 class="text-2xl sm:text-3xl font-display font-bold text-foreground tracking-tight">Settings & Configuration</h1>
          <Badge variant="info" class="font-mono text-xs px-2.5 py-0.5">
            System Hub
          </Badge>
        </div>
        <p class="text-xs text-muted-foreground mt-0.5">
          Manage store branding identity, ESC/POS thermal printers, system diagnostics, and account credentials.
        </p>
      </div>
    </div>

    <!-- Navigation Tabs -->
    <div class="flex border-b border-border gap-2 overflow-x-auto no-scrollbar">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        :id="`tab-${tab.key}`"
        class="px-4 py-2 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer"
        :class="activeTab === tab.key ? 'border-cta text-cta' : 'border-transparent text-muted-foreground hover:text-foreground'"
        @click="activeTab = tab.key"
      >
        <component :is="tab.icon" :size="14" />
        <span>{{ tab.label }}</span>
      </button>
    </div>

    <!-- ===================== Store Branding Tab ===================== -->
    <Card v-if="activeTab === 'branding'" class="p-6 flex flex-col gap-6">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="font-display font-bold text-base text-foreground">Store Branding & Receipt Identity</h2>
          <p class="text-xs text-muted-foreground mt-0.5">
            Customize the visual identity used on receipts, invoices, and quotations across all sales channels.
          </p>
        </div>
        <Badge v-if="brandingLoading" variant="neutral" class="font-mono text-xs">Loading…</Badge>
      </div>

      <Alert v-if="brandingError" variant="error">
        {{ brandingError }}
      </Alert>
      <Alert v-if="brandingSuccess" variant="success">
        {{ brandingSuccess }}
      </Alert>

      <!-- Interface Appearance & Dark Mode Section -->
      <div class="flex flex-col gap-3 p-4 rounded-xl border border-border bg-surface">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-xs font-bold uppercase tracking-wider text-muted-foreground">Interface Appearance</h3>
            <p class="text-xs text-foreground font-medium mt-0.5">
              Choose your preferred visual theme for the OmniPOS dashboard and cashier terminal.
            </p>
          </div>
          <Badge variant="primary" class="font-mono text-2xs uppercase">
            Active: {{ themeStore.theme }}
          </Badge>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <!-- Light Theme Tile -->
          <button
            type="button"
            class="group relative flex flex-col items-start gap-2.5 p-3.5 rounded-xl border-2 transition-all text-left cursor-pointer"
            :class="themeStore.theme === 'light' ? 'border-cta bg-cta/5 shadow-xs' : 'border-border bg-card hover:border-border-strong'"
            @click="themeStore.setTheme('light')"
          >
            <div class="w-full flex items-center justify-between">
              <div class="w-7 h-7 rounded-lg bg-[#FFFBEB] text-[#D97706] flex items-center justify-center">
                <Sun :size="15" />
              </div>
              <div v-if="themeStore.theme === 'light'" class="w-4 h-4 rounded-full bg-cta text-white flex items-center justify-center">
                <Check :size="10" />
              </div>
            </div>
            <!-- Visual Mock Preview -->
            <div class="w-full h-12 rounded-lg bg-[#FAF7F2] border border-[#E8E2D9] p-1.5 flex gap-1 overflow-hidden">
              <div class="w-3 h-full rounded bg-[#FFFFFF] border border-[#E8E2D9]"></div>
              <div class="flex-1 flex flex-col gap-1">
                <div class="w-full h-2 rounded bg-[#924C00]/20"></div>
                <div class="w-2/3 h-2 rounded bg-[#FF8800]/30"></div>
              </div>
            </div>
            <div>
              <span class="text-xs font-bold text-foreground block">Light Mode</span>
              <span class="text-2xs text-muted-foreground">Warm Cream & Amber retail canvas</span>
            </div>
          </button>

          <!-- Dark Theme Tile -->
          <button
            type="button"
            class="group relative flex flex-col items-start gap-2.5 p-3.5 rounded-xl border-2 transition-all text-left cursor-pointer"
            :class="themeStore.theme === 'dark' ? 'border-cta bg-cta/5 shadow-xs' : 'border-border bg-card hover:border-border-strong'"
            @click="themeStore.setTheme('dark')"
          >
            <div class="w-full flex items-center justify-between">
              <div class="w-7 h-7 rounded-lg bg-[#2E241A] text-[#FFB781] flex items-center justify-center">
                <Moon :size="15" />
              </div>
              <div v-if="themeStore.theme === 'dark'" class="w-4 h-4 rounded-full bg-cta text-white flex items-center justify-center">
                <Check :size="10" />
              </div>
            </div>
            <!-- Visual Mock Preview -->
            <div class="w-full h-12 rounded-lg bg-[#14120E] border border-[#332C25] p-1.5 flex gap-1 overflow-hidden">
              <div class="w-3 h-full rounded bg-[#1E1B17] border border-[#332C25]"></div>
              <div class="flex-1 flex flex-col gap-1">
                <div class="w-full h-2 rounded bg-[#FFB781]/30"></div>
                <div class="w-2/3 h-2 rounded bg-[#FF941A]/40"></div>
              </div>
            </div>
            <div>
              <span class="text-xs font-bold text-foreground block">Dark Mode</span>
              <span class="text-2xs text-muted-foreground">Warm Obsidian & Radiant Amber</span>
            </div>
          </button>

          <!-- System Auto Tile -->
          <button
            type="button"
            class="group relative flex flex-col items-start gap-2.5 p-3.5 rounded-xl border-2 transition-all text-left cursor-pointer"
            :class="themeStore.theme === 'system' ? 'border-cta bg-cta/5 shadow-xs' : 'border-border bg-card hover:border-border-strong'"
            @click="themeStore.setTheme('system')"
          >
            <div class="w-full flex items-center justify-between">
              <div class="w-7 h-7 rounded-lg bg-muted text-muted-foreground flex items-center justify-center">
                <Laptop :size="15" />
              </div>
              <div v-if="themeStore.theme === 'system'" class="w-4 h-4 rounded-full bg-cta text-white flex items-center justify-center">
                <Check :size="10" />
              </div>
            </div>
            <!-- Visual Mock Preview (Split Light/Dark) -->
            <div class="w-full h-12 rounded-lg border border-border p-1.5 flex gap-1 overflow-hidden bg-gradient-to-r from-[#FAF7F2] to-[#14120E]">
              <div class="w-1/2 h-full flex flex-col gap-1">
                <div class="w-full h-2 rounded bg-[#924C00]/30"></div>
                <div class="w-2/3 h-2 rounded bg-[#FF8800]/40"></div>
              </div>
              <div class="w-1/2 h-full flex flex-col gap-1">
                <div class="w-full h-2 rounded bg-[#FFB781]/30"></div>
                <div class="w-2/3 h-2 rounded bg-[#FF941A]/40"></div>
              </div>
            </div>
            <div>
              <span class="text-xs font-bold text-foreground block">System Default</span>
              <span class="text-2xs text-muted-foreground">Matches operating system setting</span>
            </div>
          </button>
        </div>
      </div>

      <!-- Logo Section -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-6 p-4 rounded-xl border border-border bg-surface">
        <div class="flex flex-col gap-2">
          <span class="text-xs font-semibold text-foreground">Current Logo</span>
          <div class="flex items-center justify-center min-h-[120px] rounded-lg border border-dashed border-border bg-card p-4">
            <img
              v-if="logoPreview"
              :src="logoPreview"
              alt="Store Logo"
              class="max-h-24 max-w-full object-contain rounded"
            />
            <div v-else class="flex flex-col items-center gap-1 text-muted-foreground text-xs">
              <ImageIcon :size="24" />
              <span>No logo uploaded yet</span>
            </div>
          </div>
        </div>

        <div class="flex flex-col gap-2">
          <label class="text-xs font-semibold text-foreground">Upload New Logo</label>
          <input
            id="logo-file-input"
            ref="logoFileInput"
            type="file"
            accept="image/*"
            class="text-xs text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer"
            @change="onLogoFileChange"
          />
          <p class="text-[11px] text-muted-foreground">PNG, JPG, or SVG format. Square or banner ratio recommended. Max 5MB.</p>
          <div v-if="logoPreview" class="flex items-center gap-2 mt-2">
            <Button
              id="btn-remove-logo"
              variant="outline"
              size="sm"
              class="h-7 px-2.5 text-xs text-destructive hover:bg-destructive/10"
              type="button"
              @click="clearLogo"
            >
              Remove Logo
            </Button>
            <span v-if="logoFile" class="text-[11px] text-muted-foreground font-mono">
              Selected: {{ logoFile.name }} ({{ Math.round(logoFile.size / 1024) }}KB)
            </span>
          </div>
        </div>
      </div>

      <!-- Identity Fields -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label class="block text-xs font-semibold text-foreground mb-1">Store Name *</label>
          <Input
            id="brand-store-name"
            v-model="brandStoreName"
            type="text"
            placeholder="e.g., KC Inventory"
            class="h-9 bg-surface text-sm"
          />
        </div>
        <div>
          <label class="block text-xs font-semibold text-foreground mb-1">Tagline</label>
          <Input
            id="brand-tagline"
            v-model="brandTagline"
            type="text"
            placeholder="e.g., Omnichannel Retail POS"
            class="h-9 bg-surface text-sm"
          />
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div class="sm:col-span-2">
          <label class="block text-xs font-semibold text-foreground mb-1">Store Address</label>
          <Input
            id="brand-address"
            v-model="brandAddress"
            type="text"
            placeholder="Building, Street, City, Country"
            class="h-9 bg-surface text-sm"
          />
        </div>
        <div>
          <label class="block text-xs font-semibold text-foreground mb-1">Store Phone</label>
          <Input
            id="brand-phone"
            v-model="brandPhone"
            type="tel"
            placeholder="+1 555 123 4567"
            class="h-9 bg-surface text-sm font-mono"
          />
        </div>
      </div>

      <!-- Color & Tax -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl border border-border bg-surface">
        <div>
          <label class="block text-xs font-semibold text-foreground mb-1">Theme Brand Accent Color</label>
          <div class="flex items-center gap-3">
            <input
              id="brand-primary-color"
              v-model="brandPrimaryColor"
              type="color"
              class="w-10 h-9 p-0.5 rounded border border-border bg-card cursor-pointer"
            />
            <Input
              v-model="brandPrimaryColor"
              type="text"
              placeholder="#924C00"
              class="h-9 w-32 bg-card text-xs font-mono"
            />
          </div>
        </div>

        <div class="flex items-center justify-between">
          <div>
            <span class="font-semibold text-xs text-foreground block">Receipt VAT / Tax Line</span>
            <span class="text-[11px] text-muted-foreground">
              {{ brandIncludeTax ? 'Tax amount printed explicitly on receipts' : 'Tax inclusive / hidden' }}
            </span>
          </div>
          <Switch
            :checked="brandIncludeTax"
            @update:checked="(val) => brandIncludeTax = val"
          />
        </div>
      </div>

      <!-- Headers & Footers -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label class="block text-xs font-semibold text-foreground mb-1">Receipt Header</label>
          <textarea
            id="brand-receipt-header"
            v-model="brandReceiptHeader"
            rows="2"
            placeholder="TAX INVOICE / RECEIPT"
            class="w-full px-3 py-2 text-xs bg-surface border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-cta/30 focus:border-cta"
          ></textarea>
        </div>
        <div>
          <label class="block text-xs font-semibold text-foreground mb-1">Invoice Header</label>
          <textarea
            id="brand-invoice-header"
            v-model="brandInvoiceHeader"
            rows="2"
            placeholder="COMMERCIAL INVOICE"
            class="w-full px-3 py-2 text-xs bg-surface border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-cta/30 focus:border-cta"
          ></textarea>
        </div>
        <div>
          <label class="block text-xs font-semibold text-foreground mb-1">Quotation Header</label>
          <textarea
            id="brand-quotation-header"
            v-model="brandQuotationHeader"
            rows="2"
            placeholder="PRICE QUOTATION"
            class="w-full px-3 py-2 text-xs bg-surface border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-cta/30 focus:border-cta"
          ></textarea>
        </div>
        <div>
          <label class="block text-xs font-semibold text-foreground mb-1">Receipt Footer</label>
          <textarea
            id="brand-receipt-footer"
            v-model="brandReceiptFooter"
            rows="2"
            placeholder="Thank you for shopping with us!"
            class="w-full px-3 py-2 text-xs bg-surface border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-cta/30 focus:border-cta"
          ></textarea>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex items-center justify-end gap-3 pt-4 border-t border-border">
        <Button
          id="btn-reset-branding"
          variant="outline"
          size="sm"
          :disabled="brandingSaving"
          @click="fetchBranding"
        >
          Reset
        </Button>
        <Button
          id="btn-save-branding"
          variant="primary"
          size="sm"
          :disabled="brandingSaving"
          @click="saveBranding"
        >
          <span v-if="brandingSaving" class="animate-spin mr-1">⏳</span>
          <span>{{ brandingSaving ? 'Saving…' : 'Save Branding' }}</span>
        </Button>
      </div>
    </Card>

    <!-- ===================== Thermal Printers Tab ===================== -->
    <div v-if="activeTab === 'printers'" class="flex flex-col gap-6">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 class="font-display font-bold text-base text-foreground">Thermal Printer Stations</h2>
          <p class="text-xs text-muted-foreground mt-0.5">
            Configure WiFi and Bluetooth ESC/POS thermal printers for customer receipts and kitchen tickets (80mm / 58mm).
          </p>
        </div>
        <Button id="btn-add-printer" variant="primary" size="sm" class="gap-1.5" @click="openAddPrinter">
          <Plus :size="15" />
          <span>Add Printer Station</span>
        </Button>
      </div>

      <Alert v-if="printersError" variant="error">
        {{ printersError }}
      </Alert>

      <div class="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
        <div v-if="printersLoading" class="p-6 space-y-3">
          <Skeleton v-for="i in 3" :key="i" class="h-12 w-full" />
        </div>

        <EmptyState
          v-else-if="printers.length === 0"
          :icon="Printer"
          title="No Printer Stations Configured"
          description="Add your first thermal printer station to begin printing sales receipts and kitchen order tickets."
        >
          <template #action>
            <Button variant="primary" size="sm" class="gap-1.5" @click="openAddPrinter">
              <Plus :size="15" />
              <span>Add First Printer</span>
            </Button>
          </template>
        </EmptyState>

        <div v-else class="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow class="bg-muted/40">
                <TableHead>Station Name</TableHead>
                <TableHead>Connection</TableHead>
                <TableHead class="font-mono">Target</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Paper Width</TableHead>
                <TableHead>Cut Mode</TableHead>
                <TableHead class="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="p in printers" :key="p.id" class="hover:bg-surface-subtle/80 transition-colors">
                <TableCell>
                  <div class="font-semibold text-foreground text-sm">{{ p.name }}</div>
                  <div v-if="p.isDefault" class="mt-0.5">
                    <Badge variant="success" class="text-[9px] px-1.5 py-0 font-mono">Default</Badge>
                  </div>
                </TableCell>

                <TableCell>
                  <Badge :variant="p.connectionType === 'wifi' ? 'info' : 'purple'" class="text-[10px] px-2 py-0.5">
                    {{ p.connectionType === 'wifi' ? 'WiFi / LAN' : 'Bluetooth' }}
                  </Badge>
                </TableCell>

                <TableCell class="font-mono text-xs text-muted-foreground">
                  <span v-if="p.connectionType === 'wifi'" class="px-1.5 py-0.5 rounded bg-muted">
                    {{ p.ipAddress }}:{{ p.port }}
                  </span>
                  <span v-else>{{ p.bluetoothName || '—' }}</span>
                </TableCell>

                <TableCell>
                  <Badge :variant="p.role === 'receipt' ? 'info' : 'warning'" class="text-[10px] px-2 py-0.5">
                    {{ p.role === 'receipt' ? 'Receipt' : 'Kitchen' }}
                  </Badge>
                </TableCell>

                <TableCell class="font-mono text-xs text-muted-foreground">
                  {{ p.paperWidth }}
                </TableCell>

                <TableCell>
                  <Badge :variant="p.autoCut ? 'success' : 'neutral'" class="text-[10px] px-2 py-0.5">
                    {{ p.autoCut ? 'Auto-cut' : 'Manual' }}
                  </Badge>
                </TableCell>

                <TableCell class="text-right">
                  <div class="flex items-center justify-end gap-1.5">
                    <Button
                      :id="`btn-test-printer-${p.id}`"
                      variant="ghost"
                      size="sm"
                      class="h-8 px-2.5 text-xs gap-1"
                      :disabled="testingPrinterId === p.id"
                      @click="testPrinter(p)"
                    >
                      <Printer :size="13" />
                      <span>{{ testingPrinterId === p.id ? 'Testing…' : 'Test' }}</span>
                    </Button>
                    <Button
                      :id="`btn-edit-printer-${p.id}`"
                      variant="ghost"
                      size="sm"
                      class="h-8 px-2.5 text-xs gap-1"
                      @click="openEditPrinter(p)"
                    >
                      <Edit2 :size="13" />
                      <span>Edit</span>
                    </Button>
                    <Button
                      :id="`btn-delete-printer-${p.id}`"
                      variant="ghost"
                      size="sm"
                      class="h-8 px-2 text-xs text-destructive hover:bg-destructive/10"
                      @click="deletePrinter(p.id)"
                    >
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

    <!-- ===================== Diagnostics Tab ===================== -->
    <div v-if="activeTab === 'diagnostics'" class="flex flex-col gap-6">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard
          label="Backend API Service"
          :value="healthStatus.status || 'Active'"
          :sub="`Latency: ${healthStatus.latency} • Last checked: ${new Date().toLocaleTimeString()}`"
          :icon="Server"
          :icon-variant="healthStatus.connected ? 'success' : 'warning'"
        />
        <StatCard
          label="Database Engine"
          :value="healthStatus.database || 'Active'"
          sub="Connection state: Online • Queue driver: Database"
          :icon="Database"
          :icon-variant="healthStatus.connected ? 'success' : 'warning'"
        />
      </div>

      <Card class="p-6 flex flex-col gap-4">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="font-display font-bold text-base text-foreground">Application Build & Runtime Details</h3>
            <p class="text-xs text-muted-foreground mt-0.5">Platform runtime identifiers and API endpoints.</p>
          </div>
          <Badge variant="neutral" class="font-mono text-xs">v{{ healthStatus.version }}</Badge>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div class="p-3 rounded-lg border border-border bg-surface flex items-center justify-between text-xs">
            <span class="text-muted-foreground font-semibold">Application</span>
            <span class="font-semibold text-foreground">{{ healthStatus.app }}</span>
          </div>
          <div class="p-3 rounded-lg border border-border bg-surface flex items-center justify-between text-xs">
            <span class="text-muted-foreground font-semibold">Build Version</span>
            <span class="font-mono font-semibold text-foreground">{{ healthStatus.version }}</span>
          </div>
          <div class="p-3 rounded-lg border border-border bg-surface flex items-center justify-between text-xs">
            <span class="text-muted-foreground font-semibold">API Base Path</span>
            <code class="font-mono text-primary text-xs">/api/v1</code>
          </div>
        </div>

        <div class="flex items-center justify-between pt-4 border-t border-border">
          <div>
            <span class="font-semibold text-xs text-foreground block">Health Check Trigger</span>
            <span class="text-[11px] text-muted-foreground">Ping backend microservices and calculate gateway round-trip time.</span>
          </div>
          <Button
            id="btn-check-health"
            variant="outline"
            size="sm"
            class="text-xs gap-1.5"
            :disabled="healthLoading"
            @click="checkBackendHealth"
          >
            <RefreshCw :size="13" :class="{ 'animate-spin': healthLoading }" />
            <span>{{ healthLoading ? 'Checking…' : 'Run Health Check' }}</span>
          </Button>
        </div>
      </Card>

      <Card class="p-6 flex items-center justify-between">
        <div>
          <h3 class="font-display font-bold text-base text-foreground">Local Cache Management</h3>
          <p class="text-xs text-muted-foreground mt-0.5">Clear locally cached printer hardware records and session memory.</p>
        </div>
        <Button
          id="btn-clear-cache"
          variant="destructive"
          size="sm"
          :disabled="cacheClearing"
          @click="clearCache"
        >
          <span v-if="cacheClearing" class="animate-spin mr-1">⏳</span>
          <span>{{ cacheClearing ? 'Clearing…' : 'Clear Local Cache' }}</span>
        </Button>
      </Card>
    </div>

    <!-- ===================== Account Tab ===================== -->
    <div v-if="activeTab === 'account'" class="flex flex-col gap-6">
      <Card class="p-6">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div class="flex items-center gap-4">
            <div class="w-16 h-16 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-bold text-xl flex-shrink-0">
              {{ userInitials(currentUser?.name) }}
            </div>
            <div>
              <div v-if="accountLoading" class="text-xs text-muted-foreground">Loading profile…</div>
              <template v-else-if="currentUser">
                <h2 class="font-display font-bold text-lg text-foreground">{{ currentUser.name }}</h2>
                <p class="text-xs text-muted-foreground font-mono">{{ currentUser.email }}</p>
                <div class="flex items-center gap-2 mt-2">
                  <Badge variant="info" class="font-mono text-xs px-2 py-0.5">{{ currentUser.role }}</Badge>
                  <Badge variant="success" class="text-[10px] px-2 py-0.5">Active Session</Badge>
                </div>
              </template>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <Button
              id="btn-change-password"
              variant="outline"
              size="sm"
              class="gap-1.5 text-xs"
              :disabled="!currentUser"
              @click="openPasswordModal"
            >
              <Key :size="14" />
              <span>Change Password</span>
            </Button>
            <Button
              id="btn-logout"
              variant="destructive"
              size="sm"
              class="gap-1.5 text-xs"
              @click="promptLogout"
            >
              <LogOut :size="14" />
              <span>Sign Out</span>
            </Button>
          </div>
        </div>
      </Card>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card class="p-5 flex flex-col gap-3">
          <h3 class="font-display font-bold text-sm text-foreground">Session Security</h3>
          <div class="flex flex-col gap-2 text-xs">
            <div class="p-2.5 rounded-lg border border-border bg-surface flex items-center justify-between">
              <span class="text-muted-foreground">Authentication Protocol</span>
              <Badge variant="success" class="font-mono text-[10px]">Bearer JWT</Badge>
            </div>
            <div class="p-2.5 rounded-lg border border-border bg-surface flex items-center justify-between">
              <span class="text-muted-foreground">CSRF Protection</span>
              <Badge variant="success" class="font-mono text-[10px]">Enabled</Badge>
            </div>
            <div class="p-2.5 rounded-lg border border-border bg-surface flex items-center justify-between">
              <span class="text-muted-foreground">Idempotency Locks</span>
              <Badge variant="success" class="font-mono text-[10px]">UUID v4 Active</Badge>
            </div>
          </div>
        </Card>

        <Card class="p-5 flex flex-col gap-3">
          <h3 class="font-display font-bold text-sm text-foreground">Security Best Practices</h3>
          <ul class="text-xs text-muted-foreground space-y-2 list-disc list-inside">
            <li>Use a unique passphrase with at least 8 characters.</li>
            <li>Always sign out before leaving a shared cashier station.</li>
            <li>Check audit logs regularly for unauthorized permission changes.</li>
          </ul>
        </Card>
      </div>
    </div>

    <!-- ===================== Add / Edit Printer Modal ===================== -->
    <Dialog :open="showPrinterModal" @update:open="(val) => { if (!val) closePrinterModal(); }">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle class="font-display">
            {{ editingPrinter ? 'Edit Printer Station' : 'Add Printer Station' }}
          </DialogTitle>
          <DialogDescription>
            Configure ESC/POS thermal printer hardware parameters and store routing roles.
          </DialogDescription>
        </DialogHeader>

        <div class="flex flex-col gap-3 py-2">
          <div>
            <label class="block text-xs font-semibold text-foreground mb-1">Station Name *</label>
            <Input
              id="printer-name"
              v-model="pName"
              type="text"
              placeholder="e.g., Front Counter Receipt"
              class="h-9 bg-surface text-sm"
            />
          </div>

          <div>
            <label class="block text-xs font-semibold text-foreground mb-1">Connection Protocol</label>
            <div class="flex items-center gap-4 pt-1">
              <label class="flex items-center gap-2 text-xs cursor-pointer">
                <input type="radio" value="wifi" v-model="pConnectionType" />
                <span>WiFi / LAN</span>
              </label>
              <label class="flex items-center gap-2 text-xs cursor-pointer">
                <input type="radio" value="bluetooth" v-model="pConnectionType" />
                <span>Bluetooth</span>
              </label>
            </div>
          </div>

          <div v-if="pConnectionType === 'wifi'" class="grid grid-cols-3 gap-2">
            <div class="col-span-2">
              <label class="block text-xs font-semibold text-foreground mb-1">IP Address *</label>
              <Input
                id="printer-ip"
                v-model="pIpAddress"
                type="text"
                placeholder="192.168.1.100"
                class="h-9 bg-surface text-xs font-mono"
              />
            </div>
            <div>
              <label class="block text-xs font-semibold text-foreground mb-1">Port *</label>
              <Input
                id="printer-port"
                v-model.number="pPort"
                type="number"
                placeholder="9100"
                class="h-9 bg-surface text-xs font-mono"
              />
            </div>
          </div>

          <div v-else>
            <label class="block text-xs font-semibold text-foreground mb-1">Device Name</label>
            <Input
              id="printer-bluetooth-name"
              v-model="pBluetoothName"
              type="text"
              placeholder="e.g., Printer-BT-01"
              class="h-9 bg-surface text-sm font-mono"
            />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-semibold text-foreground mb-1">Paper Width</label>
              <select
                id="printer-paper"
                v-model="pPaperWidth"
                class="w-full h-9 px-3 text-xs bg-surface border border-input rounded-md"
              >
                <option value="80mm">80mm (Standard)</option>
                <option value="58mm">58mm (Compact)</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-semibold text-foreground mb-1">Routing Role</label>
              <select
                id="printer-role"
                v-model="pRole"
                class="w-full h-9 px-3 text-xs bg-surface border border-input rounded-md"
              >
                <option value="receipt">Receipt Printer</option>
                <option value="kitchen">Kitchen Ticket</option>
              </select>
            </div>
          </div>

          <div class="flex items-center justify-between pt-2 border-t border-border">
            <span class="text-xs font-semibold text-foreground">Set as Default Station</span>
            <Switch :checked="pIsDefault" @update:checked="(val) => pIsDefault = val" />
          </div>

          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold text-foreground">Auto-cut Paper After Print</span>
            <Switch :checked="pAutoCut" @update:checked="(val) => pAutoCut = val" />
          </div>
        </div>

        <DialogFooter class="gap-2 sm:gap-0 mt-4">
          <Button variant="outline" :disabled="printerSaving" @click="closePrinterModal">Cancel</Button>
          <Button
            id="btn-save-printer"
            variant="primary"
            :disabled="printerSaving"
            @click="savePrinter"
          >
            <span v-if="printerSaving" class="animate-spin mr-1">⏳</span>
            <span>{{ editingPrinter ? 'Update Printer' : 'Save Printer' }}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- ===================== Change Password Modal ===================== -->
    <Dialog :open="showPasswordModal" @update:open="(val) => { if (!val) closePasswordModal(); }">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle class="font-display">Change Account Password</DialogTitle>
          <DialogDescription>Update the login credential password for your user account.</DialogDescription>
        </DialogHeader>

        <Alert v-if="passwordError" variant="error" class="mb-2">
          {{ passwordError }}
        </Alert>

        <div class="flex flex-col gap-3 py-1">
          <div>
            <label class="block text-xs font-semibold text-foreground mb-1">Current Password *</label>
            <Input
              id="current-password"
              v-model="currentPassword"
              type="password"
              placeholder="••••••••"
              class="h-9 bg-surface text-sm font-mono"
            />
          </div>
          <div>
            <label class="block text-xs font-semibold text-foreground mb-1">New Password *</label>
            <Input
              id="new-password"
              v-model="newPassword"
              type="password"
              placeholder="At least 8 characters"
              class="h-9 bg-surface text-sm font-mono"
            />
          </div>
          <div>
            <label class="block text-xs font-semibold text-foreground mb-1">Confirm New Password *</label>
            <Input
              id="confirm-password"
              v-model="confirmPassword"
              type="password"
              placeholder="Re-enter new password"
              class="h-9 bg-surface text-sm font-mono"
            />
          </div>
        </div>

        <DialogFooter class="gap-2 sm:gap-0 mt-4">
          <Button variant="outline" :disabled="passwordSaving" @click="closePasswordModal">Cancel</Button>
          <Button
            id="btn-submit-password"
            variant="primary"
            :disabled="passwordSaving"
            @click="submitPasswordChange"
          >
            <span v-if="passwordSaving" class="animate-spin mr-1">⏳</span>
            <span>{{ passwordSaving ? 'Updating…' : 'Update Password' }}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Delete Printer Confirmation Dialog -->
    <Dialog :open="showDeletePrinterDialog" @update:open="(val) => showDeletePrinterDialog = val">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle class="font-display flex items-center gap-2">
            <Trash2 class="text-destructive w-5 h-5" />
            <span>Remove Thermal Printer</span>
          </DialogTitle>
          <DialogDescription class="text-sm text-muted-foreground mt-2">
            Are you sure you want to remove <strong class="text-foreground">{{ printerToDelete?.name }}</strong>? This device configuration will be removed from your terminal.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter class="gap-2 sm:gap-0 mt-4">
          <Button variant="outline" @click="showDeletePrinterDialog = false">Cancel</Button>
          <Button variant="destructive" @click="confirmDeletePrinter">
            Remove Printer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Logout Confirmation Dialog -->
    <Dialog :open="showLogoutDialog" @update:open="(val) => showLogoutDialog = val">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle class="font-display flex items-center gap-2">
            <LogOut class="text-destructive w-5 h-5" />
            <span>Sign Out Confirmation</span>
          </DialogTitle>
          <DialogDescription class="text-sm text-muted-foreground mt-2">
            Are you sure you want to sign out of your account? Any unsaved changes in active views will be lost.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter class="gap-2 sm:gap-0 mt-4">
          <Button variant="outline" @click="showLogoutDialog = false">Cancel</Button>
          <Button variant="destructive" @click="confirmLogout">
            Sign Out
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
