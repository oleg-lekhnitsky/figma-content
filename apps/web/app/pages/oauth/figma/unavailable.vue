<script setup lang="ts">
const route = useRoute()
const redirectPath = computed(() => {
  const value = route.query.redirect
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : '/library'
})
const loginDestination = computed(() => ({
  path: '/login',
  query: redirectPath.value === '/library' ? {} : { redirect: redirectPath.value }
}))
const retryDestination = computed(() => {
  const query = new URLSearchParams({
    flow: route.query.flow === 'plugin' ? 'plugin' : 'web',
    redirect: redirectPath.value
  })
  return `/api/auth/figma/start?${query.toString()}`
})
</script>

<template>
  <main class="oauth-shell">
    <section class="oauth-panel" aria-labelledby="oauth-unavailable-title">
      <header class="oauth-copy">
        <h1 id="oauth-unavailable-title">Figma sign-in is unavailable</h1>
        <p>We couldn’t connect your Figma account. Try again or use email instead.</p>
      </header>
      <div class="oauth-actions">
        <a class="oauth-return" :href="retryDestination">Try again</a>
        <NuxtLink class="oauth-return oauth-return--secondary" :to="loginDestination">Sign in with email</NuxtLink>
      </div>
    </section>
  </main>
</template>

<style scoped>
.oauth-shell {
  min-height: 100vh;
  min-height: 100dvh;
  display: grid;
  place-items: center;
  padding: var(--space);
}

.oauth-panel {
  width: min(100%, 32rem);
  padding: var(--filter-overlay-padding);
  border-radius: var(--filter-overlay-radius);
  color: var(--filter-overlay-panel-color);
  background: var(--filter-overlay-panel-background);
}

.oauth-copy {
  display: grid;
  gap: var(--filter-date-label-gap);
}

.oauth-copy h1,
.oauth-copy p {
  margin: 0;
}

.oauth-copy h1 {
  font-size: var(--filter-title-size);
  font-weight: 500;
  letter-spacing: var(--letter-spacing-heading);
  line-height: 1;
}

.oauth-copy p {
  color: var(--filter-overlay-muted-color);
  font-size: var(--font-size-label);
  line-height: 1.35;
}

.oauth-actions {
  display: grid;
  gap: var(--filter-date-label-gap);
  margin-top: var(--filter-overlay-group-gap);
}

.oauth-return.oauth-return {
  width: 100%;
  min-height: calc(var(--filter-action-height) + .25rem);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 var(--filter-action-padding);
  border-radius: calc(var(--radius) * 1.5);
  color: var(--filter-overlay-primary-color);
  background: var(--filter-overlay-primary-background);
  font-size: var(--filter-action-font-size);
  font-weight: 600;
  line-height: 1;
  text-decoration: none;
  transition-property: background-color, scale;
  transition-duration: 120ms;
  transition-timing-function: ease-out;
}

.oauth-return--secondary.oauth-return--secondary {
  color: var(--filter-overlay-panel-color);
  background: var(--filter-overlay-nested-background);
}

.oauth-return.oauth-return:hover {
  color: var(--filter-overlay-primary-color);
  background: #fff;
}

.oauth-return--secondary.oauth-return--secondary:hover {
  color: var(--filter-overlay-panel-color);
  background: var(--filter-overlay-control-hover-background);
}

.oauth-return.oauth-return:active {
  scale: 0.96;
}

.oauth-return.oauth-return:focus-visible {
  outline: 2px solid var(--filter-overlay-panel-color);
  outline-offset: 2px;
}

@media (max-width: 520px) {
  .oauth-panel {
    padding: var(--filter-sheet-content-padding-mobile);
    border-radius: calc(var(--radius-mobile) * 1.5);
    background: var(--filter-overlay-panel-background-mobile);
  }

  .oauth-return.oauth-return {
    min-height: calc(var(--range-control-height-mobile) + .25rem);
  }
}

@supports (-webkit-touch-callout: none) {
  @media (display-mode: standalone) {
    .oauth-shell {
      min-height: 100vh;
    }
  }
}

@media (prefers-reduced-motion: reduce) {
  .oauth-return.oauth-return {
    transition: none;
  }

  .oauth-return.oauth-return:active {
    scale: 1;
  }
}

@media (forced-colors: active) {
  .oauth-panel,
  .oauth-return.oauth-return {
    border: 1px solid CanvasText;
  }
}
</style>
