<script setup lang="ts">
import { Plus, Printer, Edit2, Trash2 } from 'lucide-vue-next'
import {
  Button,
  Badge,
  Alert,
  Skeleton,
  EmptyState,
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from '@/components/ui'

export interface PrinterDevice {
  id: string
  name: string
  connectionType: 'wifi' | 'bluetooth'
  ipAddress: string
  port: number
  bluetoothName?: string
  paperWidth: '80mm' | '58mm'
  role: 'receipt' | 'kitchen'
  isDefault: boolean
  autoCut: boolean
}

interface Props {
  printers: PrinterDevice[]
  loading?: boolean
  error?: string
  testingPrinterId?: string | null
}

defineProps<Props>()
const emit = defineEmits<{
  (e: 'add'): void
  (e: 'test', printer: PrinterDevice): void
  (e: 'edit', printer: PrinterDevice): void
  (e: 'delete', id: string): void
}>()
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h2 class="font-display font-bold text-base text-foreground">Thermal Printer Stations</h2>
        <p class="text-xs text-muted-foreground mt-0.5">
          Configure WiFi and Bluetooth ESC/POS thermal printers for customer receipts and kitchen tickets (80mm / 58mm).
        </p>
      </div>
      <Button id="btn-add-printer" variant="primary" size="sm" class="gap-1.5" @click="emit('add')">
        <Plus :size="15" />
        <span>Add Printer Station</span>
      </Button>
    </div>

    <Alert v-if="error" variant="error">
      {{ error }}
    </Alert>

    <div class="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
      <div v-if="loading" class="p-6 space-y-3">
        <Skeleton v-for="i in 3" :key="i" class="h-12 w-full" />
      </div>

      <EmptyState
        v-else-if="printers.length === 0"
        :icon="Printer"
        title="No Printer Stations Configured"
        description="Add your first thermal printer station to begin printing sales receipts and kitchen order tickets."
      >
        <template #action>
          <Button variant="primary" size="sm" class="gap-1.5" @click="emit('add')">
            <Plus :size="15" />
            <span>Add First Printer</span>
          </Button>
        </template>
      </EmptyState>

      <div v-else class="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow class="bg-muted/40">
              <TableHead>Station Name</TableHead>
              <TableHead>Connection</TableHead>
              <TableHead class="font-mono">Target</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Paper Width</TableHead>
              <TableHead>Cut Mode</TableHead>
              <TableHead class="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="p in printers" :key="p.id" class="hover:bg-surface-subtle/80 transition-colors">
              <TableCell>
                <div class="font-semibold text-foreground text-sm">{{ p.name }}</div>
                <div v-if="p.isDefault" class="mt-0.5">
                  <Badge variant="success" class="text-[9px] px-1.5 py-0 font-mono">Default</Badge>
                </div>
              </TableCell>

              <TableCell>
                <Badge :variant="p.connectionType === 'wifi' ? 'info' : 'purple'" class="text-[10px] px-2 py-0.5">
                  {{ p.connectionType === 'wifi' ? 'WiFi / LAN' : 'Bluetooth' }}
                </Badge>
              </TableCell>

              <TableCell class="font-mono text-xs text-muted-foreground">
                <span v-if="p.connectionType === 'wifi'" class="px-1.5 py-0.5 rounded bg-muted">
                  {{ p.ipAddress }}:{{ p.port }}
                </span>
                <span v-else>{{ p.bluetoothName || '—' }}</span>
              </TableCell>

              <TableCell>
                <Badge :variant="p.role === 'receipt' ? 'info' : 'warning'" class="text-[10px] px-2 py-0.5">
                  {{ p.role === 'receipt' ? 'Receipt' : 'Kitchen' }}
                </Badge>
              </TableCell>

              <TableCell class="font-mono text-xs text-muted-foreground">
                {{ p.paperWidth }}
              </TableCell>

              <TableCell>
                <Badge :variant="p.autoCut ? 'success' : 'neutral'" class="text-[10px] px-2 py-0.5">
                  {{ p.autoCut ? 'Auto-cut' : 'Manual' }}
                </Badge>
              </TableCell>

              <TableCell class="text-right">
                <div class="flex items-center justify-end gap-1.5">
                  <Button
                    :id="`btn-test-printer-${p.id}`"
                    variant="ghost"
                    size="sm"
                    class="h-8 px-2.5 text-xs gap-1"
                    :disabled="testingPrinterId === p.id"
                    @click="emit('test', p)"
                  >
                    <Printer :size="13" />
                    <span>{{ testingPrinterId === p.id ? 'Testing…' : 'Test' }}</span>
                  </Button>
                  <Button
                    :id="`btn-edit-printer-${p.id}`"
                    variant="ghost"
                    size="sm"
                    class="h-8 px-2.5 text-xs gap-1"
                    @click="emit('edit', p)"
                  >
                    <Edit2 :size="13" />
                    <span>Edit</span>
                  </Button>
                  <Button
                    :id="`btn-delete-printer-${p.id}`"
                    variant="ghost"
                    size="sm"
                    class="h-8 px-2 text-xs text-destructive hover:bg-destructive/10"
                    @click="emit('delete', p.id)"
                  >
                    <Trash2 :size="14" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  </div>
</template>
