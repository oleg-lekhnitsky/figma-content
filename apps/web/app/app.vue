<script setup lang="ts">
const splashVisible = ref(true)
let splashRemoveTimer: ReturnType<typeof setTimeout> | undefined

onMounted(() => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reducedMotion) {
    splashVisible.value = false
    return
  }
  splashRemoveTimer = setTimeout(() => { splashVisible.value = false }, 460)
})

onBeforeUnmount(() => {
  clearTimeout(splashRemoveTimer)
})
</script>

<template>
  <NuxtRouteAnnouncer />
  <PullToRefresh />
  <div v-if="splashVisible" class="app-splash" role="status" aria-label="designdep.work">
    <img class="app-splash-art" src="/pwa-mark.svg?v=6" width="1122" height="268" alt="" aria-hidden="true" decoding="sync" fetchpriority="high">
  </div>
  <NuxtPage />
</template>

<style scoped>
.app-splash {
  position: fixed;
  z-index: 10000;
  inset: 0;
  display: none;
  place-items: center;
  color: var(--color-fg);
  background: var(--color-bg);
  opacity: 1;
  pointer-events: none
}

.app-splash-art {
  width: min(87vw, 70rem);
  height: auto;
  display: block
}

@media (display-mode: standalone) {
  .app-splash {
    display: grid;
    animation: app-splash-exit 140ms ease-out 300ms forwards
  }
}

@keyframes app-splash-exit {
  to {
    visibility: hidden;
    opacity: 0
  }
}

@media (prefers-reduced-motion: reduce) {
  .app-splash {
    animation-duration: .01ms
  }
}
</style>
