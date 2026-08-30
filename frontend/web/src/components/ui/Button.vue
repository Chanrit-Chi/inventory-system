<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@/lib/utils'
import { type ButtonVariants, buttonVariants } from './button-variants'

interface Props {
  variant?: ButtonVariants['variant']
  size?: ButtonVariants['size']
  type?: 'button' | 'submit' | 'reset'
  disabled?: boolean
  loading?: boolean
  as?: string
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
  type: 'button',
  disabled: false,
  loading: false,
  as: 'button',
})

defineEmits<{ (e: 'click', ev: MouseEvent): void }>()

const classes = computed(() =>
  cn(buttonVariants({ variant: props.variant, size: props.size }), props.class),
)
</script>

<template>
  <component
    :is="as"
    :type="as === 'button' ? type : undefined"
    :disabled="disabled || loading"
    :class="classes"
    @click="$emit('click', $event)"
  >
    <span
      v-if="loading"
      class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent flex-shrink-0"
    />
    <slot />
  </component>
</template>
