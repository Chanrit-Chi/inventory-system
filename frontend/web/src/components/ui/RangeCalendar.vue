<script setup lang="ts">
import { computed } from 'vue'
import {
  RangeCalendarRoot,
  type RangeCalendarRootEmits,
  type RangeCalendarRootProps,
  RangeCalendarHeader,
  RangeCalendarHeading,
  RangeCalendarPrev,
  RangeCalendarNext,
  RangeCalendarGrid,
  RangeCalendarGridHead,
  RangeCalendarHeadCell,
  RangeCalendarGridBody,
  RangeCalendarGridRow,
  RangeCalendarCell,
  RangeCalendarCellTrigger,
  useForwardPropsEmits,
} from 'radix-vue'
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'
import { cn } from '@/lib/utils'

const props = withDefaults(
  defineProps<RangeCalendarRootProps & { class?: string }>(),
  {
    weekdayFormat: 'short',
    fixedWeeks: true,
  },
)

const emits = defineEmits<RangeCalendarRootEmits>()

const delegatedProps = computed(() => {
  const { class: _, ...delegated } = props
  return delegated
})

const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <RangeCalendarRoot
    v-slot="{ grid, weekDays }"
    v-bind="forwarded"
    :class="cn('p-3 select-none bg-card text-card-foreground w-[260px]', props.class)"
  >
    <RangeCalendarHeader class="relative flex w-full items-center justify-center pt-1 pb-2">
      <RangeCalendarPrev
        class="absolute left-1 h-7 w-7 inline-flex items-center justify-center rounded-md border border-border bg-transparent p-0 opacity-70 hover:opacity-100 hover:bg-muted text-foreground transition-colors cursor-pointer"
      >
        <ChevronLeft class="h-4 w-4" />
      </RangeCalendarPrev>

      <RangeCalendarHeading class="text-sm font-semibold font-display text-foreground text-center px-8" />

      <RangeCalendarNext
        class="absolute right-1 h-7 w-7 inline-flex items-center justify-center rounded-md border border-border bg-transparent p-0 opacity-70 hover:opacity-100 hover:bg-muted text-foreground transition-colors cursor-pointer"
      >
        <ChevronRight class="h-4 w-4" />
      </RangeCalendarNext>
    </RangeCalendarHeader>

    <div class="flex flex-col gap-y-4 sm:flex-row sm:gap-x-4 sm:gap-y-0 mt-1">
      <RangeCalendarGrid v-for="month in grid" :key="month.value.toString()" class="w-full border-collapse space-y-1">
        <RangeCalendarGridHead>
          <RangeCalendarGridRow class="flex w-full justify-between mb-1">
            <RangeCalendarHeadCell
              v-for="day in weekDays"
              :key="day"
              class="w-8 h-8 rounded-md flex items-center justify-center text-center text-3xs font-semibold text-muted-foreground uppercase tracking-wider"
            >
              {{ day }}
            </RangeCalendarHeadCell>
          </RangeCalendarGridRow>
        </RangeCalendarGridHead>
        <RangeCalendarGridBody class="grid gap-y-1">
          <RangeCalendarGridRow v-for="(weekDates, index) in month.rows" :key="`weekDate-${index}`" class="flex w-full justify-between">
            <RangeCalendarCell
              v-for="weekDate in weekDates"
              :key="weekDate.toString()"
              :date="weekDate"
              class="relative p-0 text-center text-sm focus-within:relative focus-within:z-20 first:[&:has([data-selected])]:rounded-l-md last:[&:has([data-selected])]:rounded-r-md"
            >
              <RangeCalendarCellTrigger
                :day="weekDate"
                :month="month.value"
                class="inline-flex h-8 w-8 items-center justify-center rounded-md text-xs font-medium transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer aria-selected:opacity-100 data-[selection-start]:bg-primary data-[selection-start]:text-primary-foreground data-[selection-start]:rounded-l-md data-[selection-end]:bg-primary data-[selection-end]:text-primary-foreground data-[selection-end]:rounded-r-md data-[highlighted]:bg-accent/40 data-[today]:font-bold data-[outside-view]:text-muted-foreground/30 data-[outside-view]:pointer-events-none data-[disabled]:text-muted-foreground/20 data-[disabled]:cursor-not-allowed"
              />
            </RangeCalendarCell>
          </RangeCalendarGridRow>
        </RangeCalendarGridBody>
      </RangeCalendarGrid>
    </div>
  </RangeCalendarRoot>
</template>
