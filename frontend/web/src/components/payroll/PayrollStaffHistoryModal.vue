<script setup lang="ts">
import { History, DollarSign } from 'lucide-vue-next'
import {
  Button,
  Badge,
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
  historyStaff: any | null
}

defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:open', val: boolean): void
  (e: 'disburse', userId: string, availableBalance: number): void
}>()
</script>

<template>
  <Dialog :open="open" @update:open="(val) => emit('update:open', val)">
    <DialogContent class="sm:max-w-md max-h-[80vh] flex flex-col">
      <DialogHeader>
        <DialogTitle class="font-display flex items-center gap-2">
          <History :size="18" class="text-primary" />
          <span>13th-Month Payout History</span>
        </DialogTitle>
        <DialogDescription v-if="historyStaff">
          Past disbursements for <span class="font-semibold text-foreground">{{ historyStaff.name }}</span> ({{ historyStaff.role }} • {{ historyStaff.department || 'General' }})
        </DialogDescription>
      </DialogHeader>

      <div v-if="historyStaff" class="py-2 flex-1 overflow-y-auto space-y-3">
        <!-- Summary Badge Box -->
        <div class="grid grid-cols-3 gap-2 bg-muted/40 p-3 rounded-lg border border-border text-center">
          <div>
            <span class="text-3xs text-muted-foreground block">Total Accrued</span>
            <span class="text-xs font-bold text-emerald-600 font-mono">+{{ formatMoney(historyStaff.total_accrued) }}</span>
          </div>
          <div>
            <span class="text-3xs text-muted-foreground block">Disbursed</span>
            <span class="text-xs font-bold text-amber-600 font-mono">-{{ formatMoney(historyStaff.total_disbursed) }}</span>
          </div>
          <div>
            <span class="text-3xs text-muted-foreground block">Available</span>
            <span class="text-xs font-bold text-primary font-mono">{{ formatMoney(historyStaff.available_balance) }}</span>
          </div>
        </div>

        <!-- History List -->
        <div v-if="historyStaff.payouts && historyStaff.payouts.length > 0" class="divide-y divide-border border border-border rounded-lg bg-surface overflow-hidden">
          <div
            v-for="payout in historyStaff.payouts"
            :key="payout.id"
            class="p-3 flex items-center justify-between gap-3 text-xs"
          >
            <div>
              <div class="font-semibold text-foreground flex items-center gap-2">
                <span>{{ payout.payout_date ? new Date(payout.payout_date).toLocaleDateString() : 'N/A' }}</span>
                <Badge variant="outline" class="text-[10px] px-1.5 py-0">{{ payout.payment_method || 'Cash' }}</Badge>
              </div>
              <div class="text-muted-foreground text-3xs mt-0.5">{{ payout.notes || '13th Month / Seniority Payout' }}</div>
            </div>
            <div class="font-mono font-bold text-amber-600 text-sm text-right">
              -{{ formatMoney(payout.amount) }}
            </div>
          </div>
        </div>

        <div v-else class="text-center py-6 text-muted-foreground text-xs italic">
          No past payout disbursements recorded for this employee yet.
        </div>
      </div>

      <DialogFooter class="mt-2">
        <Button variant="outline" @click="emit('update:open', false)">Close</Button>
        <Button
          v-if="historyStaff && historyStaff.available_balance > 0"
          variant="primary"
          class="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
          @click="() => {
            const uid = historyStaff?.user_id
            const bal = historyStaff?.available_balance
            emit('update:open', false)
            if (uid) emit('disburse', uid, bal)
          }"
        >
          <DollarSign :size="14" />
          <span>Disburse Payout</span>
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
