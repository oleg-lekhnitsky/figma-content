<script setup lang="ts">
const props = withDefaults(defineProps<{
  open: boolean
  label: string
  dismissible?: boolean
}>(), {
  dismissible: true
})

const emit = defineEmits<{ close: []; afterLeave: [] }>()
const drawerRoot = ref<HTMLElement | null>(null)
const closing = ref(false)
const dragY = ref(0)
const dragging = ref(false)
const dismissing = ref(false)
let pointerId: number | undefined
let startY = 0
let lastY = 0
let lastTime = 0
let releaseVelocity = 0
let previousBodyOverflow = ''
let previousRootOverflow = ''
let previousBodyPosition = ''
let previousBodyTop = ''
let previousBodyWidth = ''
let lockedScrollY = 0
let pageScrollLocked = false
let returnFocusTo: HTMLElement | null = null
let closeTimer: ReturnType<typeof setTimeout> | undefined

const resetGesture = () => {
  dragY.value = 0
  dragging.value = false
  dismissing.value = false
  pointerId = undefined
}

const resetScroll = async () => {
  await nextTick()
  const reset = () => {
    if (!drawerRoot.value) return
    drawerRoot.value.scrollTop = 0
    drawerRoot.value.querySelectorAll<HTMLElement>('.filter-sheet-content, .video-panel-scroll').forEach(element => { element.scrollTop = 0 })
  }
  reset()
  requestAnimationFrame(reset)
  drawerRoot.value?.focus({ preventScroll: true })
}

const lockPageScroll = () => {
  if (pageScrollLocked) return
  pageScrollLocked = true
  lockedScrollY = window.scrollY
  previousBodyOverflow = document.body.style.overflow
  previousRootOverflow = document.documentElement.style.overflow
  previousBodyPosition = document.body.style.position
  previousBodyTop = document.body.style.top
  previousBodyWidth = document.body.style.width
  document.body.style.overflow = 'hidden'
  document.body.style.position = 'fixed'
  document.body.style.top = `-${lockedScrollY}px`
  document.body.style.width = '100%'
  document.documentElement.style.overflow = 'hidden'
}

const unlockPageScroll = () => {
  if (!pageScrollLocked) return
  pageScrollLocked = false
  document.body.style.overflow = previousBodyOverflow
  document.body.style.position = previousBodyPosition
  document.body.style.top = previousBodyTop
  document.body.style.width = previousBodyWidth
  document.documentElement.style.overflow = previousRootOverflow
  window.scrollTo({ top: lockedScrollY, left: window.scrollX, behavior: 'instant' })
}

const finishClose = () => {
  clearTimeout(closeTimer)
  closing.value = false
  resetGesture()
  returnFocusTo?.focus({ preventScroll: true })
  returnFocusTo = null
}

watch(() => props.open, async (open) => {
  if (open) {
    clearTimeout(closeTimer)
    returnFocusTo = document.activeElement instanceof HTMLElement ? document.activeElement : null
    closing.value = false
    resetGesture()
    lockPageScroll()
    void resetScroll()
    return
  }
  unlockPageScroll()
  closing.value = true
  closeTimer = setTimeout(finishClose, 400)
  await nextTick()
})

const requestClose = () => {
  if (props.dismissible) emit('close')
}

const handleKeydown = (event: KeyboardEvent) => {
  if (!props.open) return
  if (event.key === 'Escape' && props.dismissible) {
    event.preventDefault()
    requestClose()
    return
  }
  if (event.key !== 'Tab' || !drawerRoot.value) return
  const focusable = [...drawerRoot.value.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])')]
  if (!focusable.length) {
    event.preventDefault()
    drawerRoot.value.focus({ preventScroll: true })
    return
  }
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last?.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first?.focus()
  }
}

const handleClick = (event: MouseEvent) => {
  if ((event.target as HTMLElement).closest('.filter-sheet-handle')) requestClose()
}

