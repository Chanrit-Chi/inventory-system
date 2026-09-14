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
  activeStaffUsers: any[]
  salaryDrafts: Record<string, number>
  salarySavingUser?: string | null
}

defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:open', val: boolean): void
  (e: 'save', userId: string): void
}>()
</script>

<template>
  <Dialog :open="open" @update:open="(val) => emit('update:open', val)">
    <DialogContent class="sm:max-w-xl max-h-[85vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle class="font-display">Staff Base Salary Rates</DialogTitle>
        <DialogDescription>
          Configure monthly base pay in USD across all active staff profiles.
        </DialogDescription>
      </DialogHeader>

      <div class="py-2 space-y-2 text-xs">
        <div class="rounded-lg border border-border divide-y divide-border bg-surface">
          <div
            v-for="u in activeStaffUsers"
            :key="u.id"
            class="flex items-center justify-between p-3 gap-3"
          >
            <div>
              <div class="font-semibold text-foreground text-xs">{{ u.name }}</div>
              <div class="text-3xs text-muted-foreground">{{ u.role }} • {{ u.department || 'Operations' }}</div>
            </div>

            <div class="flex items-center gap-2">
              <span class="text-xs text-muted-foreground font-mono">$</span>
              <Input
                v-model.number="salaryDrafts[u.id]"
                type="number"
                min="0"
                step="10"
                placeholder="e.g. 500"
                class="h-8 w-28 text-xs font-mono font-bold"
              />
              <Button
                variant="primary"
                size="sm"
                class="h-8 px-2.5 text-xs"
                :disabled="salarySavingUser === u.id"
                @click="emit('save', u.id)"
              >
                <span v-if="salarySavingUser === u.id">⏳</span>
                <span v-else>Save</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <DialogFooter class="mt-4">
        <Button variant="outline" @click="emit('update:open', false)">Done</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
