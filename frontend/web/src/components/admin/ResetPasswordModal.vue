<script setup lang="ts">
import { Key, Eye, EyeOff, RefreshCw, Check, Lock } from 'lucide-vue-next'
import {
  Button,
  Badge,
  Input,
  Alert,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui'

interface Props {
  open: boolean
  user: any | null
  modelValue: string
  showPassword?: boolean
  copied?: boolean
  loading?: boolean
  error?: string
}

defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:open', val: boolean): void
  (e: 'update:modelValue', val: string): void
  (e: 'toggle-show-password'): void
  (e: 'regenerate'): void
  (e: 'copy'): void
  (e: 'confirm'): void
  (e: 'cancel'): void
}>()

function getInitials(name?: string): string {
  if (!name) return 'U'
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0]?.toUpperCase())
    .join('') || 'U'
}
</script>

<template>
  <Dialog :open="open" @update:open="(val) => { if (!val) emit('cancel'); else emit('update:open', val); }">
    <DialogContent class="sm:max-w-sm">
      <DialogHeader>
        <DialogTitle class="font-display flex items-center gap-2">
          <span class="inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400">
            <Key :size="14" />
          </span>
          Reset Password
        </DialogTitle>
        <DialogDescription class="mt-1">
          Set a new temporary password for
          <strong class="text-foreground font-semibold">{{ user?.name }}</strong>.
          The user will be required to change it on their next login.
        </DialogDescription>
      </DialogHeader>

      <div class="flex flex-col gap-4 py-2">
        <!-- User avatar chip -->
        <div class="flex items-center gap-2.5 py-2.5 px-3 rounded-lg bg-surface border border-border">
          <div class="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary font-mono flex-shrink-0">
            {{ getInitials(user?.name) }}
          </div>
          <div class="min-w-0">
            <p class="text-xs font-semibold text-foreground truncate">{{ user?.name }}</p>
            <p class="text-[11px] text-muted-foreground truncate font-mono">{{ user?.email }}</p>
          </div>
          <Badge :variant="user?.role === 'SUPER_ADMIN' ? 'destructive' : user?.role === 'ADMIN' ? 'warning' : 'info'" class="ml-auto text-[10px] font-mono flex-shrink-0">
            {{ user?.role }}
          </Badge>
        </div>

        <!-- Password field -->
        <div class="flex flex-col gap-2">
          <label class="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Temporary Password</label>
          <div class="flex items-center gap-1.5">
            <div class="relative flex-1">
              <Input
                id="reset-password-input"
                :model-value="modelValue"
                :type="showPassword ? 'text' : 'password'"
                class="h-9 pr-9 font-mono text-sm"
                autocomplete="new-password"
                placeholder="Enter or generate a password…"
                @update:model-value="(val) => emit('update:modelValue', String(val))"
              />
              <button
                type="button"
                class="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                :title="showPassword ? 'Hide password' : 'Show password'"
                @click="emit('toggle-show-password')"
              >
                <EyeOff v-if="showPassword" :size="15" />
                <Eye v-else :size="15" />
              </button>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              class="h-9 px-2.5 flex-shrink-0 text-xs gap-1"
              title="Generate new secure password"
              @click="emit('regenerate')"
            >
              <RefreshCw :size="13" />
              <span>Regen</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              class="h-9 px-2.5 flex-shrink-0 text-xs gap-1"
              :class="copied ? 'text-green-600 border-green-300' : ''"
              title="Copy password to clipboard"
              @click="emit('copy')"
            >
              <Check v-if="copied" :size="13" />
              <span v-if="copied">Copied!</span>
              <span v-else>📋 Copy</span>
            </Button>
          </div>
          <p class="text-[11px] text-muted-foreground">Minimum 8 characters. Click <strong>Regen</strong> to auto-generate a secure password.</p>
        </div>

        <!-- Warning note -->
        <Alert variant="warning" class="py-3 text-xs">
          <Lock :size="13" class="inline mr-1 flex-shrink-0" />
          <span>The user will be <strong>forced to change their password</strong> on next login. Make sure to share this password securely (e.g. in person or via a secure channel).</span>
        </Alert>

        <!-- Error -->
        <Alert v-if="error" variant="error" class="py-2 text-xs">
          {{ error }}
        </Alert>
      </div>

      <DialogFooter class="gap-2 sm:gap-0">
        <Button
          id="btn-cancel-reset-password"
          variant="outline"
          :disabled="loading"
          @click="emit('cancel')"
        >
          Cancel
        </Button>
        <Button
          id="btn-confirm-reset-password"
          variant="primary"
          :disabled="loading || !modelValue || modelValue.length < 8"
          class="gap-1.5"
          @click="emit('confirm')"
        >
          <span v-if="loading" class="animate-spin mr-0.5">⏳</span>
          <Key v-else :size="14" />
          <span>{{ loading ? 'Resetting…' : 'Reset Password' }}</span>
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
