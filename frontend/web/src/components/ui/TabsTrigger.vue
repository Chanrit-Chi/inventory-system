<script setup lang="ts">
import { computed } from 'vue'
import { TabsTrigger, type TabsTriggerProps } from 'radix-vue'
import { cn } from '@/lib/utils'

const props = defineProps<TabsTriggerProps & { class?: string }>()

const delegatedProps = computed(() => {
  const { class: _, ...delegated } = props
  return delegated
})
</script>

<template>
  <TabsTrigger
    v-bind="delegatedProps"
    :class="
      cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-lg px-3.5 py-1.5 text-xs font-semibold ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-xs cursor-pointer',
        props.class,
      )
    "
  >
    <slot />
  </TabsTrigger>
</template>
