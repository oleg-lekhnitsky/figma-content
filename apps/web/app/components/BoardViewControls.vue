<script setup lang="ts">
import type { BoardViewSettings } from '@content-library/shared'

const props = defineProps<{ modelValue: BoardViewSettings; disabled?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: BoardViewSettings] }>()

const update = <K extends keyof BoardViewSettings>(key: K, value: BoardViewSettings[K]) => {
  if (!props.disabled) emit('update:modelValue', { ...props.modelValue, [key]: value })
}

const radiusOptions: Array<{ value: BoardViewSettings['radius']; label: string }> = [
  { value: 'none', label: 'Square' }, { value: 'small', label: 'Subtle' },
  { value: 'large', label: 'Soft' }
]
const gapOptions: Array<{ value: BoardViewSettings['gap']; label: string }> = [
  { value: 'none', label: 'None' }, { value: 'default', label: 'Default' },
  { value: 'wide', label: 'Wide' }
]
const columnOptions: Array<{ value: BoardViewSettings['columns']; label: string }> = [
  { value: 'even-fewer', label: 'Even fewer' }, { value: 'fewer', label: 'Fewer' },
  { value: 'auto', label: 'Default' }, { value: 'more', label: 'More' }, { value: 'even-more', label: 'Even more' }
]
const isCompact = ref(false)
let compactQuery: MediaQueryList | undefined
const updateCompact = () => { isCompact.value = compactQuery?.matches ?? false }
const visibleColumnOptions = computed(() => isCompact.value ? columnOptions.filter(option => option.value !== 'even-fewer') : columnOptions)
const columnPressed = (value: BoardViewSettings['columns']) => props.modelValue.columns === value
  || (isCompact.value && value === 'fewer' && props.modelValue.columns === 'even-fewer')
onMounted(() => {
  compactQuery = window.matchMedia('(max-width: 520px)')
  updateCompact()
  compactQuery.addEventListener('change', updateCompact)
})
onBeforeUnmount(() => compactQuery?.removeEventListener('change', updateCompact))
</script>

<template>
  <div class="asset-filter-controls asset-filter-controls--expanded board-view-controls">
    <button class="filter-sheet-handle" type="button" aria-label="Close view settings"><span aria-hidden="true" /></button>
    <div class="filter-sheet-content">
      <!-- <h2 class="filter-overlay-title">Board view</h2> -->
    <section class="filter-option-group" role="group" aria-labelledby="board-view-card-text">
      <h2 class="filter-overlay-title" id="board-view-card-text">Card text</h2>
      <div class="filter-option-list filter-option-list--segmented">
        <button type="button" :aria-pressed="modelValue.showText" :disabled="disabled" @click="update('showText', true)">Show</button>
        <button type="button" :aria-pressed="!modelValue.showText" :disabled="disabled" @click="update('showText', false)">Hide</button>
      </div>
    </section>
    <section class="filter-option-group" role="group" aria-labelledby="board-view-corners">
      <h2 class="filter-overlay-title" id="board-view-corners">Corners</h2>
      <div class="filter-option-list filter-option-list--segmented">
        <button v-for="option in radiusOptions" :key="option.value" type="button" :aria-pressed="modelValue.radius === option.value" :disabled="disabled" @click="update('radius', option.value)">{{ option.label }}</button>
      </div>
    </section>
    <section class="filter-option-group" role="group" aria-labelledby="board-view-spacing">
      <h2 class="filter-overlay-title" id="board-view-spacing">Spacing</h2>
      <div class="filter-option-list filter-option-list--segmented">
        <button v-for="option in gapOptions" :key="option.value" type="button" :aria-pressed="modelValue.gap === option.value" :disabled="disabled" @click="update('gap', option.value)">{{ option.label }}</button>
      </div>
    </section>
    <section class="filter-option-group" role="group" aria-labelledby="board-view-columns">
      <h2 class="filter-overlay-title" id="board-view-columns">Columns</h2>
      <div class="filter-option-list filter-option-list--segmented">
        <button
          v-for="(option, index) in visibleColumnOptions"
          :key="option.value"
          type="button"
          :aria-label="isCompact ? `${index + 1}: ${option.label}` : undefined"
          :aria-pressed="columnPressed(option.value)"
          :disabled="disabled"
          @click="update('columns', option.value)"
        >{{ isCompact ? index + 1 : option.label }}</button>
      </div>
      </section>
    </div>
  </div>
</template>
