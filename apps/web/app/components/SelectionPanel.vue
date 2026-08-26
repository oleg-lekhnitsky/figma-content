<script setup lang="ts">
import { Xmark } from 'reicon-vue'
const _props = withDefaults(defineProps<{
  visible?: boolean
  label: string
  wide?: boolean
  bare?: boolean
  raised?: boolean
  scrollHidden?: boolean
  overlay?: boolean
  closeLabel?: string
  closeDisabled?: boolean
}>(), {
  visible: true,
  wide: false,
  bare: false,
  raised: false,
  scrollHidden: false,
  overlay: false,
  closeLabel: '',
  closeDisabled: false
})

const emit = defineEmits<{ close: []; afterLeave: [] }>()
</script>

<template>
  <AppDrawer v-if="overlay" :open="visible" :label="label" :dismissible="!closeDisabled" @close="emit('close')" @after-leave="emit('afterLeave')">
    <slot />
  </AppDrawer>
  <Teleport to="body">
    <Transition name="selection-panel" @after-leave="$emit('afterLeave')">
      <div
        v-if="visible && !overlay" class="selection-panel" :class="{ 'selection-panel--wide': wide, 'selection-panel--bare': bare, 'selection-panel--raised': raised, 'selection-panel--scroll-hidden': scrollHidden }" role="region"
        :aria-label="label">
        <slot />
        <button
          v-if="closeLabel" class="selection-panel-close" type="button" :disabled="closeDisabled"
          :aria-label="closeLabel" @click="$emit('close')">
          <Xmark :size="20" :stroke-width="2" aria-hidden="true" />
        </button>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.selection-panel {
  position: fixed;
  z-index: 30;
  left: 50%;
  bottom: var(--space);
  max-width: calc(100vw - var(--space)*2);
  display: flex;
  gap: var(--filter-panel-control-gap, .375rem);
  padding: 8px;
  border-radius: 999px;
  color: var(--color-fg);
  background: var(--color-bg);
  box-shadow: 0 18px 64px rgb(0 0 0/.18);
  backdrop-filter: blur(80px) saturate(140%);
  -webkit-backdrop-filter: blur(40px) saturate(140%);
  transform: translateX(-50%);
  transition: translate .24s cubic-bezier(.2, 0, 0, 1);
}

.selection-panel:not(.selection-panel--filter-overlay) {
  align-items: center;
}

.selection-panel--wide {
  width: max-content;
  overflow-x: auto
}

.selection-panel--bare {
  padding: 0;
  background: transparent;
  box-shadow: none;
  backdrop-filter: none;
  -webkit-backdrop-filter: none
}

.selection-panel--raised {
  bottom: calc(var(--space)*2)
}

.selection-panel :slotted(strong) {
  white-space: nowrap
}

.selection-panel:not(.selection-panel--filter-overlay) :slotted(button),
.selection-panel-close {
  min-height: 36px;
  padding: 0 14px;
  color: var(--color-bg);
  background: var(--color-fg)
}

.selection-panel:not(.selection-panel--filter-overlay) :slotted(.mobile-filter-search) {
  padding-inline: 0
}

.selection-panel-close {
  width: 36px;
  padding: 0;
  display: grid;
  place-items: center
}

.selection-panel-close svg {
  width: 18px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.7
}

.selection-panel-sheet-handle { display: none }

.selection-panel-enter-active,
.selection-panel-leave-active {
  transition-property: translate;
  transition-timing-function: cubic-bezier(.2, 0, 0, 1)
}

.selection-panel-enter-active { transition-duration: 100ms; }
.selection-panel-leave-active { transition: none; }

.selection-panel-enter-from {
  translate: 0 4px
}

@media (max-width: 520px) {
  .selection-panel--wide {
    width: calc(100vw - var(--space)*2);
    box-sizing: border-box;
    overflow: hidden
  }

  .selection-panel--wide :slotted(form) {
    min-width: 0;
    flex: 1 1 auto;
    overflow-x: auto;
    overscroll-behavior-inline: contain;
    scrollbar-width: none
  }

  .selection-panel--wide :slotted(form::-webkit-scrollbar) {
    display: none
  }

  .selection-panel--wide :slotted(button) {
    flex: 0 0 auto
  }
}

</style>
