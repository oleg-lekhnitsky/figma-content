<script setup lang="ts">
import { createAppDrawerScrollLock } from '~/utils/app-drawer-scroll-lock'
import { lockAppDrawerBackground, unlockAppDrawerBackground } from '~/utils/app-drawer-inert'

const props = withDefaults(defineProps<{
  open: boolean
  label: string
  dismissible?: boolean
}>(), {
  dismissible: true
})

const emit = defineEmits<{ close: []; afterLeave: [] }>()
const drawerRoot = ref<HTMLElement | null>(null)
const rendered = ref(props.open)
const closing = ref(false)
const dragY = ref(0)
const dragging = ref(false)
const dismissing = ref(false)
const sheetHeight = ref(1)
const backdropOpacity = computed(() => Math.max(0, 1 - dragY.value / sheetHeight.value))
let touchId: number | undefined
let pendingDrag = false
let startX = 0
let startY = 0
let lastY = 0
let lastTime = 0
let releaseVelocity = 0
let scrollSource: HTMLElement | null = null
let suppressClick = false
let suppressClickTimer: ReturnType<typeof setTimeout> | undefined
const pageScrollLock = createAppDrawerScrollLock()
const drawerExitDuration = 120
let returnFocusTo: HTMLElement | null = null
let closeTimer: ReturnType<typeof setTimeout> | undefined
let backgroundInertLocked = false

const sheetContent = () => drawerRoot.value?.querySelector<HTMLElement>('.asset-filter-controls, .video-mobile-panel') ?? null

const updateSheetHeight = () => {
  sheetHeight.value = Math.max(1, sheetContent()?.offsetHeight ?? window.innerHeight)
}

const setBackgroundInert = (inert: boolean) => {
  if (inert === backgroundInertLocked) return
  backgroundInertLocked = inert
  if (inert) {
    lockAppDrawerBackground()
    return
  }
  unlockAppDrawerBackground()
}

const resetGesture = () => {
  dragY.value = 0
  dragging.value = false
  dismissing.value = false
  touchId = undefined
  pendingDrag = false
  scrollSource = null
}

const resetScroll = async () => {
  await nextTick()
  const reset = () => {
    if (!drawerRoot.value) return
    drawerRoot.value.scrollTop = 0
    drawerRoot.value.querySelectorAll<HTMLElement>('.filter-sheet-content, .video-panel-scroll').forEach(element => { element.scrollTop = 0 })
  }
  reset()
  requestAnimationFrame(() => {
    reset()
    requestAnimationFrame(reset)
  })
  drawerRoot.value?.focus({ preventScroll: true })
}

const finishClose = () => {
  clearTimeout(closeTimer)
  rendered.value = false
}

const finishLeave = () => {
  if (props.open) return
  closing.value = false
  resetGesture()
  setBackgroundInert(false)
  pageScrollLock.unlock()
  returnFocusTo?.focus({ preventScroll: true })
  returnFocusTo = null
  emit('afterLeave')
}

watch(() => props.open, async (open) => {
  if (open) {
    clearTimeout(closeTimer)
    rendered.value = true
    returnFocusTo = document.activeElement instanceof HTMLElement ? document.activeElement : null
    closing.value = false
    resetGesture()
    pageScrollLock.lock()
    setBackgroundInert(true)
    void resetScroll()
    requestAnimationFrame(updateSheetHeight)
    return
  }
  closing.value = true
  closeTimer = setTimeout(finishClose, drawerExitDuration)
  await nextTick()
}, { flush: 'sync' })

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
  if (suppressClick) {
    event.preventDefault()
    event.stopPropagation()
    suppressClick = false
    return
  }
  if (!(event.target as HTMLElement).closest('.filter-sheet-handle')) return
  event.preventDefault()
  event.stopPropagation()
  requestClose()
}

const findTouch = (touches: TouchList) => Array.from(touches).find(touch => touch.identifier === touchId)

