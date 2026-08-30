<script setup lang="ts">
import { computed } from 'vue'
import { TabsList, type TabsListProps } from 'radix-vue'
import { cn } from '@/lib/utils'

const props = defineProps<TabsListProps & { class?: string }>()

const delegatedProps = computed(() => {
  const { class: _, ...delegated } = props
  return delegated
})
</script>

<template>
  <TabsList
    v-bind="delegatedProps"
    :class="
      cn(
        'inline-flex h-10 items-center justify-center rounded-xl bg-surface-subtle p-1 text-muted-foreground border border-border',
        props.class,
      )
    "
  >
    <slot />
  </TabsList>
</template>
