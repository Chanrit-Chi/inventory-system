<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@/lib/utils'

interface Props {
  modelValue?: string | number | boolean
  value: string | number | boolean
  name?: string
  disabled?: boolean
  label?: string
  description?: string
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | number | boolean): void
  (e: 'change', value: string | number | boolean): void
}>()

const isChecked = computed(() => props.modelValue === props.value)

function handleChange() {
  if (!props.disabled) {
    emit('update:modelValue', props.value)
    emit('change', props.value)
  }
}
</script>

<template>
  <label
    :class="
      cn(
        'inline-flex items-start gap-2.5 cursor-pointer select-none transition-all',
        disabled && 'opacity-50 cursor-not-allowed pointer-events-none',
        props.class,
      )
    "
  >
    <div class="relative flex items-center justify-center mt-0.5">
      <input
        type="radio"
        :name="name"
        :value="value"
        :checked="isChecked"
        :disabled="disabled"
        class="sr-only"
        @change="handleChange"
      />
      <div
        :class="
          cn(
            'w-4 h-4 rounded-full border flex items-center justify-center transition-all duration-150',
            isChecked
              ? 'border-cta bg-cta shadow-sm shadow-cta/25 ring-2 ring-cta/20'
              : 'border-border-strong bg-surface hover:border-cta/60',
            disabled && 'border-border bg-muted shadow-none ring-0',
          )
        "
      >
        <span
          :class="
            cn(
              'w-1.5 h-1.5 rounded-full bg-white transition-transform duration-150',
              isChecked ? 'scale-100' : 'scale-0',
            )
          "
        />
      </div>
    </div>
    <div v-if="label || description || $slots.default" class="flex flex-col text-left">
      <span v-if="label || $slots.default" class="text-xs font-semibold text-foreground">
        <slot>{{ label }}</slot>
      </span>
      <span v-if="description" class="text-[11px] text-muted-foreground mt-0.5">
        {{ description }}
      </span>
    </div>
  </label>
</template>
