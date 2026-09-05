<script setup lang="ts">
import type { BoardAssetScope } from '@content-library/shared'

withDefaults(defineProps<{
  modelValue: BoardAssetScope
  disabled?: boolean
  description?: string
}>(), {
  disabled: false,
  description: ''
})

defineEmits<{ 'update:modelValue': [value: BoardAssetScope] }>()
</script>

<template>
  <section class="filter-option-group" role="group" aria-label="Assets shown">
    <div class="filter-option-list filter-option-list--segmented">
      <button type="button" :aria-pressed="modelValue === 'approved'" :disabled="disabled" @click="$emit('update:modelValue', 'approved')">Liked only</button>
      <button type="button" :aria-pressed="modelValue === 'all'" :disabled="disabled" @click="$emit('update:modelValue', 'all')">All assets</button>
    </div>
    <p v-if="description" class="board-type-summary">{{ description }}</p>
  </section>
</template>
