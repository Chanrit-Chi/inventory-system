<script setup lang="ts">
import { computed } from 'vue'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './index'

export interface SelectOption {
  label: string
  value: string | number
  disabled?: boolean
}

interface Props {
  modelValue?: string | number | null
  options?: Array<SelectOption | string | number>
  placeholder?: string
  disabled?: boolean
  class?: string
  id?: string
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  options: () => [],
  placeholder: 'Select an option',
  disabled: false,
  class: undefined,
  id: undefined,
})

const emits = defineEmits<{
  (e: 'update:modelValue', val: string | number): void
  (e: 'change', val: string | number): void
}>()

const EMPTY_SENTINEL = '__RADIX_EMPTY__'

const normalizedOptions = computed<SelectOption[]>(() => {
  return (props.options || []).map((opt) => {
    if (typeof opt === 'object' && opt !== null && 'value' in opt) {
      return opt as SelectOption
    }
    return {
      label: String(opt),
      value: opt as string | number,
    }
  })
})

function encodeValue(val: string | number | null | undefined): string {
  if (val === '' || val === null || val === undefined) {
    return EMPTY_SENTINEL
  }
  return String(val)
}

function decodeValue(val: string): string | number {
  if (val === EMPTY_SENTINEL) {
    const emptyOpt = normalizedOptions.value.find(
      (opt) => opt.value === '' || opt.value === null || opt.value === undefined
    )
    if (emptyOpt !== undefined) return emptyOpt.value
    return ''
  }
  const matched = normalizedOptions.value.find((opt) => String(opt.value) === val)
  return matched !== undefined ? matched.value : val
}

const internalModelValue = computed(() => {
  if (props.modelValue === '' || props.modelValue === null || props.modelValue === undefined) {
    const hasEmptyOption = normalizedOptions.value.some(
      (opt) => opt.value === '' || opt.value === null || opt.value === undefined
    )
    return hasEmptyOption ? EMPTY_SENTINEL : ''
  }
  return String(props.modelValue)
})

function handleValueChange(val: string) {
  const finalVal = decodeValue(val)
  emits('update:modelValue', finalVal)
  emits('change', finalVal)
}
</script>

<template>
  <Select
    :model-value="internalModelValue"
    :disabled="disabled"
    @update:model-value="handleValueChange"
  >
    <SelectTrigger :id="id" :class="props.class">
      <SelectValue :placeholder="placeholder" />
    </SelectTrigger>
    <SelectContent>
      <slot>
        <SelectItem
          v-for="opt in normalizedOptions"
          :key="encodeValue(opt.value)"
          :value="encodeValue(opt.value)"
          :disabled="opt.disabled"
        >
          {{ opt.label }}
        </SelectItem>
      </slot>
    </SelectContent>
  </Select>
</template>
