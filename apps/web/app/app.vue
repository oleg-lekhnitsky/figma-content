<script setup lang="ts">
const splashVisible = ref(true)
const splashLeaving = ref(false)
let splashTimer: ReturnType<typeof setTimeout> | undefined
let splashRemoveTimer: ReturnType<typeof setTimeout> | undefined

onMounted(() => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  splashTimer = setTimeout(() => {
    splashLeaving.value = true
    splashRemoveTimer = setTimeout(() => { splashVisible.value = false }, reducedMotion ? 0 : 220)
  }, reducedMotion ? 350 : 1450)
})

onBeforeUnmount(() => {
  clearTimeout(splashTimer)
  clearTimeout(splashRemoveTimer)
})
</script>

<template>
  <NuxtRouteAnnouncer />
  <div v-if="splashVisible" class="app-splash" :class="{ 'app-splash--leaving': splashLeaving }" role="status" aria-label="Specials">
    <span aria-hidden="true">Specials</span>
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
  transition: opacity 220ms ease-out
}

.app-splash span {
  width: 0;
  overflow: hidden;
  border-right: 2px solid currentColor;
  font-family: var(--font-family-ui);
  font-size: clamp(2rem, 10vw, 4rem);
  font-weight: 500;
  letter-spacing: -.055em;
  line-height: 1;
  white-space: nowrap;
  animation: splash-type 800ms steps(8, end) 180ms forwards, splash-caret 500ms step-end 3
}

.app-splash--leaving {
  opacity: 0
}

@media (display-mode: standalone) {
  .app-splash {
    display: grid
  }
}

@keyframes splash-type {
  to { width: 8ch }
}

@keyframes splash-caret {
  50% { border-color: transparent }
}

@media (prefers-reduced-motion: reduce) {
  .app-splash {
    transition: none
  }

  .app-splash span {
    width: auto;
    border-right: 0;
    animation: none
  }
}
</style>
