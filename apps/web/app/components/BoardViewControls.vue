<script setup lang="ts">
import type { BoardViewSettings } from '@content-library/shared'

const props = defineProps<{ modelValue: BoardViewSettings; disabled?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: BoardViewSettings] }>()

const update = <K extends keyof BoardViewSettings>(key: K, value: BoardViewSettings[K]) => {
  if (!props.disabled) emit('update:modelValue', { ...props.modelValue, [key]: value })
}

const radiusOptions: Array<{ value: BoardViewSettings['radius']; label: string }> = [
  { value: 'none', label: 'Square' }, { value: 'small', label: 'Subtle' },
  { value: 'default', label: 'Rounded' }, { value: 'large', label: 'Soft' }
]
const gapOptions: Array<{ value: BoardViewSettings['gap']; label: string }> = [
  { value: 'none', label: 'None' }, { value: 'tight', label: 'Tight' },
  { value: 'default', label: 'Default' }, { value: 'wide', label: 'Wide' }
]
const columnOptions: Array<{ value: BoardViewSettings['columns']; label: string }> = [
  { value: 'even-fewer', label: 'Even fewer' }, { value: 'fewer', label: 'Fewer' },
  { value: 'auto', label: 'Default' }, { value: 'more', label: 'More' }, { value: 'even-more', label: 'Even more' }
]
</script>

<template>
  <div class="asset-filter-controls asset-filter-controls--expanded board-view-controls">
    <button class="filter-sheet-handle" type="button" aria-label="Close view settings"><span aria-hidden="true" /></button>
    <h2 class="filter-overlay-title">Board view</h2>
    <fieldset class="filter-option-group">
      <legend>Card text</legend>
      <div class="filter-option-list">
        <button type="button" :aria-pressed="modelValue.showText" :disabled="disabled" @click="update('showText', true)">Show</button>
        <button type="button" :aria-pressed="!modelValue.showText" :disabled="disabled" @click="update('showText', false)">Hide</button>
      </div>
    </fieldset>
    <fieldset class="filter-option-group">
      <legend>Corners</legend>
      <div class="filter-option-list">
        <button v-for="option in radiusOptions" :key="option.value" type="button" :aria-pressed="modelValue.radius === option.value" :disabled="disabled" @click="update('radius', option.value)">{{ option.label }}</button>
      </div>
    </fieldset>
    <fieldset class="filter-option-group">
      <legend>Spacing</legend>
      <div class="filter-option-list">
        <button v-for="option in gapOptions" :key="option.value" type="button" :aria-pressed="modelValue.gap === option.value" :disabled="disabled" @click="update('gap', option.value)">{{ option.label }}</button>
      </div>
    </fieldset>
    <fieldset class="filter-option-group">
      <legend>Columns</legend>
      <div class="filter-option-list">
        <button v-for="option in columnOptions" :key="option.value" type="button" :aria-pressed="modelValue.columns === option.value" :disabled="disabled" @click="update('columns', option.value)">{{ option.label }}</button>
      </div>
    </fieldset>
  </div>
</template>

<style scoped>
.board-view-controls fieldset {
  min-inline-size: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

.board-view-controls legend {
  margin-block-end: var(--filter-option-gap);
  color: inherit;
  font-size: var(--filter-option-font-size);
  font-weight: 700;
}

</style>
