<script setup lang="ts">
import { Gift } from 'lucide-vue-next'
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui'
import { formatMoney } from '@/utils/payrollCalculations'

interface Props {
  open: boolean
  activeStaffUsers: any[]
  thirteenthMonthSummaries: Record<string, any>
}

defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:open', val: boolean): void
  (e: 'open-payout', userId: string): void
}>()
</script>

<template>
  <Dialog :open="open" @update:open="(val) => emit('update:open', val)">
    <DialogContent class="sm:max-w-xl max-h-[85vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle class="font-display flex items-center gap-2">
          <Gift :size="18" class="text-primary" />
          <span>13th-Month Seniority Reserves</span>
        </DialogTitle>
        <DialogDescription>
          Cumulative monthly seniority accruals (base salary ÷ 12 per month) and standalone bonus disbursements.
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
              <div class="text-3xs text-muted-foreground">
                Accrued: {{ formatMoney(thirteenthMonthSummaries[u.id]?.total_accrued || 0) }} • Paid: {{ formatMoney(thirteenthMonthSummaries[u.id]?.total_paid_out || thirteenthMonthSummaries[u.id]?.total_disbursed || 0) }}
              </div>
            </div>

            <div class="flex items-center gap-3">
              <div class="text-right">
                <span class="text-3xs text-muted-foreground block font-semibold">Available</span>
                <span class="font-bold text-xs font-mono text-primary">
                  {{ formatMoney(thirteenthMonthSummaries[u.id]?.available_balance || 0) }}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                class="h-7 px-2 text-xs gap-1"
                @click="emit('open-payout', u.id)"
              >
                <Gift :size="12" />
                <span>Disburse</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <DialogFooter class="mt-4">
        <Button variant="outline" @click="emit('update:open', false)">Close</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