const startDrag = (event: TouchEvent) => {
  if (!props.dismissible || event.touches.length !== 1 || !(event.target instanceof HTMLElement)) return
  const target = event.target
  if (target.closest('[data-drawer-gesture-boundary]')) return
  const handle = target.closest<HTMLElement>('.filter-sheet-handle')
  const scrollContainer = target.closest<HTMLElement>('.filter-sheet-content, .video-panel-scroll')
  if (!handle && (!scrollContainer || scrollContainer.scrollTop > 0)) return
  const touch = event.touches[0]
  if (!touch) return
  touchId = touch.identifier
  pendingDrag = !handle
  scrollSource = scrollContainer
  startX = touch.clientX
  startY = lastY = touch.clientY
  lastTime = performance.now()
  releaseVelocity = 0
  dismissing.value = false
  dragging.value = Boolean(handle)
  updateSheetHeight()
}

const moveDrag = (event: TouchEvent) => {
  const touch = findTouch(event.touches)
  if (!touch) return
  const deltaX = touch.clientX - startX
  const deltaY = touch.clientY - startY
  if (pendingDrag) {
    if (Math.abs(deltaX) > Math.abs(deltaY) || deltaY < 0 || (scrollSource?.scrollTop ?? 0) > 0) {
      touchId = undefined
      pendingDrag = false
      scrollSource = null
      return
    }
    if (deltaY < 6) return
    pendingDrag = false
    dragging.value = true
  }
  if (!dragging.value) return
  if (event.cancelable) event.preventDefault()
  const now = performance.now()
  const elapsed = now - lastTime
  if (elapsed > 0) releaseVelocity = (touch.clientY - lastY) / elapsed
  lastY = touch.clientY
  lastTime = now
  const distance = Math.max(0, deltaY)
  const overflow = Math.max(0, distance - sheetHeight.value)
  dragY.value = distance <= sheetHeight.value ? distance : sheetHeight.value + Math.sqrt(overflow) * 4
  if (distance > 4) suppressClick = true
}

const finishDrag = (event: TouchEvent) => {
  if (!findTouch(event.changedTouches)) return
  if (pendingDrag) {
    touchId = undefined
    pendingDrag = false
    scrollSource = null
    return
  }
  if (!dragging.value) return
  const velocity = performance.now() - lastTime < 120 ? releaseVelocity : 0
  dragging.value = false
  touchId = undefined
  const content = sheetContent()
  const dismissDistance = Math.min(96, (content?.offsetHeight ?? window.innerHeight) * .18)
  clearTimeout(suppressClickTimer)
  suppressClickTimer = setTimeout(() => { suppressClick = false }, 350)
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

const cancelDrag = () => {
  if (touchId === undefined) return
  resetGesture()
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
  if (props.open) {
    returnFocusTo = document.activeElement instanceof HTMLElement ? document.activeElement : null
    pageScrollLock.lock()
    setBackgroundInert(true)
    void resetScroll()
    requestAnimationFrame(updateSheetHeight)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
  clearTimeout(closeTimer)
  clearTimeout(suppressClickTimer)
  setBackgroundInert(false)
  pageScrollLock.unlock()
})
</script>

<template>
  <Teleport to="body">
    <Transition name="selection-panel" @after-leave="finishLeave">
      <div
        v-if="rendered"
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
        :style="{ '--sheet-drag-y': `${dragY}px`, '--sheet-backdrop-opacity': backdropOpacity, '--sheet-content-opacity': backdropOpacity }"
        @click.capture="handleClick"
        @click.self="requestClose"
        @touchstart.passive="startDrag"
        @touchmove="moveDrag"
        @touchend="finishDrag"
        @touchcancel="cancelDrag">
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
    transition: transform var(--filter-sheet-drag-duration) var(--filter-overlay-exit-easing), opacity var(--filter-sheet-drag-duration) var(--filter-overlay-exit-easing);
  }

  .selection-panel.selection-panel--filter-closing:not(.selection-panel--sheet-dismissing) :deep(.asset-filter-controls) {
    animation: selection-sheet-out var(--filter-sheet-drag-duration) var(--filter-overlay-exit-easing) both;
    opacity: 0;
    transition: opacity var(--filter-sheet-drag-duration) var(--filter-overlay-exit-easing);
  }

  .selection-panel.selection-panel--filter-closing::before {
    opacity: 0;
    transition: opacity var(--filter-sheet-drag-duration) var(--filter-overlay-exit-easing);
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
