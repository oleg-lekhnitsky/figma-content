<script setup lang="ts">
const splashVisible = ref(true)
const splashLeaving = ref(false)
let splashTimer: ReturnType<typeof setTimeout> | undefined
let splashRemoveTimer: ReturnType<typeof setTimeout> | undefined

onMounted(() => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  splashTimer = setTimeout(() => {
    splashLeaving.value = true
    splashRemoveTimer = setTimeout(() => { splashVisible.value = false }, reducedMotion ? 0 : 140)
  }, reducedMotion ? 0 : 80)
})

onBeforeUnmount(() => {
  clearTimeout(splashTimer)
  clearTimeout(splashRemoveTimer)
})
</script>

<template>
  <NuxtRouteAnnouncer />
  <PullToRefresh />
  <div v-if="splashVisible" class="app-splash" :class="{ 'app-splash--leaving': splashLeaving }" role="status" aria-label="designdep.work">
    <img class="app-splash-art" src="/pwa-mark.svg?v=5" alt="" aria-hidden="true" decoding="sync" fetchpriority="high">
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
  transition: opacity 140ms ease-out
}

.app-splash-art {
  width: min(87vw, 70rem);
  height: auto;
  display: block
}

.app-splash--leaving {
  opacity: 0
}

@media (display-mode: standalone) {
  .app-splash {
    display: grid
  }
}

@media (prefers-reduced-motion: reduce) {
  .app-splash {
    transition: none
  }
}
</style>
