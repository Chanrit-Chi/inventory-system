<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  CalendarDate,
  parseDate,
  getLocalTimeZone,
  today,
  type DateValue,
} from '@internationalized/date'
import type { DateRange } from 'radix-vue'
import { Calendar as CalendarIcon, X } from 'lucide-vue-next'
import { Popover, PopoverContent, PopoverTrigger, Button } from './index'
import RangeCalendar from './RangeCalendar.vue'
import { cn } from '@/lib/utils'

interface Props {
  start?: string | null
  end?: string | null
  modelValue?: { start?: string | null; end?: string | null }
  placeholder?: string
  disabled?: boolean
  clearable?: boolean
  class?: string
  id?: string
}

const props = withDefaults(defineProps<Props>(), {
  start: null,
  end: null,
  modelValue: undefined,
  placeholder: 'Select date range',
  disabled: false,
  clearable: true,
  class: undefined,
  id: undefined,
})

const emits = defineEmits<{
  (e: 'update:start', val: string | null): void
  (e: 'update:end', val: string | null): void
  (e: 'update:modelValue', val: { start: string | null; end: string | null }): void
  (e: 'change', val: { start: string | null; end: string | null }): void
}>()

const isOpen = ref(false)

function parseToDateValue(val?: string | null): DateValue | undefined {
  if (!val) return undefined
  try {
    const match = val.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (match) {
      return parseDate(`${match[1]}-${match[2]}-${match[3]}`)
    }
  } catch {
    return undefined
  }
  return undefined
}

const activeStart = computed(() => props.modelValue?.start !== undefined ? props.modelValue.start : props.start)
const activeEnd = computed(() => props.modelValue?.end !== undefined ? props.modelValue.end : props.end)

const range = ref<DateRange>({
  start: parseToDateValue(activeStart.value) as DateRange['start'],
  end: parseToDateValue(activeEnd.value) as DateRange['end'],
})

watch(
  [() => activeStart.value, () => activeEnd.value],
  ([newStart, newEnd]) => {
    range.value = {
      start: parseToDateValue(newStart) as DateRange['start'],
      end: parseToDateValue(newEnd) as DateRange['end'],
    }
  },
)

function handleRangeChange(newRange: DateRange) {
  range.value = newRange
  const startStr = newRange.start ? newRange.start.toString() : null
  const endStr = newRange.end ? newRange.end.toString() : null

  emits('update:start', startStr)
  emits('update:end', endStr)
  emits('update:modelValue', { start: startStr, end: endStr })
  emits('change', { start: startStr, end: endStr })

  if (newRange.start && newRange.end) {
    isOpen.value = false
  }
}

