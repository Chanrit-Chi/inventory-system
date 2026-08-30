<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useBankAccountStore, type BankAccount } from '@/stores/bankAccountStore'
import { useToast } from '@/composables/useToast'
import {
  Building2,
  Plus,
  RefreshCw,
  Edit2,
  Trash2,
  CheckCircle2,
  Wallet,
  Coins,
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
const store = useBankAccountStore()

const showEditModal = ref(false)
const editing = ref<Partial<BankAccount> | null>(null)

const isDeleteDialogOpen = ref(false)
const deletingAccountId = ref<string | null>(null)
const isDeleting = ref(false)

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
  editing.value = { bank_name: '', account_name: '', account_number: '', account_type: 'checking', currency: 'USD', is_default: false }
  showEditModal.value = true
}

function openEdit(a: BankAccount) {
  editing.value = { ...a }
  showEditModal.value = true
}

async function save() {
  if (!editing.value || !editing.value.bank_name?.trim() || !editing.value.account_number?.trim()) {
    toast.error('Bank name and account number are required')
    return
  }
  try {
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

      <div class="flex items-center gap-2">
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
              <TableCell class="font-semibold text-foreground flex items-center gap-2">
                <Building2 :size="15" class="text-primary flex-shrink-0" />
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
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle class="font-display">{{ editing?.id ? 'Edit Bank Account' : 'Add Bank Account' }}</DialogTitle>
          <DialogDescription>
            Configure bank institution name, account number, currency, and default payment account flag.
          </DialogDescription>
        </DialogHeader>

        <div v-if="editing" class="flex flex-col gap-3 py-2">
          <div>
            <label class="block text-xs font-semibold text-foreground mb-1">Bank Name *</label>
            <Input v-model="editing.bank_name" placeholder="e.g. ABA Bank, Canadia Bank" class="h-9 bg-surface text-sm" />
          </div>

          <div>
            <label class="block text-xs font-semibold text-foreground mb-1">Account Holder Name *</label>
            <Input v-model="editing.account_name" placeholder="e.g. OMNIPOS RETAIL CO., LTD." class="h-9 bg-surface text-sm" />
          </div>

          <div>
            <label class="block text-xs font-semibold text-foreground mb-1">Account Number *</label>
            <Input v-model="editing.account_number" placeholder="000 123 456" class="h-9 bg-surface text-sm font-mono" />
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-semibold text-foreground mb-1">Account Type</label>
              <select
                v-model="editing.account_type"
                class="w-full h-9 px-3 text-xs bg-surface border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-cta/30 focus:border-cta"
              >
                <option value="checking">Checking</option>
                <option value="savings">Savings</option>
                <option value="business">Business Corporate</option>
              </select>
            </div>

            <div>
              <label class="block text-xs font-semibold text-foreground mb-1">Currency</label>
              <Input v-model="editing.currency" placeholder="USD" class="h-9 bg-surface text-sm font-mono" />
            </div>
          </div>

          <div class="flex items-center justify-between pt-2 border-t border-border">
            <div>
              <span class="text-xs font-semibold text-foreground block">Default Account</span>
              <span class="text-[11px] text-muted-foreground">Primary account for invoices</span>
            </div>
            <Switch
              :checked="editing.is_default"
              @update:checked="(val) => editing!.is_default = val"
            />
          </div>
        </div>

        <DialogFooter class="gap-2 sm:gap-0 mt-4">
          <Button variant="outline" @click="showEditModal = false">Cancel</Button>
          <Button variant="primary" @click="save">Save Account</Button>
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
