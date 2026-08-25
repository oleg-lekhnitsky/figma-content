<script setup lang="ts">
const pull = ref(0)
const refreshing = ref(false)
const enabled = ref(false)

const triggerDistance = 60
const pullResistance = 0.65
const maxPullDistance = triggerDistance + 18
const directionThreshold = 6
let startX = 0
let startY = 0
let tracking = false
let directionLocked = false

const progress = computed(() => Math.min(pull.value / triggerDistance, 1))
const indicatorStyle = computed(() => ({
  '--pull-progress': progress.value,
  transform: `translate3d(-50%, ${Math.min(pull.value, maxPullDistance)}px, 0)`
}))

const hasScrolledScrollableTarget = (target: EventTarget | null) => {
  let element = target instanceof HTMLElement ? target : null
  while (element && element !== document.body) {
    const style = getComputedStyle(element)
    if (/(auto|scroll)/.test(style.overflowY) && element.scrollHeight > element.clientHeight && element.scrollTop > 0) return true
    element = element.parentElement
  }
  return false
}

const pageScrollTop = () => Math.max(window.scrollY, document.scrollingElement?.scrollTop ?? 0)

const isInteractionBlocked = () => {
  const appRoot = document.getElementById('__nuxt')
  return Boolean(appRoot?.inert || document.querySelector('dialog[open], [role="dialog"][aria-modal="true"]'))
}

const resetPull = () => {
  pull.value = 0
  tracking = false
  directionLocked = false
}

const startPull = (event: TouchEvent) => {
  if (!enabled.value || refreshing.value) return
  resetPull()
  if (isInteractionBlocked() || pageScrollTop() > 0 || event.touches.length !== 1) return
  if (hasScrolledScrollableTarget(event.target)) return
  const touch = event.touches[0]
  if (!touch) return
  startX = touch.clientX
  startY = touch.clientY
  tracking = true
}

const movePull = (event: TouchEvent) => {
  if (!tracking) return
  if (event.touches.length !== 1) {
    resetPull()
    return
  }
  if (isInteractionBlocked() || pageScrollTop() > 0 || hasScrolledScrollableTarget(event.target)) {
    resetPull()
    return
  }
  const touch = event.touches[0]
  if (!touch) return
  const deltaX = touch.clientX - startX
  const deltaY = touch.clientY - startY
  if (!directionLocked) {
    if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < directionThreshold) return
    if (deltaY <= 0 || Math.abs(deltaX) > Math.abs(deltaY)) {
      resetPull()
      return
    }
    directionLocked = true
  }
  if (deltaY <= 0) {
    resetPull()
    return
  }
  if (event.cancelable) event.preventDefault()
  pull.value = Math.min(deltaY * pullResistance, maxPullDistance)
}

const finishPull = async () => {
  if (!tracking) return
  tracking = false
  directionLocked = false
  if (isInteractionBlocked() || pull.value < triggerDistance) {
    resetPull()
    return
  }
  refreshing.value = true
  pull.value = triggerDistance
  try {
    await runPullRefresh()
  } finally {
    window.setTimeout(() => {
      refreshing.value = false
      pull.value = 0
    }, 280)
  }
}

onMounted(() => {
  const standalone = window.matchMedia('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true
  const appleTouchDevice = /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  enabled.value = standalone && appleTouchDevice && navigator.maxTouchPoints > 0
  if (!enabled.value) return
  window.addEventListener('touchstart', startPull, { passive: true })
  window.addEventListener('touchmove', movePull, { passive: false })
  window.addEventListener('touchend', finishPull, { passive: true })
  window.addEventListener('touchcancel', resetPull, { passive: true })
})

onBeforeUnmount(() => {
  window.removeEventListener('touchstart', startPull)
  window.removeEventListener('touchmove', movePull)
  window.removeEventListener('touchend', finishPull)
  window.removeEventListener('touchcancel', resetPull)
})
</script>

<template>
  <div
    v-if="enabled"
    class="pull-refresh"
    :class="{ 'is-visible': pull > 0, 'is-ready': progress >= 1, 'is-refreshing': refreshing }"
    :style="indicatorStyle"
    role="status"
    :aria-label="refreshing ? 'Refreshing' : progress >= 1 ? 'Release to refresh' : 'Pull to refresh'"
  >
    <span aria-hidden="true" />
  </div>
</template>

<style scoped>
.pull-refresh {
  position: fixed;
  z-index: 9999;
  top: max(8px, calc(env(safe-area-inset-top) - 36px));
  left: 50%;
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  pointer-events: none;
  opacity: 0;
  border-radius: 50%;
  color: var(--color-fg);
  background: color-mix(in srgb, var(--color-bg) 88%, transparent);
  box-shadow: 0 2px 14px rgb(0 0 0 / .12);
  -webkit-backdrop-filter: blur(12px);
  backdrop-filter: blur(12px);
  transition: opacity 120ms ease-out, transform 120ms ease-out
}

.pull-refresh.is-visible,
.pull-refresh.is-refreshing {
  opacity: 1;
  transition: opacity 80ms ease-out
}

.pull-refresh span {
  width: 14px;
  height: 14px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  transform: rotate(calc(var(--pull-progress) * 270deg))
}

.pull-refresh.is-ready span {
  border-top-color: currentColor
}

.pull-refresh.is-refreshing span {
  border-top-color: transparent;
  will-change: transform;
  animation: pull-refresh-spin .7s linear infinite
}

@keyframes pull-refresh-spin {
  from { transform: rotate(0deg) }
  to { transform: rotate(360deg) }
}

@media (prefers-reduced-motion: reduce) {
  .pull-refresh { transition: none }
  .pull-refresh.is-refreshing span { animation-duration: 1.2s }
}
</style>
