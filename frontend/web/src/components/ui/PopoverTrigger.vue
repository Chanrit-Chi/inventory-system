<script setup lang="ts">
import { PopoverTrigger, type PopoverTriggerProps, useForwardProps } from 'radix-vue'

const props = defineProps<PopoverTriggerProps>()
const forwarded = useForwardProps(props)
</script>

<template>
  <PopoverTrigger v-bind="forwarded">
    <slot />
  </PopoverTrigger>
</template>
