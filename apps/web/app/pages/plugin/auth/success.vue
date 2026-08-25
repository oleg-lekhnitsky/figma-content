<script setup lang="ts">
const route = useRoute()
const code = ref(typeof route.query.code === 'string' ? route.query.code : '')
const hasCode = computed(() => code.value.length > 0)
const copied = ref(false)

const copyCode = async () => {
  await navigator.clipboard.writeText(code.value)
  copied.value = true
}
</script>

<template>
  <main class="auth-shell">
    <section class="auth-panel" aria-labelledby="plugin-auth-title">
      <header class="auth-header">
        <h1 id="plugin-auth-title">{{ hasCode ? 'Authentication complete' : 'Authentication failed' }}</h1>
      </header>

      <template v-if="hasCode">
        <div class="auth-content">
          <p class="auth-copy">Copy this one-time code, return to the plugin, and paste it there within one minute.</p>
          <div class="auth-code" aria-label="One-time authentication code"><code>{{ code }}</code></div>
          <button class="auth-submit" type="button" @click="copyCode">{{ copied ? 'Code copied' : 'Copy one-time code' }}</button>
          <p class="auth-status" role="status" aria-live="polite">{{ copied ? 'The code is ready to paste in Figma.' : '' }}</p>
        </div>
      </template>

      <div v-else class="auth-content">
        <p class="auth-copy">No plugin authorization code was provided. Return to Figma and try again.</p>
      </div>
    </section>
  </main>
</template>

<style scoped>
.auth-shell {
  min-height: 100vh;
  min-height: 100dvh;
  display: grid;
  place-items: center;
  padding: var(--space);
}

.auth-panel {
  width: min(100%, 32rem);
  padding: var(--filter-overlay-padding);
  border-radius: var(--filter-overlay-radius);
  color: var(--filter-overlay-panel-color);
  background: var(--filter-overlay-panel-background);
}

.auth-header {
  margin-bottom: var(--filter-overlay-group-gap);
}

.auth-header h1 {
  margin: 0;
  font-size: var(--filter-title-size);
  font-weight: 500;
  letter-spacing: -.04em;
  line-height: 1;
}

.auth-content {
  display: grid;
  gap: var(--space);
}

.auth-copy,
.auth-status {
  margin: 0;
  color: var(--filter-overlay-muted-color);
  font-size: var(--font-size-label);
  line-height: 1.25;
}

.auth-code {
  min-height: calc(var(--filter-field-height) + .25rem);
  display: flex;
  align-items: center;
  padding: var(--filter-option-padding);
  overflow: hidden;
  border-radius: calc(var(--radius) * 1.5);
  background: color-mix(in srgb, var(--filter-overlay-panel-color) 7%, transparent);
}

.auth-code code {
  min-width: 0;
  overflow-wrap: anywhere;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: var(--font-size-label);
  font-weight: 500;
}

.auth-submit.auth-submit {
  width: 100%;
  min-height: calc(var(--filter-action-height) + .25rem);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  padding: 0 var(--filter-action-padding);
  border: 0;
  border-radius: calc(var(--radius) * 1.5);
  color: var(--filter-overlay-primary-color);
  background: var(--filter-overlay-primary-background);
  font-size: var(--filter-action-font-size);
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
  transition: background-color 120ms ease-out, scale 120ms ease-out;
}

.auth-submit.auth-submit:hover { background: #fff; }
.auth-submit.auth-submit:active { scale: .96; }
.auth-submit.auth-submit:focus-visible { outline: 2px solid var(--filter-overlay-panel-color); outline-offset: 2px; }

.auth-status {
  min-height: 1.15em;
}

@media (max-width: 520px) {
  .auth-shell { place-items: stretch; }

  .auth-panel {
    min-height: calc(100dvh - var(--space) * 2);
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: var(--filter-sheet-content-padding-mobile);
    border-radius: var(--radius-mobile);
    background: var(--filter-overlay-panel-background-mobile);
  }

  .auth-header { margin-bottom: var(--filter-sheet-group-gap-mobile); }
  .auth-code, .auth-submit.auth-submit { min-height: calc(var(--range-control-height-mobile) + .25rem); }
}

@media (prefers-reduced-motion: reduce) {
  .auth-submit.auth-submit { transition: none; }
  .auth-submit.auth-submit:active { scale: 1; }
}

@media (forced-colors: active) {
  .auth-panel, .auth-code, .auth-submit.auth-submit { border: 1px solid CanvasText; }
}
</style>
