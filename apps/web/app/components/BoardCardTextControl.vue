<script setup lang="ts">
defineProps<{
  showText: boolean
  disabled?: boolean
  titleId?: string
}>()

defineEmits<{ change: [showText: boolean] }>()
</script>

<template>
  <section class="filter-option-group" role="group" :aria-labelledby="titleId ?? 'board-card-text-title'">
    <h2 :id="titleId ?? 'board-card-text-title'" class="filter-overlay-title">Card text</h2>
    <div class="filter-option-list filter-option-list--segmented">
      <button type="button" :aria-pressed="showText" :disabled="disabled" @click="$emit('change', true)">Show</button>
      <button type="button" :aria-pressed="!showText" :disabled="disabled" @click="$emit('change', false)">Hide</button>
    </div>
  </section>
</template>
