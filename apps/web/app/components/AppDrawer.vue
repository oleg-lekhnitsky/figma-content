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
let previousBodyOverflow = ''
let previousRootOverflow = ''
let previousBodyPosition = ''
let previousBodyTop = ''
let previousBodyWidth = ''
let lockedScrollY = 0
let pageScrollLocked = false
let returnFocusTo: HTMLElement | null = null
let closeTimer: ReturnType<typeof setTimeout> | undefined
let appRoot: HTMLElement | null = null
let appRootWasInert = false

const sheetContent = () => drawerRoot.value?.querySelector<HTMLElement>('.asset-filter-controls, .video-mobile-panel') ?? null

const updateSheetHeight = () => {
  sheetHeight.value = Math.max(1, sheetContent()?.offsetHeight ?? window.innerHeight)
}

const setBackgroundInert = (inert: boolean) => {
  if (inert) {
    appRoot = document.getElementById('__nuxt')
    if (!appRoot) return
    appRootWasInert = appRoot.inert
    appRoot.inert = true
    return
  }
  if (appRoot) appRoot.inert = appRootWasInert
  appRoot = null
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
    setBackgroundInert(true)
    void resetScroll()
    requestAnimationFrame(updateSheetHeight)
    return
  }
  setBackgroundInert(false)
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
    lockPageScroll()
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
        :style="{ '--sheet-drag-y': `${dragY}px`, '--sheet-backdrop-opacity': backdropOpacity }"
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
