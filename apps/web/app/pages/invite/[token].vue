<script setup lang="ts">
const route = useRoute()
const token = String(route.params.token)
const { data, error } = await useFetch<{ data: { email: string; role: string; workspace: { name: string } } }>(`/api/invitations/${token}`)
const { data: session } = await useFetch<{ data: { authenticated: boolean } }>('/api/auth/session')
const password = ref('')
const busy = ref(false)
const message = ref('')
const authenticated = computed(() => Boolean(session.value?.data.authenticated))
const signIn = () => navigateTo(`/login?redirect=${encodeURIComponent(route.fullPath)}`)

const accept = async () => {
  busy.value = true
  message.value = ''
  try {
    await $fetch('/api/invitations/accept', {
      method: 'POST',
      body: { token, ...(password.value ? { password: password.value } : {}) }
    })
    await navigateTo('/library')
  } catch (err: unknown) {
    const failure = err as { statusCode?: number; data?: { message?: string } }
    if (failure.statusCode === 401) {
      await navigateTo(`/login?redirect=${encodeURIComponent(route.fullPath)}`)
      return
    }
    message.value = failure.data?.message ?? 'Unable to accept this invitation.'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <main class="auth-shell">
    <section class="auth-panel" aria-labelledby="invite-title">
      <template v-if="data">
        <header class="auth-header">
          <h1 id="invite-title">Join {{ data.data.workspace.name }}</h1>
          <p>{{ data.data.role.charAt(0).toUpperCase() + data.data.role.slice(1) }} access for {{ data.data.email }}.</p>
        </header>

        <form @submit.prevent="accept">
          <div v-if="!authenticated" class="auth-field">
            <label for="invite-password">Password for a new account</label>
            <input
              id="invite-password"
              v-model="password"
              name="password"
              type="password"
              minlength="12"
              autocomplete="new-password"
              placeholder="Create a password"
              :aria-invalid="message ? true : undefined"
              :aria-describedby="message ? 'invite-error' : undefined"
              required
            >
          </div>
          <div class="auth-form-action">
            <p v-if="message" id="invite-error" class="auth-error" role="alert">{{ message }}</p>
            <button class="auth-submit" type="submit" :disabled="busy">
              {{ busy ? 'Joining…' : authenticated ? 'Join workspace' : 'Create account and join' }}
            </button>
          </div>
          <template v-if="!authenticated">
            <div class="auth-divider" aria-hidden="true"><span>or</span></div>
            <button class="auth-secondary" type="button" @click="signIn">Sign in to join</button>
          </template>
        </form>
      </template>

      <template v-else>
        <header class="auth-header">
          <h1 id="invite-title">Invitation unavailable</h1>
          <p>{{ error ? 'This invitation is invalid or has expired.' : 'Loading invitation…' }}</p>
        </header>
      </template>
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
  display: grid;
  gap: var(--filter-date-label-gap);
  margin-bottom: var(--filter-overlay-group-gap);
}

.auth-header h1,
.auth-header p { margin: 0; }

.auth-header h1 {
  font-size: var(--filter-title-size);
  font-weight: 500;
  letter-spacing: -.04em;
  line-height: 1;
}

.auth-header p {
  color: var(--filter-overlay-muted-color);
  font-size: var(--font-size-label);
  line-height: 1.35;
}

form { display: grid; gap: var(--space); }
.auth-field { position: relative; }

.auth-field label {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  border: 0;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
}

.auth-field input {
  box-sizing: border-box;
  width: 100%;
  height: calc(var(--filter-field-height) + .25rem);
  min-height: calc(var(--filter-field-height) + .25rem);
  padding: 0 var(--filter-option-padding);
  border: 0;
  border-radius: calc(var(--radius) * 1.5);
  color: var(--filter-overlay-panel-color);
  background: color-mix(in srgb, var(--filter-overlay-panel-color) 7%, transparent);
  caret-color: currentColor;
  font-size: var(--filter-action-font-size);
  transition: background-color 120ms ease-out;
}

.auth-field input::placeholder { color: var(--filter-overlay-muted-color); }
.auth-field input:hover { background: color-mix(in srgb, var(--filter-overlay-panel-color) 11%, transparent); }
.auth-field input:focus-visible {
  border: 0;
  outline: 2px solid currentColor;
  outline-offset: 2px;
  background: color-mix(in srgb, var(--filter-overlay-panel-color) 14%, transparent);
}
.auth-field input[aria-invalid='true'] {
  outline: 2px solid color-mix(in srgb, var(--color-danger) 42%, #fff);
  outline-offset: 2px;
}

.auth-form-action { display: grid; gap: var(--filter-action-gap); }
.auth-error {
  margin: 0;
  color: color-mix(in srgb, var(--color-danger) 42%, #fff);
  font-size: var(--font-size-label);
}

.auth-submit.auth-submit,
.auth-secondary.auth-secondary {
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
  opacity: 1;
  transition: background-color 120ms ease-out, scale 120ms ease-out, opacity 120ms ease-out;
}

.auth-submit.auth-submit:hover { background: #fff; }
.auth-secondary.auth-secondary {
  color: var(--filter-overlay-panel-color);
  background: color-mix(in srgb, var(--filter-overlay-panel-color) 7%, transparent);
}
.auth-secondary.auth-secondary:hover { background: color-mix(in srgb, var(--filter-overlay-panel-color) 11%, transparent); }
.auth-submit.auth-submit:disabled { cursor: wait; opacity: .5; }
.auth-submit.auth-submit:active,
.auth-secondary.auth-secondary:active { scale: .96; }
.auth-submit.auth-submit:focus-visible,
.auth-secondary.auth-secondary:focus-visible { outline: 2px solid var(--filter-overlay-panel-color); outline-offset: 2px; }

.auth-divider {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: var(--filter-action-gap);
  color: var(--filter-overlay-muted-color);
  font-size: var(--font-size-caption);
  letter-spacing: var(--letter-spacing-caption);
}
.auth-divider::before,
.auth-divider::after {
  height: 1px;
  background: color-mix(in srgb, var(--filter-overlay-panel-color) 18%, transparent);
  content: '';
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
  .auth-field input,
  .auth-submit.auth-submit,
  .auth-secondary.auth-secondary {
    height: calc(var(--range-control-height-mobile) + .25rem);
    min-height: calc(var(--range-control-height-mobile) + .25rem);
  }
}

@media (prefers-reduced-motion: reduce) {
  .auth-field input,
  .auth-submit.auth-submit,
  .auth-secondary.auth-secondary { transition: none; }
  .auth-submit.auth-submit:active,
  .auth-secondary.auth-secondary:active { scale: 1; }
}

@media (forced-colors: active) {
  .auth-panel,
  .auth-field input,
  .auth-submit.auth-submit,
  .auth-secondary.auth-secondary { border: 1px solid CanvasText; }
}
</style>
