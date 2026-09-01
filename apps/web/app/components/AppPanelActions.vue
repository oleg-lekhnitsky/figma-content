<script setup lang="ts">
withDefaults(defineProps<{
  visible?: boolean
}>(), {
  visible: true
})
</script>

<template>
  <div class="filter-actions" :class="{ 'is-visible': visible }" :aria-hidden="!visible" :inert="!visible">
    <slot />
  </div>
</template>
