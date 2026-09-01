<script setup lang="ts">
withDefaults(defineProps<{
  message?: string
  error?: boolean
}>(), {
  message: '',
  error: false
})
</script>

<template>
  <p
    class="app-status-toast"
    :class="{ 'is-visible': message, error }"
    role="status"
    aria-live="polite"
    aria-atomic="true"
  >{{ message }}</p>
</template>

<style scoped>
.app-status-toast {
  position: fixed;
  z-index: 2;
  left: 50%;
  bottom: max(1rem, env(safe-area-inset-bottom));
  width: max-content;
  max-width: calc(100vw - 2rem);
  margin: 0;
  padding: .625rem .875rem;
  border-radius: var(--filter-pill-radius);
  color: #fff;
  background: rgb(40 40 40 / .78);
  box-shadow: 0 .5rem 2rem rgb(0 0 0 / .16);
  font-size: var(--filter-option-font-size);
  line-height: 1.2;
  text-align: center;
  opacity: 0;
  visibility: hidden;
  transform: translate(-50%, .5rem);
  pointer-events: none;
  -webkit-backdrop-filter: blur(1rem);
  backdrop-filter: blur(1rem);
  transition: opacity 180ms ease-out, transform 240ms cubic-bezier(.2, .8, .2, 1), visibility 0s linear 240ms;
}

.app-status-toast.is-visible {
  opacity: 1;
  visibility: visible;
  transform: translate(-50%, 0);
  transition-delay: 0s;
}

.app-status-toast.error { background: rgb(150 24 20 / .88); }

@media (prefers-reduced-motion: reduce) {
  .app-status-toast { transition: none; }
}
</style>
