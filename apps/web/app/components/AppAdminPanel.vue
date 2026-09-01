<script setup lang="ts">
import { navigateTo } from '#imports'
import { Xmark } from 'reicon-vue'

const props = withDefaults(defineProps<{
  active: 'projects' | 'audit-log'
  visible?: boolean
  showAuditLog?: boolean
  label?: string
}>(), {
  visible: true,
  showAuditLog: false,
  label: 'Administration'
})

const emit = defineEmits<{ close: []; afterLeave: [] }>()
const open = (destination: 'projects' | 'audit-log') => {
  if (destination === props.active) return
  return navigateTo(`/admin/${destination}`)
}
</script>

<template>
  <SelectionPanel :visible="visible" :label="label" wide overlay @close="emit('close')" @after-leave="emit('afterLeave')">
    <div class="asset-filter-controls asset-filter-controls--filters asset-filter-controls--expanded app-admin-panel">
      <button class="filter-sheet-handle" type="button" aria-label="Close administration" @click="emit('close')"><span aria-hidden="true" /></button>
      <div class="filter-sheet-content">
        <section class="filter-option-group app-admin-navigation">
          <nav class="filter-option-list filter-option-list--segmented" aria-label="Administration">
            <button type="button" :aria-pressed="active === 'projects'" @click="open('projects')">Projects</button>
            <button v-if="showAuditLog" type="button" :aria-pressed="active === 'audit-log'" @click="open('audit-log')">Audit log</button>
          </nav>
        </section>
        <slot />
      </div>
    </div>
    <button class="filter-panel-toggle is-expanded" type="button" aria-label="Close administration" aria-expanded="true" @click="emit('close')">
      <Xmark :size="20" :stroke-width="2" aria-hidden="true" />
    </button>
  </SelectionPanel>
</template>

<style scoped>
.app-admin-panel { min-width: min(30rem, calc(100vw - var(--space) * 2)); }

@media (max-width: 520px) {
  .app-admin-panel { min-width: 0; }
}
</style>