function formatDate(dv?: { year: number; month: number; day: number } | DateValue | null) {
  if (!dv) return ''
  const dateObj = new Date(dv.year, dv.month - 1, dv.day)
  return dateObj.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

const formattedDisplay = computed(() => {
  if (!range.value.start) return ''
  if (!range.value.end) return `${formatDate(range.value.start)} - ...`
  return `${formatDate(range.value.start)} - ${formatDate(range.value.end)}`
})

function handleClear(e: Event) {
  e.stopPropagation()
  range.value = { start: undefined, end: undefined }
  emits('update:start', null)
  emits('update:end', null)
  emits('update:modelValue', { start: null, end: null })
  emits('change', { start: null, end: null })
}

function applyPreset(preset: 'today' | 'yesterday' | 'last7' | 'thisMonth' | 'last30') {
  const now = today(getLocalTimeZone())
  let startDv: DateValue = new CalendarDate(now.year, now.month, now.day)
  let endDv: DateValue = new CalendarDate(now.year, now.month, now.day)

  if (preset === 'today') {
    startDv = new CalendarDate(now.year, now.month, now.day)
    endDv = new CalendarDate(now.year, now.month, now.day)
  } else if (preset === 'yesterday') {
    const yDay = now.subtract({ days: 1 })
    startDv = new CalendarDate(yDay.year, yDay.month, yDay.day)
    endDv = new CalendarDate(yDay.year, yDay.month, yDay.day)
  } else if (preset === 'last7') {
    const d = now.subtract({ days: 6 })
    startDv = new CalendarDate(d.year, d.month, d.day)
    endDv = new CalendarDate(now.year, now.month, now.day)
  } else if (preset === 'thisMonth') {
    startDv = new CalendarDate(now.year, now.month, 1)
    endDv = new CalendarDate(now.year, now.month, now.day)
  } else if (preset === 'last30') {
    const d = now.subtract({ days: 29 })
    startDv = new CalendarDate(d.year, d.month, d.day)
    endDv = new CalendarDate(now.year, now.month, now.day)
  }

  handleRangeChange({ start: startDv as DateRange['start'], end: endDv as DateRange['end'] })
}
</script>

<template>
  <Popover v-model:open="isOpen">
    <PopoverTrigger as-child>
      <button
        :id="id"
        type="button"
        :disabled="disabled"
        :class="
          cn(
            'inline-flex items-center justify-between rounded-md border border-input bg-card px-3 py-1.5 text-xs font-normal shadow-xs transition-colors hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-ring/25 focus:border-ring disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer h-9 text-left select-none group',
            !range.start && 'text-muted-foreground',
            props.class,
          )
        "
      >
        <div class="flex items-center gap-2 truncate">
          <CalendarIcon class="h-3.5 w-3.5 shrink-0 opacity-60 text-foreground group-hover:opacity-100" />
          <span class="truncate font-medium">
            {{ range.start ? formattedDisplay : placeholder }}
          </span>
        </div>

        <div class="flex items-center gap-1 ml-2">
          <button
            v-if="clearable && (range.start || range.end) && !disabled"
            type="button"
            class="h-4 w-4 rounded-full inline-flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors p-0.5 cursor-pointer"
            title="Clear date range"
            @click="handleClear"
          >
            <X class="h-3 w-3" />
          </button>
        </div>
      </button>
    </PopoverTrigger>

    <PopoverContent class="w-auto p-0 border border-border shadow-xl rounded-xl overflow-hidden bg-card" align="start">
      <div class="flex flex-col sm:flex-row">
        <!-- Quick Presets Sidebar -->
        <div class="flex flex-row sm:flex-col gap-1 p-2 border-b sm:border-b-0 sm:border-r border-border bg-surface-subtle overflow-x-auto sm:overflow-x-visible min-w-28">
          <button
            type="button"
            class="px-2.5 py-1 text-left text-2xs font-medium rounded-md hover:bg-muted hover:text-foreground transition-colors cursor-pointer whitespace-nowrap"
            @click="applyPreset('today')"
          >
            Today
          </button>
          <button
            type="button"
            class="px-2.5 py-1 text-left text-2xs font-medium rounded-md hover:bg-muted hover:text-foreground transition-colors cursor-pointer whitespace-nowrap"
            @click="applyPreset('yesterday')"
          >
            Yesterday
          </button>
          <button
            type="button"
            class="px-2.5 py-1 text-left text-2xs font-medium rounded-md hover:bg-muted hover:text-foreground transition-colors cursor-pointer whitespace-nowrap"
            @click="applyPreset('last7')"
          >
            Last 7 days
          </button>
          <button
            type="button"
            class="px-2.5 py-1 text-left text-2xs font-medium rounded-md hover:bg-muted hover:text-foreground transition-colors cursor-pointer whitespace-nowrap"
            @click="applyPreset('thisMonth')"
          >
            This month
          </button>
          <button
            type="button"
            class="px-2.5 py-1 text-left text-2xs font-medium rounded-md hover:bg-muted hover:text-foreground transition-colors cursor-pointer whitespace-nowrap"
            @click="applyPreset('last30')"
          >
            Last 30 days
          </button>
        </div>

        <!-- Range Calendar -->
        <div>
          <RangeCalendar
            :model-value="(range as any)"
            @update:model-value="handleRangeChange"
          />
          <div class="flex items-center justify-between px-3 py-2 border-t border-border bg-surface-subtle">
            <span class="text-2xs text-muted-foreground">
              {{ formattedDisplay || 'Select start & end date' }}
            </span>
            <Button
              v-if="clearable && (range.start || range.end)"
              variant="ghost"
              size="sm"
              class="h-6 text-2xs px-2 text-muted-foreground hover:text-destructive cursor-pointer"
              @click="handleClear"
            >
              Clear
            </Button>
          </div>
        </div>
      </div>
    </PopoverContent>
  </Popover>
</template>
