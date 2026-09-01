<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'

withDefaults(defineProps<{
  title: string
  meta?: string
  to?: RouteLocationRaw | null
  as?: 'article' | 'li'
}>(), {
  meta: '',
  to: null,
  as: 'article'
})
</script>

<template>
  <component :is="as" class="app-panel-row">
    <div v-if="$slots.default" class="app-panel-row-content">
      <slot />
    </div>
    <NuxtLink v-else-if="to" class="app-panel-row-copy" :to="to">
      <strong>{{ title }}</strong>
      <span v-if="meta">{{ meta }}</span>
    </NuxtLink>
    <div v-else class="app-panel-row-copy">
      <strong>{{ title }}</strong>
      <span v-if="meta">{{ meta }}</span>
    </div>
    <div v-if="$slots.actions" class="app-panel-row-actions">
      <slot name="actions" />
    </div>
  </component>
</template>

<style scoped>
.app-panel-row {
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--filter-action-gap);
  padding: var(--filter-action-gap);
  border-radius: calc(var(--radius) * 1.5);
  background: color-mix(in srgb, var(--filter-overlay-panel-color) 7%, transparent);
}

.app-panel-row-copy {
  min-width: 0;
  display: grid;
  gap: calc(var(--filter-option-gap) / 2);
  padding: calc(var(--filter-option-padding) / 2);
  color: inherit;
  text-decoration: none;
}

.app-panel-row-content {
  min-width: 0;
  display: grid;
  gap: var(--filter-option-gap);
  padding: calc(var(--filter-option-padding) / 2);
}

.app-panel-row-content :deep(label) { display: grid; gap: calc(var(--filter-option-gap) / 2); }

.app-panel-row-copy strong {
  min-width: 0;
  overflow: hidden;
  font-size: var(--filter-action-font-size);
  font-weight: 500;
  line-height: 1.1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-panel-row-copy span {
  color: var(--filter-overlay-muted-color);
  font-size: var(--font-size-caption);
  letter-spacing: var(--letter-spacing-caption);
  line-height: 1.2;
}

.app-panel-row-actions {
  display: flex;
  align-items: center;
  gap: var(--filter-action-gap);
}

.app-panel-row-actions :deep(.panel-secondary-action) {
  width: auto;
  min-height: calc(var(--filter-action-height) - .5rem);
  padding-inline: var(--filter-option-padding);
}

.app-panel-row-actions :deep(.panel-icon-action) { padding: 0; }

@media (max-width: 520px) {
  .app-panel-row { grid-template-columns: minmax(0, 1fr); }
  .app-panel-row-actions { width: 100%; }
  .app-panel-row-actions :deep(.panel-secondary-action:not(.panel-icon-action)) { flex: 1 1 auto; }
}
</style>