const startDrag = (event: PointerEvent) => {
  if (event.pointerType !== 'touch' || !props.dismissible) return
  const handle = (event.target as HTMLElement).closest<HTMLElement>('.filter-sheet-handle')
  if (!handle) return
  pointerId = event.pointerId
  startY = lastY = event.clientY
  lastTime = performance.now()
  releaseVelocity = 0
  dismissing.value = false
  dragging.value = true
  handle.setPointerCapture(event.pointerId)
}

const moveDrag = (event: PointerEvent) => {
  if (!dragging.value || event.pointerId !== pointerId) return
  const now = performance.now()
  const elapsed = now - lastTime
  if (elapsed > 0) releaseVelocity = (event.clientY - lastY) / elapsed
  lastY = event.clientY
  lastTime = now
  dragY.value = Math.max(0, event.clientY - startY)
}

const finishDrag = (event: PointerEvent) => {
  if (!dragging.value || event.pointerId !== pointerId) return
  const velocity = performance.now() - lastTime < 120 ? releaseVelocity : 0
  dragging.value = false
  pointerId = undefined
  const content = drawerRoot.value?.querySelector<HTMLElement>('.asset-filter-controls, .video-mobile-panel')
  const dismissDistance = Math.min(96, (content?.offsetHeight ?? window.innerHeight) * .18)
  if (dragY.value > dismissDistance || velocity > .45) {
    dismissing.value = true
    requestAnimationFrame(() => {
      dragY.value = (content?.offsetHeight ?? window.innerHeight) + 48
      requestClose()
    })
    return
  }
  dragY.value = 0
}

const cancelDrag = (event: PointerEvent) => {
  if (!dragging.value || event.pointerId !== pointerId) return
  resetGesture()
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
  if (props.open) {
    returnFocusTo = document.activeElement instanceof HTMLElement ? document.activeElement : null
    lockPageScroll()
    void resetScroll()
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
  clearTimeout(closeTimer)
  unlockPageScroll()
})
</script>

<template>
  <Teleport to="body">
    <Transition name="selection-panel" @after-leave="emit('afterLeave')">
      <div
        v-if="open"
        ref="drawerRoot"
        class="selection-panel selection-panel--wide selection-panel--filter-overlay"
        :class="{
          'selection-panel--filter-closing': closing,
          'selection-panel--sheet-dragging': dragging,
          'selection-panel--sheet-dismissing': dismissing
        }"
        role="dialog"
        aria-modal="true"
        tabindex="-1"
        :aria-label="label"
        :style="{ '--sheet-drag-y': `${dragY}px` }"
        @click="handleClick"
        @click.self="requestClose"
        @pointerdown="startDrag"
        @pointermove="moveDrag"
        @pointerup="finishDrag"
        @pointercancel="cancelDrag">
        <slot />
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.selection-panel {
  position: fixed;
  z-index: 30;
  inset: 0;
  display: flex;
  color: var(--color-fg);
}

.selection-panel-enter-active,
.selection-panel-leave-active { transition: none; }

@media (max-width: 520px) {
  .selection-panel :deep(.asset-filter-controls) {
    animation: selection-sheet-in var(--filter-overlay-enter-duration) var(--filter-overlay-enter-easing) both;
  }

  .selection-panel.selection-panel--sheet-dismissing :deep(.asset-filter-controls) {
    animation: none;
    transition: transform 260ms var(--filter-overlay-exit-easing);
  }

  .selection-panel.selection-panel--filter-closing:not(.selection-panel--sheet-dismissing) :deep(.asset-filter-controls) {
    animation: selection-sheet-out 260ms var(--filter-overlay-exit-easing) both;
  }
}

@keyframes selection-sheet-in {
  from { translate: 0 2rem; }
  to { translate: 0 0; }
}

@keyframes selection-sheet-out {
  from { translate: 0 0; }
  to { translate: 0 1rem; }
}
</style>
