<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { StaffMember } from '@/stores/posStore'
import { useAuthStore } from '@/stores/authStore'
import {
  X,
  Search,
  User,
  Check,
  RotateCcw,
  Sparkles,
} from 'lucide-vue-next'

interface Props {
  open: boolean
  staffMembers: StaffMember[]
  selectedId?: number | string | null
  currentUserId?: string | null
}

const props = withDefaults(defineProps<Props>(), {
  open: false,
  selectedId: null,
  currentUserId: null,
})

const emit = defineEmits<{
  'update:open': [value: boolean]
  'select': [member: StaffMember]
}>()

const authStore = useAuthStore()
const search = ref('')

const effectiveUserId = computed(() => props.currentUserId || authStore.user?.id || '')

const activeUsers = computed(() => {
  const list = Array.isArray(props.staffMembers) ? props.staffMembers : []
  return list.filter((u) => {
    if (u.is_active === false) return false
    return true
  })
})

const filteredUsers = computed(() => {
  if (!search.value.trim()) return activeUsers.value
  const q = search.value.toLowerCase().trim()
  return activeUsers.value.filter(
    (u) =>
      u.name?.toLowerCase().includes(q) ||
      u.role?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.department?.toLowerCase().includes(q)
  )
})

const meUser = computed(() => {
  return activeUsers.value.find((u) => String(u.id) === String(effectiveUserId.value))
})

const isSomeoneElseSelected = computed(() => {
  if (!props.selectedId) return false
  return String(props.selectedId) !== String(effectiveUserId.value)
})

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      search.value = ''
    }
  }
)

function handleSelect(member: StaffMember) {
  emit('select', member)
  emit('update:open', false)
}

function handleResetToMe() {
  if (meUser.value) {
    handleSelect(meUser.value)
  } else if (authStore.user) {
    handleSelect({
      id: authStore.user.id,
      name: authStore.user.name,
      email: authStore.user.email,
      role: authStore.user.role,
      department: authStore.user.department || null,
      is_active: true,
    })
  }
}

