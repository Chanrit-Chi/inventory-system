<script setup lang="ts">
import { computed } from 'vue'
import { DialogDescription, type DialogDescriptionProps } from 'radix-vue'
import { cn } from '@/lib/utils'

const props = defineProps<DialogDescriptionProps & { class?: string }>()

const delegatedProps = computed(() => {
  const { class: _, ...delegated } = props
  return delegated
})
</script>

<template>
  <DialogDescription
    v-bind="delegatedProps"
    :class="cn('text-sm text-muted-foreground', props.class)"
  >
    <slot />
  </DialogDescription>
</template>
