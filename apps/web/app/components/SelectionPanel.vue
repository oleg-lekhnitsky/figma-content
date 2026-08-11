<script setup lang="ts">
withDefaults(defineProps<{
  visible?: boolean
  label: string
  wide?: boolean
  bare?: boolean
  raised?: boolean
  closeLabel?: string
  closeDisabled?: boolean
}>(), {
  visible: true,
  wide: false,
  bare: false,
  raised: false,
  closeLabel: '',
  closeDisabled: false
})

defineEmits<{ close: [] }>()
</script>

<template>
  <Teleport to="body">
    <Transition name="selection-panel">
      <div
        v-if="visible" class="selection-panel" :class="{ 'selection-panel--wide': wide, 'selection-panel--bare': bare, 'selection-panel--raised': raised }" role="region"
        :aria-label="label">
        <slot />
        <button
          v-if="closeLabel" class="selection-panel-close" type="button" :disabled="closeDisabled"
          :aria-label="closeLabel" @click="$emit('close')">
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="m6 6 12 12M18 6 6 18" />
          </svg>
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
  align-items: center;
  gap: 6px;
  padding: 8px;
  border-radius: 999px;
  color: var(--color-fg);
  background: var(--color-bg);
  box-shadow: 0 18px 64px rgb(0 0 0/.18);
  backdrop-filter: blur(80px) saturate(140%);
  -webkit-backdrop-filter: blur(40px) saturate(140%);
  transform: translateX(-50%);
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
  padding: 0 10px;
  white-space: nowrap
}

.selection-panel :slotted(button),
.selection-panel-close {
  min-height: 36px;
  padding: 0 14px;
  color: var(--color-bg);
  background: var(--color-fg)
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

.selection-panel-enter-active,
.selection-panel-leave-active {
  transition: opacity 150ms ease
}

.selection-panel-enter-from,
.selection-panel-leave-to {
  opacity: 0
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