function close() {
  emit('update:open', false)
}
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-110 flex items-center justify-center p-4">
    <!-- Backdrop -->
    <div
      class="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
      @click="close"
    />

    <!-- Dialog Body -->
    <div
      class="relative w-full max-w-lg rounded-2xl bg-card shadow-2xl border border-border overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in-0 zoom-in-95 duration-150 text-foreground"
    >
      <!-- Header -->
      <div class="px-5 py-3.5 bg-surface-subtle border-b border-border flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg bg-cta-muted border border-border-strong flex items-center justify-center text-primary shadow-2xs">
            <User class="w-4 h-4" />
          </div>
          <div>
            <h3 class="text-sm font-bold text-foreground font-display">Assign Sales Representative</h3>
            <p class="text-3xs text-muted-foreground">Select staff member who receives incentive & commission credit</p>
          </div>
        </div>

        <button
          type="button"
          @click="close"
          class="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-subtle transition-colors cursor-pointer"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Search & Quick Action Toolbar -->
      <div class="p-3.5 border-b border-border bg-card space-y-2.5">
        <!-- Search Input -->
        <div class="relative">
          <Search class="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            v-model="search"
            type="text"
            placeholder="Search staff by name, role, department..."
            class="w-full pl-9 pr-8 py-1.5 rounded-xl border border-input bg-surface-subtle text-xs text-foreground placeholder:text-muted-foreground/70 focus:bg-card focus:border-cta focus:ring-2 focus:ring-cta/20 outline-hidden transition-all"
          />
          <button
            v-if="search"
            type="button"
            @click="search = ''"
            class="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground"
          >
            <X class="w-3.5 h-3.5" />
          </button>
        </div>

        <!-- Quick "Reset to Me" Banner if someone else is selected -->
        <button
          v-if="isSomeoneElseSelected"
          type="button"
          @click="handleResetToMe"
          class="w-full px-3 py-2 rounded-xl bg-cta-muted border border-border-strong hover:bg-accent text-primary text-xs font-bold flex items-center justify-between transition-colors shadow-2xs cursor-pointer group"
        >
          <div class="flex items-center gap-2">
            <div class="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-3xs font-bold">
              <RotateCcw class="w-3 h-3" />
            </div>
            <span>Reset to Me ({{ meUser?.name || authStore.user?.name || 'Logged-in User' }})</span>
          </div>
          <span class="text-3xs font-mono bg-card px-2 py-0.5 rounded text-primary border border-border-strong">
            Default (Self)
          </span>
        </button>
      </div>

      <!-- Staff List -->
      <div class="p-3 overflow-y-auto space-y-1.5 flex-1 min-h-[220px] bg-background">
        <div
          v-if="filteredUsers.length === 0"
          class="py-10 text-center text-xs text-muted-foreground space-y-1"
        >
          <User class="w-8 h-8 mx-auto text-muted-foreground/40" />
          <p class="font-bold text-foreground">No staff members found</p>
          <p class="text-3xs text-muted-foreground">Try adjusting your search query.</p>
        </div>

        <button
          v-for="member in filteredUsers"
          :key="member.id"
          type="button"
          @click="handleSelect(member)"
          :class="[
            'w-full p-2.5 rounded-xl border text-left flex items-center justify-between gap-3 transition-all cursor-pointer shadow-2xs',
            String(selectedId) === String(member.id)
              ? 'bg-cta-muted border-cta ring-1 ring-cta/30'
              : 'bg-card border-border hover:bg-surface-subtle'
          ]"
        >
          <div class="flex items-center gap-3 min-w-0">
            <!-- Avatar -->
            <div
              :class="[
                'w-9 h-9 rounded-full flex items-center justify-center text-xs font-black uppercase shrink-0 shadow-2xs border',
                String(selectedId) === String(member.id)
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-surface-subtle text-primary border-border-strong'
              ]"
            >
              {{ member.name ? member.name.charAt(0) : 'U' }}
            </div>

            <!-- Metadata -->
            <div class="min-w-0">
              <div class="flex items-center gap-1.5">
                <span class="text-xs font-bold text-foreground truncate">{{ member.name }}</span>
                <span
                  v-if="String(member.id) === String(effectiveUserId)"
                  class="px-1.5 py-0.2 rounded-full bg-primary text-primary-foreground text-3xs font-bold uppercase tracking-wider"
                >
                  Me
                </span>
              </div>
              <div class="flex items-center gap-1.5 text-3xs text-muted-foreground font-mono mt-0.5 truncate">
                <span>{{ member.role || 'Staff' }}</span>
                <span v-if="member.department">· {{ member.department }}</span>
                <span v-if="member.email" class="hidden sm:inline">· {{ member.email }}</span>
              </div>
            </div>
          </div>

          <!-- Radio Indicator -->
          <div class="shrink-0">
            <div
              v-if="String(selectedId) === String(member.id)"
              class="w-5 h-5 rounded-full bg-cta text-cta-foreground flex items-center justify-center shadow-2xs"
            >
              <Check class="w-3.5 h-3.5 stroke-[3]" />
            </div>
            <div
              v-else
              class="w-5 h-5 rounded-full border border-border bg-surface-subtle"
            />
          </div>
        </button>
      </div>

      <!-- Footer -->
      <div class="px-5 py-3 bg-surface-subtle border-t border-border flex items-center justify-between">
        <span class="text-3xs text-muted-foreground">
          <Sparkles class="w-3 h-3 inline text-primary mr-1" />
          Attributed seller receives commission and daily settlement credits
        </span>
        <button
          type="button"
          @click="close"
          class="h-8 px-4 rounded-xl border border-border bg-card text-foreground font-bold text-xs hover:bg-surface-subtle transition-colors cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
</template>
