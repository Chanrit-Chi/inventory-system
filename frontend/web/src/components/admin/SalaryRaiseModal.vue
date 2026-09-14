<script setup lang="ts">
import { TrendingUp } from 'lucide-vue-next'
import {
  Button,
  Input,
  DatePicker,
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
  salaryAmount: string | number
  reason: string
  effectiveDate: string
  saving?: boolean
  error?: string
}

defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:open', val: boolean): void
  (e: 'update:salaryAmount', val: string | number): void
  (e: 'update:reason', val: string): void
  (e: 'update:effectiveDate', val: string): void
  (e: 'submit'): void
  (e: 'cancel'): void
}>()
</script>

<template>
  <Dialog :open="open" @update:open="(val) => { if (!val) emit('cancel'); else emit('update:open', val); }">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle class="font-display flex items-center gap-2">
          <TrendingUp class="w-5 h-5 text-emerald-600" />
          <span>Grant Salary Raise — {{ user?.name }}</span>
        </DialogTitle>
        <DialogDescription>
          Update base monthly compensation package and record merit history.
        </DialogDescription>
      </DialogHeader>

      <Alert v-if="error" variant="error" class="mb-2">
        {{ error }}
      </Alert>

      <form @submit.prevent="emit('submit')" class="space-y-3 py-1">
        <div>
          <label class="block text-xs font-semibold text-foreground mb-1">New Monthly Base Salary ($ USD) *</label>
          <Input
            :model-value="salaryAmount"
            type="number"
            step="0.01"
            min="0"
            placeholder="e.g. 400.00"
            class="h-9 bg-surface text-xs font-mono"
            @update:model-value="(val) => emit('update:salaryAmount', val)"
          >
            <template #prefix>
              <span class="text-xs text-muted-foreground">$</span>
            </template>
          </Input>
        </div>

        <div>
          <label class="block text-xs font-semibold text-foreground mb-1">Raise Reason / Merit Note *</label>
          <Input
            :model-value="reason"
            type="text"
            placeholder="e.g. Annual Merit Promotion / Sales Target Achievement"
            class="h-9 bg-surface text-xs"
            @update:model-value="(val) => emit('update:reason', String(val))"
          />
        </div>

        <div>
          <label class="block text-xs font-semibold text-foreground mb-1">Effective Date</label>
          <DatePicker
            :model-value="effectiveDate"
            placeholder="Select effective date"
            class="h-9 w-full bg-surface text-xs"
            @update:model-value="(val) => emit('update:effectiveDate', String(val))"
          />
        </div>

        <DialogFooter class="gap-2 sm:gap-0 mt-3">
          <Button variant="outline" type="button" :disabled="saving" @click="emit('cancel')">Cancel</Button>
          <Button variant="primary" type="submit" class="font-bold" :disabled="saving">
            <span v-if="saving" class="animate-spin mr-1">⏳</span>
            <span>{{ saving ? 'Saving…' : 'Record Raise' }}</span>
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
