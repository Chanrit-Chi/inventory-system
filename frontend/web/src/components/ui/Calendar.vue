<script setup lang="ts">
import { computed } from 'vue'
import {
  CalendarRoot,
  type CalendarRootEmits,
  type CalendarRootProps,
  CalendarHeader,
  CalendarHeading,
  CalendarPrev,
  CalendarNext,
  CalendarGrid,
  CalendarGridHead,
  CalendarHeadCell,
  CalendarGridBody,
  CalendarGridRow,
  CalendarCell,
  CalendarCellTrigger,
  useForwardPropsEmits,
} from 'radix-vue'
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'
import { cn } from '@/lib/utils'

const props = withDefaults(
  defineProps<CalendarRootProps & { class?: string }>(),
  {
    weekdayFormat: 'short',
    fixedWeeks: true,
  },
)

const emits = defineEmits<CalendarRootEmits>()

const delegatedProps = computed(() => {
  const { class: _, ...delegated } = props
  return delegated
})

const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <CalendarRoot
    v-slot="{ grid, weekDays }"
    v-bind="forwarded"
    :class="cn('p-3 select-none bg-card text-card-foreground w-[260px]', props.class)"
  >
    <CalendarHeader class="relative flex w-full items-center justify-center pt-1 pb-2">
      <CalendarPrev
        class="absolute left-1 h-7 w-7 inline-flex items-center justify-center rounded-md border border-border bg-transparent p-0 opacity-70 hover:opacity-100 hover:bg-muted text-foreground transition-colors cursor-pointer"
      >
        <ChevronLeft class="h-4 w-4" />
      </CalendarPrev>

      <CalendarHeading class="text-sm font-semibold font-display text-foreground text-center px-8" />

      <CalendarNext
        class="absolute right-1 h-7 w-7 inline-flex items-center justify-center rounded-md border border-border bg-transparent p-0 opacity-70 hover:opacity-100 hover:bg-muted text-foreground transition-colors cursor-pointer"
      >
        <ChevronRight class="h-4 w-4" />
      </CalendarNext>
    </CalendarHeader>

    <div class="flex flex-col gap-y-4 sm:flex-row sm:gap-x-4 sm:gap-y-0 mt-1">
      <CalendarGrid v-for="month in grid" :key="month.value.toString()" class="w-full border-collapse space-y-1">
        <CalendarGridHead>
          <CalendarGridRow class="flex w-full justify-between mb-1">
            <CalendarHeadCell
              v-for="day in weekDays"
              :key="day"
              class="w-8 h-8 rounded-md flex items-center justify-center text-center text-3xs font-semibold text-muted-foreground uppercase tracking-wider"
            >
              {{ day }}
            </CalendarHeadCell>
          </CalendarGridRow>
        </CalendarGridHead>
        <CalendarGridBody class="grid gap-y-1">
          <CalendarGridRow v-for="(weekDates, index) in month.rows" :key="`weekDate-${index}`" class="flex w-full justify-between">
            <CalendarCell
              v-for="weekDate in weekDates"
              :key="weekDate.toString()"
              :date="weekDate"
              class="relative p-0 text-center text-sm focus-within:relative focus-within:z-20"
            >
              <CalendarCellTrigger
                :day="weekDate"
                :month="month.value"
                class="inline-flex h-8 w-8 items-center justify-center rounded-md text-xs font-medium transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer aria-selected:opacity-100 data-[selected]:bg-primary data-[selected]:text-primary-foreground data-[selected]:font-bold data-[today]:bg-accent/40 data-[today]:text-accent-foreground data-[outside-view]:text-muted-foreground/30 data-[outside-view]:pointer-events-none data-[disabled]:text-muted-foreground/20 data-[disabled]:cursor-not-allowed"
              />
            </CalendarCell>
          </CalendarGridRow>
        </CalendarGridBody>
      </CalendarGrid>
    </div>
  </CalendarRoot>
</template>
