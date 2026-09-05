<script setup lang="ts">
withDefaults(defineProps<{
  visible?: boolean
  standalone?: boolean
}>(), {
  visible: true,
  standalone: false
})
</script>

<template>
  <div class="filter-actions" :class="{ 'is-visible': visible, 'filter-actions--standalone': standalone }" :aria-hidden="!visible" :inert="!visible">
    <slot />
  </div>
</template>
