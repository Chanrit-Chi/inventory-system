<script lang="ts">
export default {
  inheritAttrs: false,
}
</script>

<script setup lang="ts">
import { computed, useAttrs, ref } from 'vue'
import { cn } from '@/lib/utils'

interface Props {
  modelValue?: string | number
  type?: string
  placeholder?: string
  disabled?: boolean
  readonly?: boolean
  error?: boolean | string
  id?: string
  name?: string
  required?: boolean
  min?: number | string
  max?: number | string
  step?: number | string
  class?: string
  wrapperClass?: string
}

const props = withDefaults(defineProps<Props>(), {
  type: 'text',
  disabled: false,
  readonly: false,
  error: false,
  required: false,
})

const attrs = useAttrs()
const emit = defineEmits<{ (e: 'update:modelValue', value: string | number): void }>()

const inputRef = ref<HTMLInputElement | null>(null)

defineExpose({
  inputRef,
  focus: (options?: FocusOptions) => inputRef.value?.focus(options),
  blur: () => inputRef.value?.blur(),
  select: () => inputRef.value?.select(),
})

const inputClasses = computed(() =>
  cn(
    'flex h-9 w-full rounded-lg border border-input bg-card px-3 py-1.5 text-sm text-foreground shadow-xs',
    'transition-all duration-150',
    'placeholder:text-muted-foreground',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25 focus-visible:border-ring',
    'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted',
    props.error && 'border-destructive bg-destructive/5 focus-visible:ring-destructive/25 focus-visible:border-destructive',
    props.class,
  ),
)

const onInput = (e: Event) => {
  const target = e.target as HTMLInputElement
  emit('update:modelValue', props.type === 'number' ? (target.value === '' ? '' : Number(target.value)) : target.value)
}
</script>

<template>
  <div :class="cn('relative flex items-center w-full', wrapperClass)">
    <div v-if="$slots.prefix" class="absolute left-3 flex items-center pointer-events-none text-muted-foreground z-10">
      <slot name="prefix" />
    </div>
    <input
      ref="inputRef"
      :id="id"
      :name="name"
      :type="type"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :readonly="readonly"
      :required="required"
      :min="min"
      :max="max"
      :step="step"
      v-bind="attrs"
      :class="cn(inputClasses, $slots.prefix && 'pl-9', $slots.suffix && 'pr-9')"
      @input="onInput"
    />
    <div v-if="$slots.suffix" class="absolute right-3 flex items-center pointer-events-none text-muted-foreground z-10">
      <slot name="suffix" />
    </div>
  </div>
</template>
