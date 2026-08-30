<script setup lang="ts">
import { computed } from 'vue'
import { DialogTitle, type DialogTitleProps } from 'radix-vue'
import { cn } from '@/lib/utils'

const props = defineProps<DialogTitleProps & { class?: string }>()

const delegatedProps = computed(() => {
  const { class: _, ...delegated } = props
  return delegated
})
</script>

<template>
  <DialogTitle
    v-bind="delegatedProps"
    :class="
      cn(
        'text-lg font-bold leading-none tracking-tight text-foreground font-sans',
        props.class,
      )
    "
  >
    <slot />
  </DialogTitle>
</template>
