<script setup lang="ts">
import {
  Button,
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
  loading?: boolean
}

defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:open', val: boolean): void
  (e: 'cancel'): void
  (e: 'confirm'): void
}>()
</script>

<template>
  <Dialog :open="open" @update:open="(val) => { if (!val) emit('cancel'); else emit('update:open', val); }">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle class="text-destructive font-display">Confirm Staff Deletion</DialogTitle>
        <DialogDescription>
          Are you sure you want to delete staff account <strong>"{{ user?.name }}"</strong>? This action cannot be undone.
        </DialogDescription>
      </DialogHeader>

      <Alert v-if="user?.role === 'SUPER_ADMIN'" variant="error" class="my-2">
        The Super Admin account is protected and cannot be deleted.
      </Alert>

      <DialogFooter class="gap-2 sm:gap-0 mt-4">
        <Button
          id="btn-cancel-delete-user"
          variant="outline"
          :disabled="loading"
          @click="emit('cancel')"
        >
          Cancel
        </Button>
        <Button
          id="btn-confirm-delete-user"
          variant="destructive"
          :disabled="loading || user?.role === 'SUPER_ADMIN'"
          @click="emit('confirm')"
        >
          <span v-if="loading" class="animate-spin mr-1">⏳</span>
          <span>{{ loading ? 'Deleting…' : 'Delete Staff Account' }}</span>
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
