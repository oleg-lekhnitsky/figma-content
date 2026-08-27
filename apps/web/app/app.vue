<script setup lang="ts">
const splashVisible = ref(true)
const splashLeaving = ref(false)
const route = useRoute()
let splashReadyTimer: ReturnType<typeof setTimeout> | undefined
let splashFallbackTimer: ReturnType<typeof setTimeout> | undefined
let splashRemoveTimer: ReturnType<typeof setTimeout> | undefined
let splashMountedAt = 0
let reducedMotion = false

const leaveSplash = () => {
  if (splashLeaving.value) return
  splashLeaving.value = true
  clearTimeout(splashFallbackTimer)
  splashRemoveTimer = setTimeout(() => { splashVisible.value = false }, reducedMotion ? 0 : 140)
}

const revealContent = () => {
  clearTimeout(splashReadyTimer)
  const minimumVisibleTime = reducedMotion ? 0 : Math.max(0, 300 - (performance.now() - splashMountedAt))
  splashReadyTimer = setTimeout(leaveSplash, minimumVisibleTime)
}

onMounted(() => {
  reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  splashMountedAt = performance.now()
  window.addEventListener('app-content-ready', revealContent, { once: true })
  splashFallbackTimer = setTimeout(leaveSplash, 8000)
  if (route.path !== '/library') revealContent()
})

onBeforeUnmount(() => {
  window.removeEventListener('app-content-ready', revealContent)
  clearTimeout(splashReadyTimer)
  clearTimeout(splashFallbackTimer)
  clearTimeout(splashRemoveTimer)
})
</script>

<template>
  <NuxtRouteAnnouncer />
  <PullToRefresh />
  <div v-if="splashVisible" class="app-splash" :class="{ 'app-splash--leaving': splashLeaving }" role="status" aria-label="designdep.work">
    <img class="app-splash-art" src="/pwa-mark.svg?v=6" width="1122" height="268" alt="" aria-hidden="true" decoding="sync" fetchpriority="high">
  </div>
  <NuxtPage />
</template>

<style scoped>
.app-splash {
  position: fixed;
  z-index: 2147483647;
  inset: 0;
  display: none;
  overflow: hidden;
  contain: layout paint;
  color: var(--color-fg);
  background: var(--color-bg, #fafafa)
}

.app-splash-art {
  position: absolute;
  top: 50svh;
  left: 50%;
  width: min(87vw, 70rem);
  height: auto;
  display: block;
  opacity: 1;
  transform: translate(-50%, -50%);
  transition: opacity 140ms ease-out
}

@media (display-mode: standalone) {
  .app-splash {
    display: grid
  }
}

.app-splash--leaving .app-splash-art {
  opacity: 0
}

@media (prefers-reduced-motion: reduce) {
  .app-splash-art {
    transition: none
  }
}
</style>
