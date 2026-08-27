<script setup lang="ts">
import { useRoute } from '#imports'
import { $fetch } from 'ofetch'
import { onMounted, ref } from 'vue'

const route = useRoute()
const errorMessage = ref('')

onMounted(async () => {
  const flow = route.query.flow === 'plugin' ? 'plugin' : 'web'
  const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/library'
  try {
    const response = await $fetch<{ data: { authorizationUrl: string } }>('/api/auth/figma/start', {
      query: { flow, redirect, response: 'json' }
    })
    window.location.assign(response.data.authorizationUrl)
  } catch {
    errorMessage.value = 'Unable to start Figma authentication. Check the server configuration and try again.'
  }
})
</script>

<template>
  <main class="oauth-shell">
    <section class="oauth-panel" aria-labelledby="oauth-title">
      <div class="oauth-copy">
        <h1 id="oauth-title">Connecting to Figma</h1>
        <p v-if="!errorMessage" role="status">Opening Figma…</p>
        <p v-else class="oauth-error" role="alert">{{ errorMessage }}</p>
      </div>
      <NuxtLink v-if="errorMessage" class="oauth-return" to="/login">Return to sign in</NuxtLink>
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
  gap: var(--filter-action-gap);
}

.oauth-copy h1,
.oauth-copy p,
.oauth-error {
  margin: 0;
}

.oauth-copy h1 {
  font-size: var(--filter-title-size);
  font-weight: 500;
  letter-spacing: -0.04em;
  line-height: 1;
}

.oauth-copy p,
.oauth-error {
  color: var(--filter-overlay-muted-color);
  font-size: var(--font-size-body-compact);
}

.oauth-return.oauth-return {
  width: 100%;
  min-height: calc(var(--filter-action-height) + .25rem);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-top: var(--filter-overlay-group-gap);
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

.oauth-return.oauth-return:hover {
  color: var(--filter-overlay-primary-color);
  background: #fff;
}

.oauth-return.oauth-return:active {
  scale: 0.96;
}

.oauth-return.oauth-return:focus-visible {
  outline: 2px solid var(--filter-overlay-panel-color);
  outline-offset: 2px;
}

@media (max-width: 520px) {
  .oauth-shell {
    place-items: center;
  }

  .oauth-panel {
    height: max-content;
    min-height: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: var(--filter-sheet-content-padding-mobile);
    border-radius: var(--radius-mobile);
    background: var(--filter-overlay-panel-background-mobile);
  }

  .oauth-return.oauth-return {
    min-height: calc(var(--range-control-height-mobile) + .25rem);
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
