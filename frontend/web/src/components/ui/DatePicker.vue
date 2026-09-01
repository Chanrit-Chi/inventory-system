<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  CalendarDate,
  parseDate,
  getLocalTimeZone,
  today,
  type DateValue,
} from '@internationalized/date'
import { Calendar as CalendarIcon, X } from 'lucide-vue-next'
import { Popover, PopoverContent, PopoverTrigger } from './index'
import Calendar from './Calendar.vue'
import { Button } from './index'
import { cn } from '@/lib/utils'

interface Props {
  modelValue?: string | Date | DateValue | null
  placeholder?: string
  disabled?: boolean
  clearable?: boolean
  class?: string
  id?: string
  min?: string
  max?: string
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: undefined,
  placeholder: 'Pick a date',
  disabled: false,
  clearable: true,
  class: undefined,
  id: undefined,
  min: undefined,
  max: undefined,
})

const emits = defineEmits<{
  (e: 'update:modelValue', value: string | null): void
  (e: 'change', value: string | null): void
}>()

const isOpen = ref(false)

function toCalendarDate(val?: string | Date | DateValue | null): DateValue | undefined {
  if (!val) return undefined
  if (typeof val === 'string') {
    try {
      const match = val.match(/^(\d{4})-(\d{2})-(\d{2})/)
      if (match) {
        return parseDate(`${match[1]}-${match[2]}-${match[3]}`)
      }
      const d = new Date(val)
      if (!isNaN(d.getTime())) {
        return new CalendarDate(d.getFullYear(), d.getMonth() + 1, d.getDate())
      }
    } catch {
      return undefined
    }
  }
  if (val instanceof Date) {
    return new CalendarDate(val.getFullYear(), val.getMonth() + 1, val.getDate())
  }
  if (val && typeof val === 'object' && 'year' in val && 'month' in val && 'day' in val) {
    return val as DateValue
  }
  return undefined
}

const internalDate = ref<DateValue | undefined>(toCalendarDate(props.modelValue))

watch(
  () => props.modelValue,
  (newVal) => {
    internalDate.value = toCalendarDate(newVal)
  },
)

const minDate = computed(() => (props.min ? toCalendarDate(props.min) : undefined))
const maxDate = computed(() => (props.max ? toCalendarDate(props.max) : undefined))

function handleSelect(newVal: DateValue | undefined) {
  internalDate.value = newVal
  const strVal = newVal ? newVal.toString() : null
  emits('update:modelValue', strVal)
  emits('change', strVal)
  isOpen.value = false
}

function handleClear(e: Event) {
  e.stopPropagation()
  internalDate.value = undefined
  emits('update:modelValue', null)
  emits('change', null)
}

function setToday(e: Event) {
  e.stopPropagation()
  const todayDate = today(getLocalTimeZone())
  handleSelect(todayDate)
}

const formattedDisplay = computed(() => {
  if (!internalDate.value) return ''
  const y = internalDate.value.year
  const m = internalDate.value.month
  const d = internalDate.value.day
  const dateObj = new Date(y, m - 1, d)
  return dateObj.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
})
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
            !internalDate && 'text-muted-foreground',
            props.class,
          )
        "
      >
        <div class="flex items-center gap-2 truncate">
          <CalendarIcon class="h-3.5 w-3.5 shrink-0 opacity-60 text-foreground group-hover:opacity-100" />
          <span class="truncate font-medium">
            {{ internalDate ? formattedDisplay : placeholder }}
          </span>
        </div>

        <div class="flex items-center gap-1 ml-2">
          <button
            v-if="clearable && internalDate && !disabled"
            type="button"
            class="h-4 w-4 rounded-full inline-flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors p-0.5 cursor-pointer"
            title="Clear date"
            @click="handleClear"
          >
            <X class="h-3 w-3" />
          </button>
        </div>
      </button>
    </PopoverTrigger>

    <PopoverContent class="w-auto p-0 border border-border shadow-xl rounded-xl overflow-hidden bg-card" align="start">
      <Calendar
        :model-value="internalDate"
        :min-value="minDate"
        :max-value="maxDate"
        @update:model-value="handleSelect"
      />
      <div class="flex items-center justify-between px-3 py-2 border-t border-border bg-surface-subtle">
        <Button
          variant="ghost"
          size="sm"
          class="h-7 text-2xs px-2 text-primary hover:text-primary-hover font-semibold cursor-pointer"
          @click="setToday"
        >
          Today
        </Button>
        <Button
          v-if="clearable && internalDate"
          variant="ghost"
          size="sm"
          class="h-7 text-2xs px-2 text-muted-foreground hover:text-destructive cursor-pointer"
          @click="handleClear"
        >
          Clear
        </Button>
      </div>
    </PopoverContent>
  </Popover>
</template>
