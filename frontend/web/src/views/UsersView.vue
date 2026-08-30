<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useUserStore, type User } from '@/stores/userStore'
import { useToast } from '@/composables/useToast'
import {
  Users,
  Plus,
  Search,
  RefreshCw,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  UserCheck,
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
const store = useUserStore()

const showEditModal = ref(false)
const editingUser = ref<Partial<User & { password?: string }> | null>(null)
const filters = ref({ page: 1, per_page: 15, search: '', role: '' })

const isDeleteDialogOpen = ref(false)
const deletingUserId = ref<string | null>(null)
const isDeleting = ref(false)

const users = computed(() => store.users)
const totalUsersCount = computed(() => store.meta?.total ?? users.value.length)
const activeUsersCount = computed(() => users.value.filter(u => u.status === 'active').length)
const adminUsersCount = computed(() => users.value.filter(u => u.role === 'admin').length)

async function loadUsers() {
  try {
    await store.fetchUsers({
      page: filters.value.page,
      per_page: filters.value.per_page,
      search: filters.value.search || undefined,
      role: filters.value.role || undefined,
    })
  } catch (err) {
    const e = err as { message?: string }
    toast.error(e.message || 'Failed to load users')
  }
}

function openCreate() {
  editingUser.value = { name: '', email: '', role: 'staff', status: 'active' }
  showEditModal.value = true
}

function openEdit(user: User) {
  editingUser.value = { ...user }
  showEditModal.value = true
}

async function handleSave() {
  if (!editingUser.value || !editingUser.value.name?.trim() || !editingUser.value.email?.trim()) {
    toast.error('Name and email are required')
    return
  }
  try {
    if (editingUser.value.id) {
      await store.updateUser(editingUser.value.id, editingUser.value)
      toast.success('User account updated')
    } else {
      await store.createUser(editingUser.value)
      toast.success('User account created')
    }
    showEditModal.value = false
    await loadUsers()
  } catch (err) {
    const e = err as { message?: string }
    toast.error(e.message || 'Failed to save user')
  }
}

async function handleStatusToggle(user: User) {
  const newStatus = user.status === 'active' ? 'inactive' : 'active'
  try {
    await store.updateStatus(user.id, newStatus)
    toast.success(`User ${newStatus === 'active' ? 'activated' : 'deactivated'}`)
    await loadUsers()
  } catch (err) {
    const e = err as { message?: string }
    toast.error(e.message || 'Failed to update status')
  }
}

function confirmDelete(id: string) {
  deletingUserId.value = id
  isDeleteDialogOpen.value = true
}

function cancelDelete() {
  deletingUserId.value = null
  isDeleteDialogOpen.value = false
}

async function executeDelete() {
  if (!deletingUserId.value) return
  isDeleting.value = true
  try {
    await store.deleteUser(deletingUserId.value)
    toast.success('User deleted')
    isDeleteDialogOpen.value = false
    deletingUserId.value = null
    await loadUsers()
  } catch (err) {
    const e = err as { message?: string }
    toast.error(e.message || 'Failed to delete user')
  } finally {
    isDeleting.value = false
  }
}

function getInitials(name: string): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

function nextPage() {
  if (store.meta && filters.value.page < store.meta.last_page) {
    filters.value.page += 1
    loadUsers()
  }
}
function prevPage() {
  if (filters.value.page > 1) {
    filters.value.page -= 1
    loadUsers()
  }
}

onMounted(loadUsers)
</script>

<template>
  <div class="flex flex-col gap-6 max-w-6xl mx-auto w-full">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-3">
          <h1 class="text-2xl sm:text-3xl font-display font-bold text-foreground tracking-tight">Staff & Users</h1>
          <Badge variant="info" class="font-mono text-xs px-2.5 py-0.5">
            {{ totalUsersCount }} Users
          </Badge>
        </div>
        <p class="text-xs text-muted-foreground mt-0.5">
          Manage employee user accounts, assigned system roles, and account active statuses.
        </p>
      </div>

      <Button variant="primary" size="sm" class="h-9 px-3.5 gap-1.5" @click="openCreate">
        <Plus :size="15" />
        <span>Add User</span>
      </Button>
    </div>

    <!-- Stat Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <StatCard
        label="Total Staff Accounts"
        :value="totalUsersCount"
        sub="Registered system users"
        :icon="Users"
        icon-variant="primary"
      />
      <StatCard
        label="Active Users"
        :value="activeUsersCount"
        sub="Authorized to login"
        :icon="UserCheck"
        icon-variant="success"
      />
      <StatCard
        label="Administrators"
        :value="adminUsersCount"
        sub="Full security privileges"
        :icon="ShieldCheck"
        icon-variant="purple"
      />
    </div>

    <!-- Search & Filter Toolbar -->
    <div class="rounded-xl border border-border bg-card p-3.5 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
      <div class="flex-1 max-w-md">
        <Input
          v-model="filters.search"
          type="text"
          placeholder="Search by name or email…"
          class="bg-surface"
          @keyup.enter="loadUsers"
        >
          <template #prefix>
            <Search :size="16" />
          </template>
        </Input>
      </div>

      <div class="flex items-center gap-2.5">
        <select
          v-model="filters.role"
          class="h-9 px-3 text-sm bg-surface border border-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-cta/30 focus:border-cta"
          @change="loadUsers"
        >
          <option value="">All Roles</option>
          <option value="admin">Administrator</option>
          <option value="manager">Store Manager</option>
          <option value="staff">Sales Staff</option>
        </select>

        <Button variant="outline" size="sm" class="h-9 px-3.5 text-xs gap-1.5" :disabled="store.loading" @click="loadUsers">
          <RefreshCw :size="14" :class="{ 'animate-spin': store.loading }" />
          <span>Filter</span>
        </Button>
      </div>
    </div>

    <!-- Users Table Container -->
    <div class="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
      <div v-if="store.loading" class="p-6 space-y-3">
        <Skeleton v-for="i in 4" :key="i" class="h-12 w-full" />
      </div>

      <EmptyState
        v-else-if="!users.length"
        :icon="Users"
        title="No users found"
        description="No user accounts found matching the current search parameters."
      />

      <div v-else class="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow class="bg-muted/40">
              <TableHead>User Profile</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead class="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="u in users" :key="u.id" class="hover:bg-surface-subtle/80 transition-colors">
              <TableCell>
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-bold text-xs flex-shrink-0">
                    {{ getInitials(u.name) }}
                  </div>
                  <span class="font-semibold text-foreground">{{ u.name }}</span>
                </div>
              </TableCell>

              <TableCell class="text-xs text-muted-foreground font-mono">
                {{ u.email }}
              </TableCell>

              <TableCell>
                <Badge variant="info" class="text-[10px] px-2 py-0.5 uppercase font-mono">
                  {{ u.role }}
                </Badge>
              </TableCell>

              <TableCell>
                <Badge :variant="u.status === 'active' ? 'success' : 'neutral'" class="text-[10px] px-2 py-0.5">
                  {{ u.status }}
                </Badge>
              </TableCell>

              <TableCell class="text-right">
                <div class="flex items-center justify-end gap-1.5">
                  <Button variant="ghost" size="sm" class="h-8 px-2.5 text-xs gap-1" @click="openEdit(u)">
                    <Edit2 :size="13" />
                    <span>Edit</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    class="h-8 px-2.5 text-xs gap-1"
                    :class="u.status === 'active' ? 'text-warning' : 'text-success'"
                    @click="handleStatusToggle(u)"
                  >
                    <component :is="u.status === 'active' ? XCircle : CheckCircle2" :size="13" />
                    <span>{{ u.status === 'active' ? 'Deactivate' : 'Activate' }}</span>
                  </Button>
                  <Button variant="ghost" size="sm" class="h-8 px-2 text-xs text-destructive hover:bg-destructive/10" @click="confirmDelete(u.id)">
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

    <!-- User Edit Dialog -->
    <Dialog :open="showEditModal" @update:open="(val) => showEditModal = val">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle class="font-display">{{ editingUser?.id ? 'Edit User Profile' : 'Add Staff User' }}</DialogTitle>
          <DialogDescription>
            Configure user credentials, functional role permissions, and active status.
          </DialogDescription>
        </DialogHeader>

        <div v-if="editingUser" class="flex flex-col gap-3 py-2">
          <div>
            <label class="block text-xs font-semibold text-foreground mb-1">Full Name *</label>
            <Input v-model="editingUser.name" placeholder="John Doe" class="h-9 bg-surface text-sm" />
          </div>

          <div>
            <label class="block text-xs font-semibold text-foreground mb-1">Email Address *</label>
            <Input v-model="editingUser.email" type="email" placeholder="john@example.com" class="h-9 bg-surface text-sm font-mono" />
          </div>

          <div v-if="!editingUser.id">
            <label class="block text-xs font-semibold text-foreground mb-1">Initial Password *</label>
            <Input v-model="editingUser.password" type="password" placeholder="••••••••" class="h-9 bg-surface text-sm font-mono" />
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-semibold text-foreground mb-1">System Role</label>
              <select
                v-model="editingUser.role"
                class="w-full h-9 px-3 text-xs bg-surface border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-cta/30 focus:border-cta"
              >
                <option value="admin">Administrator</option>
                <option value="manager">Store Manager</option>
                <option value="staff">Sales Staff</option>
              </select>
            </div>

            <div>
              <label class="block text-xs font-semibold text-foreground mb-1">Account Status</label>
              <select
                v-model="editingUser.status"
                class="w-full h-9 px-3 text-xs bg-surface border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-cta/30 focus:border-cta"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
        </div>

        <DialogFooter class="gap-2 sm:gap-0 mt-4">
          <Button variant="outline" @click="showEditModal = false">Cancel</Button>
          <Button variant="primary" @click="handleSave">Save User</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Delete Confirmation Dialog -->
    <Dialog :open="isDeleteDialogOpen" @update:open="(val) => { isDeleteDialogOpen = val; if (!val) cancelDelete(); }">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle class="text-destructive font-display">Confirm User Deletion</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this user account? This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter class="gap-2 sm:gap-0 mt-4">
          <Button variant="outline" :disabled="isDeleting" @click="cancelDelete">
            Cancel
          </Button>
          <Button variant="destructive" :disabled="isDeleting" @click="executeDelete">
            <span v-if="isDeleting" class="animate-spin mr-1.5">⏳</span>
            <span>{{ isDeleting ? 'Deleting…' : 'Delete User' }}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
