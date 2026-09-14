<script setup lang="ts">
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui'

interface Props {
  open: boolean
  isDeleting?: boolean
}

defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:open', val: boolean): void
  (e: 'confirm'): void
  (e: 'cancel'): void
}>()
</script>

<template>
  <Dialog :open="open" @update:open="(val) => { emit('update:open', val); if (!val) emit('cancel'); }">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle class="text-destructive font-display">Confirm Payroll Deletion</DialogTitle>
        <DialogDescription>
          Are you sure you want to delete this payroll record? This action cannot be undone.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter class="gap-2 sm:gap-0 mt-4">
        <Button variant="outline" :disabled="isDeleting" @click="emit('cancel')">
          Cancel
        </Button>
        <Button variant="destructive" :disabled="isDeleting" @click="emit('confirm')">
          <span v-if="isDeleting" class="animate-spin mr-1.5">⏳</span>
          <span>{{ isDeleting ? 'Deleting…' : 'Delete Payroll' }}</span>
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
