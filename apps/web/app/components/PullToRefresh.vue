<script setup lang="ts">
const pull = ref(0)
const refreshing = ref(false)
const enabled = ref(false)

const triggerDistance = 72
let startY = 0
let tracking = false

const progress = computed(() => Math.min(pull.value / triggerDistance, 1))
const indicatorStyle = computed(() => ({
  '--pull-progress': progress.value,
  transform: `translate3d(-50%, ${Math.min(pull.value, triggerDistance + 18)}px, 0)`
}))

const isScrollableTarget = (target: EventTarget | null) => {
  let element = target instanceof HTMLElement ? target : null
  while (element && element !== document.body) {
    const style = getComputedStyle(element)
    if (/(auto|scroll)/.test(style.overflowY) && element.scrollHeight > element.clientHeight) return true
    element = element.parentElement
  }
  return false
}

const startPull = (event: TouchEvent) => {
  if (!enabled.value || refreshing.value || window.scrollY > 0 || event.touches.length !== 1) return
  if (isScrollableTarget(event.target)) return
  startY = event.touches[0]?.clientY ?? 0
  tracking = true
}

const movePull = (event: TouchEvent) => {
  if (!tracking || event.touches.length !== 1) return
  const distance = (event.touches[0]?.clientY ?? startY) - startY
  if (distance <= 0) {
    pull.value = 0
    tracking = false
    return
  }
  event.preventDefault()
  pull.value = Math.min(Math.pow(distance, 0.82), triggerDistance + 18)
}

const finishPull = async () => {
  if (!tracking) return
  tracking = false
  if (pull.value < triggerDistance) {
    pull.value = 0
    return
  }
  refreshing.value = true
  pull.value = triggerDistance
  try {
    await refreshNuxtData()
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
  enabled.value = standalone && /iPad|iPhone|iPod/.test(navigator.userAgent)
  if (!enabled.value) return
  window.addEventListener('touchstart', startPull, { passive: true })
  window.addEventListener('touchmove', movePull, { passive: false })
  window.addEventListener('touchend', finishPull, { passive: true })
  window.addEventListener('touchcancel', finishPull, { passive: true })
})

onBeforeUnmount(() => {
  window.removeEventListener('touchstart', startPull)
  window.removeEventListener('touchmove', movePull)
  window.removeEventListener('touchend', finishPull)
  window.removeEventListener('touchcancel', finishPull)
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
  top: calc(env(safe-area-inset-top) - 44px);
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
  rotate: calc(var(--pull-progress) * 270deg)
}

.pull-refresh.is-ready span {
  border-top-color: currentColor
}

.pull-refresh.is-refreshing span {
  border-top-color: transparent;
  animation: pull-refresh-spin .7s linear infinite
}

@keyframes pull-refresh-spin {
  to { rotate: 360deg }
}

@media (prefers-reduced-motion: reduce) {
  .pull-refresh { transition: none }
  .pull-refresh.is-refreshing span { animation-duration: 1.2s }
}
</style>
