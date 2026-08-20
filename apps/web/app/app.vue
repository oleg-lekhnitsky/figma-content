<script setup lang="ts">
const splashVisible = ref(true)
const splashLeaving = ref(false)
const splashLetters = [...'Specials']
let splashTimer: ReturnType<typeof setTimeout> | undefined
let splashRemoveTimer: ReturnType<typeof setTimeout> | undefined

onMounted(() => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  splashTimer = setTimeout(() => {
    splashLeaving.value = true
    splashRemoveTimer = setTimeout(() => { splashVisible.value = false }, reducedMotion ? 0 : 220)
  }, reducedMotion ? 350 : 1100)
})

onBeforeUnmount(() => {
  clearTimeout(splashTimer)
  clearTimeout(splashRemoveTimer)
})
</script>

<template>
  <NuxtRouteAnnouncer />
  <div v-if="splashVisible" class="app-splash" :class="{ 'app-splash--leaving': splashLeaving }" role="status" aria-label="Specials">
    <span class="app-splash-word" aria-hidden="true"><span v-for="(letter, index) in splashLetters" :key="index" class="app-splash-letter" :style="{ '--letter-stagger': `${120 + index * 35}ms` }">{{ letter }}</span></span>
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

.app-splash-word {
  display: flex;
  transform: translateY(-2dvh);
  font-family: var(--font-family-ui);
  font-size: clamp(3rem, 14vw, 6rem);
  font-weight: 500;
  letter-spacing: -.055em;
  line-height: 1;
  white-space: nowrap
}

.app-splash-letter {
  display: inline-block;
  opacity: 0;
  transform: translateY(16px);
  animation: splash-letter-in 220ms cubic-bezier(.2, 0, 0, 1) var(--letter-stagger) forwards
}

.app-splash--leaving {
  opacity: 0
}

@media (display-mode: standalone) {
  .app-splash {
    display: grid
  }
}

@keyframes splash-letter-in {
  to {
    opacity: 1;
    transform: translateY(0)
  }
}

@media (prefers-reduced-motion: reduce) {
  .app-splash {
    transition: none
  }

  .app-splash-letter {
    opacity: 1;
    transform: none;
    animation: none
  }
}
</style>
