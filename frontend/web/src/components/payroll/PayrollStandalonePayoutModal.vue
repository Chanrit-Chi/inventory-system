<script setup lang="ts">
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Input,
} from '@/components/ui'

interface Props {
  open: boolean
  amount: number
  notes: string
  isSaving?: boolean
}

defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:open', val: boolean): void
  (e: 'update:amount', val: number): void
  (e: 'update:notes', val: string): void
  (e: 'save'): void
}>()
</script>

<template>
  <Dialog :open="open" @update:open="(val) => emit('update:open', val)">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle class="font-display">Record Standalone Bonus</DialogTitle>
        <DialogDescription>
          Disburse seniority bonus (e.g. Khmer New Year or Year-End bonus).
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-3 py-2 text-xs">
        <div>
          <label class="block text-xs font-semibold text-foreground mb-1">Payout Amount ($) *</label>
          <Input
            :model-value="amount"
            type="number"
            min="1"
            step="10"
            class="h-9 font-mono"
            @update:model-value="(val) => emit('update:amount', Number(val))"
          />
        </div>
        <div>
          <label class="block text-xs font-semibold text-foreground mb-1">Purpose / Notes</label>
          <Input
            :model-value="notes"
            class="h-9"
            placeholder="e.g. Khmer New Year bonus"
            @update:model-value="(val) => emit('update:notes', String(val))"
          />
        </div>
      </div>

      <DialogFooter class="gap-2 sm:gap-0 mt-4">
        <Button variant="outline" :disabled="isSaving" @click="emit('update:open', false)">Cancel</Button>
        <Button variant="primary" :disabled="isSaving" @click="emit('save')">
          <span v-if="isSaving">⏳</span>
          <span v-else>Record Payout</span>
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
