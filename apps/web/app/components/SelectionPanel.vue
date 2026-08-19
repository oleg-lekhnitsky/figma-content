<script setup lang="ts">
import { Xmark } from 'reicon-vue'
const props = withDefaults(defineProps<{
  visible?: boolean
  label: string
  wide?: boolean
  bare?: boolean
  raised?: boolean
  overlay?: boolean
  instant?: boolean
  closeLabel?: string
  closeDisabled?: boolean
}>(), {
  visible: true,
  wide: false,
  bare: false,
  raised: false,
  overlay: false,
  instant: false,
  closeLabel: '',
  closeDisabled: false
})

const emit = defineEmits<{ close: []; afterLeave: [] }>()
const panelRoot = ref<HTMLElement | null>(null)
const renderedOverlay = ref(props.overlay)
const overlayClosing = ref(false)
const sheetDragY = ref(0)
const sheetDragging = ref(false)
let sheetPointerId: number | undefined
let sheetStartY = 0
let sheetStartTime = 0
let previousBodyOverflow = ''
let previousRootOverflow = ''
let pageScrollLocked = false

const resetOverlayScroll = async () => {
  await nextTick()
  const reset = () => {
    if (!panelRoot.value) return
    panelRoot.value.scrollTop = 0
    const sheet = panelRoot.value.querySelector<HTMLElement>('.asset-filter-controls')
    if (sheet) sheet.scrollTop = 0
  }
  reset()
  requestAnimationFrame(reset)
}

const lockPageScroll = () => {
  if (!window.matchMedia('(max-width: 520px)').matches || pageScrollLocked) return
  previousBodyOverflow = document.body.style.overflow
  previousRootOverflow = document.documentElement.style.overflow
  document.body.style.overflow = 'hidden'
  document.documentElement.style.overflow = 'hidden'
  pageScrollLocked = true
}

const unlockPageScroll = () => {
  if (!pageScrollLocked) return
  document.body.style.overflow = previousBodyOverflow
  document.documentElement.style.overflow = previousRootOverflow
  pageScrollLocked = false
}

const finishOverlayClose = () => {
  if (!overlayClosing.value) return
  renderedOverlay.value = false
  overlayClosing.value = false
}

const handleOverlayAnimationEnd = (event: AnimationEvent) => {
  if (event.animationName === 'filter-overlay-fade-out') finishOverlayClose()
}

watch(() => [props.visible, props.overlay] as const, async ([visible, overlay]) => {
  if (visible && overlay) {
    lockPageScroll()
    renderedOverlay.value = true
    overlayClosing.value = false
    void resetOverlayScroll()
    return
  }
  if (!renderedOverlay.value) return
  unlockPageScroll()
  if (document.documentElement.dataset.filterTransition === 'closing') {
    renderedOverlay.value = false
    overlayClosing.value = false
    return
  }
  overlayClosing.value = true
  await nextTick()
  if (panelRoot.value && getComputedStyle(panelRoot.value).animationName === 'none') finishOverlayClose()
})

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key !== 'Escape' || !props.visible || !props.overlay || props.closeDisabled) return
  event.preventDefault()
  emit('close')
}

const handleBackdropClick = () => {
  if (props.overlay && !props.closeDisabled) emit('close')
}

const handlePanelClick = (event: MouseEvent) => {
  if (!props.overlay || props.closeDisabled) return
  if ((event.target as HTMLElement).closest('.filter-sheet-handle')) emit('close')
}

const startSheetDrag = (event: PointerEvent) => {
  if (event.pointerType !== 'touch' || !props.overlay || props.closeDisabled) return
  const handle = (event.target as HTMLElement).closest<HTMLElement>('.filter-sheet-handle')
  if (!handle) return
  sheetPointerId = event.pointerId
  sheetStartY = event.clientY
  sheetStartTime = performance.now()
  sheetDragging.value = true
  panelRoot.value?.setPointerCapture(event.pointerId)
}

const moveSheetDrag = (event: PointerEvent) => {
  if (!sheetDragging.value || event.pointerId !== sheetPointerId) return
  sheetDragY.value = Math.max(0, event.clientY - sheetStartY)
}

const finishSheetDrag = (event: PointerEvent) => {
  if (!sheetDragging.value || event.pointerId !== sheetPointerId) return
  const elapsed = Math.max(performance.now() - sheetStartTime, 1)
  const velocity = sheetDragY.value / elapsed
  sheetDragging.value = false
  sheetPointerId = undefined
  if (sheetDragY.value > 56 || velocity > .45) {
    emit('close')
    return
  }
  sheetDragY.value = 0
}

watch(() => props.visible, visible => {
  if (!visible) {
    sheetDragY.value = 0
    sheetDragging.value = false
    sheetPointerId = undefined
  }
})

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
  if (props.visible && props.overlay) {
    lockPageScroll()
    void resetOverlayScroll()
  }
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
  unlockPageScroll()
})
</script>

<template>
  <Teleport to="body">
    <Transition name="selection-panel" :css="!instant" @after-leave="$emit('afterLeave')">
      <div
        v-if="visible" ref="panelRoot" class="selection-panel" :class="{ 'selection-panel--wide': wide, 'selection-panel--bare': bare, 'selection-panel--raised': raised, 'selection-panel--filter-overlay': renderedOverlay, 'selection-panel--filter-closing': overlayClosing, 'selection-panel--instant': instant, 'selection-panel--sheet-dragging': sheetDragging }" role="region"
        :style="renderedOverlay ? { '--sheet-drag-y': `${sheetDragY}px` } : undefined"
        :aria-label="label" @click="handlePanelClick" @click.self="handleBackdropClick" @animationend.self="handleOverlayAnimationEnd"
        @pointerdown="startSheetDrag" @pointermove="moveSheetDrag" @pointerup="finishSheetDrag"
        @pointercancel="finishSheetDrag">
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

.selection-panel-sheet-handle { display: none }

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
