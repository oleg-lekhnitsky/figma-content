<script setup lang="ts">
defineProps<{ title?: string }>()
const headingId = useId()
</script>

<template>
  <section class="app-settings-section" :aria-labelledby="title ? headingId : undefined">
    <h2 v-if="title" :id="headingId">{{ title }}</h2>
    <slot />
  </section>
</template>

<style scoped>
.app-settings-section {
  --filter-overlay-panel-color: var(--material-tinted-fg);
  --filter-overlay-muted-color: rgb(255 255 255 / .58);
  --filter-overlay-primary-background: rgb(255 255 255 / .9);
  --filter-overlay-primary-color: #595959;
  box-sizing: border-box;
  min-width: 0;
  display: grid;
  gap: calc(var(--space) * .75);
  padding: var(--filter-overlay-padding);
  border-radius: var(--filter-overlay-radius);
  background: var(--filter-overlay-panel-background);
  color: var(--filter-overlay-panel-color);
}

h2 {
  margin: 0;
  padding-inline: calc(var(--filter-option-padding) / 2);
  font-size: var(--filter-title-size);
  font-weight: 700;
  letter-spacing: var(--letter-spacing-heading);
  line-height: 1.15;
}
</style>
