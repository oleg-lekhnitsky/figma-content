<script setup lang="ts">
import { navigateTo } from '#imports'

const props = withDefaults(defineProps<{
  active: 'projects' | 'audit-log'
  showAuditLog?: boolean
}>(), {
  showAuditLog: false
})

const open = (destination: 'projects' | 'audit-log') => {
  if (destination === props.active) return
  return navigateTo(`/admin/${destination}`)
}
</script>

<template>
  <div class="filter-sheet-content">
    <section class="filter-option-group app-admin-navigation">
      <nav class="filter-option-list filter-option-list--segmented" aria-label="Administration">
        <button type="button" :aria-pressed="active === 'projects'" @click="open('projects')">Projects</button>
        <button v-if="showAuditLog" type="button" :aria-pressed="active === 'audit-log'" @click="open('audit-log')">Audit log</button>
      </nav>
    </section>
    <slot />
  </div>
</template>

<style scoped>
:global(.app-admin-panel) { min-width: min(30rem, calc(100vw - var(--space) * 2)); }

@media (max-width: 520px) {
  :global(.app-admin-panel) { min-width: 0; }
}
</style>
