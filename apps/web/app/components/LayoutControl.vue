<script setup lang="ts">
import type { BoardLayout } from '@content-library/shared'
import { boardLayoutOptions } from '../utils/board-layouts'

defineProps<{
  modelValue: BoardLayout
  disabled?: boolean
  label?: string
}>()

defineEmits<{ 'update:modelValue': [layout: BoardLayout] }>()
</script>

<template>
  <div class="layout-control" role="group" :aria-label="label ?? 'Board layout'">
    <button
      v-for="option in boardLayoutOptions" :key="option.value" type="button" :disabled="disabled"
      :aria-pressed="modelValue === option.value" @click="$emit('update:modelValue', option.value)">
      {{ option.label }}
    </button>
  </div>
</template>

<style scoped>
.layout-control {
  max-width: 100%;
  display: inline-flex;
  align-items: center;
  overflow-x: auto;
  padding: 3px;
  border-radius: 999px;
  background: var(--color-surface);
}

.layout-control button {
  flex: 0 0 auto;
  min-height: 30px;
  padding: 0 10px;
  border-radius: 999px;
  color: var(--color-muted);
  background: transparent;
  font-size: 13px;
}

.layout-control button[aria-pressed='true'] {
  color: var(--color-bg);
  background: var(--color-fg);
}
</style>
