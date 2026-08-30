<script setup lang="ts">
type AuthSessionResponse = {
  data: {
    authenticated: boolean
    user?: { mustChangePassword?: boolean }
  }
}

const route = useRoute()
const redirectPath = computed(() => typeof route.query.redirect === 'string' && route.query.redirect.startsWith('/') && !route.query.redirect.startsWith('//') ? route.query.redirect : '/library')

const authenticatedDestination = (session: AuthSessionResponse) => session.data.user?.mustChangePassword ? '/change-password' : redirectPath.value
const redirectAuthenticatedSession = async () => {
  const session = await $fetch<AuthSessionResponse>('/api/auth/session').catch(() => undefined)
  if (session?.data.authenticated) await navigateTo(authenticatedDestination(session), { replace: true })
}

const { data: initialSession } = await useFetch<AuthSessionResponse>('/api/auth/session', { key: 'auth-session' })
if (initialSession.value?.data.authenticated) {
  await navigateTo(authenticatedDestination(initialSession.value), { replace: true })
}

const handlePageShow = (event: PageTransitionEvent) => {
  if (event.persisted) void redirectAuthenticatedSession()
}
onMounted(() => window.addEventListener('pageshow', handlePageShow))
onBeforeUnmount(() => window.removeEventListener('pageshow', handlePageShow))

const email = ref('')
const password = ref('')
const emailInput = ref<HTMLInputElement | null>(null)
const submitting = ref(false)
const errorMessage = ref('')
const figmaSubmitting = ref(false)
const figmaErrorMessage = ref('')

watch([email, password], () => { errorMessage.value = '' })

const passwordLogin = async () => {
  submitting.value = true
  errorMessage.value = ''
  try {
    const response = await $fetch<{ data: { mustChangePassword: boolean } }>('/api/auth/password/login', { method: 'POST', body: { email: email.value, password: password.value } })
    await navigateTo(response.data.mustChangePassword ? '/change-password' : redirectPath.value, { replace: true })
  } catch {
    errorMessage.value = 'Email or password is incorrect. Check both fields and try again.'
    await nextTick()
    emailInput.value?.focus()
  }
  finally { submitting.value = false }
}

const startFigmaLogin = async () => {
  if (figmaSubmitting.value) return

  figmaSubmitting.value = true
  figmaErrorMessage.value = ''
  try {
    const response = await $fetch<{ data: { authorizationUrl: string } }>('/api/auth/figma/start', {
      query: { flow: 'web', redirect: redirectPath.value, response: 'json' }
    })
    window.location.assign(response.data.authorizationUrl)
  } catch {
    figmaErrorMessage.value = 'Unable to open Figma. Check your connection and try again.'
    figmaSubmitting.value = false
  }
}
</script>

<template>
  <main class="auth-shell">
    <section class="auth-panel" aria-labelledby="login-title">
      <header class="auth-header">
        <h1 id="login-title">Sign in</h1>
      </header>

      <form @submit.prevent="passwordLogin">
        <div class="auth-field">
          <label for="login-email">Email</label>
          <input
            id="login-email"
            ref="emailInput"
            v-model="email"
            name="email"
            type="email"
            autocomplete="username"
            placeholder="Email"
            :aria-invalid="errorMessage ? true : undefined"
            :aria-describedby="errorMessage ? 'login-error' : undefined"
            required
          >
        </div>

        <div class="auth-field">
          <label for="login-password">Password</label>
          <input
            id="login-password"
            v-model="password"
            name="password"
            type="password"
            autocomplete="current-password"
            placeholder="Password"
            :aria-invalid="errorMessage ? true : undefined"
            :aria-describedby="errorMessage ? 'login-error' : undefined"
            required
          >
        </div>

        <div class="auth-form-action">
          <p id="login-error" class="auth-error" role="alert">{{ errorMessage }}</p>
          <button class="auth-submit" type="submit" :disabled="submitting">
            {{ submitting ? 'Signing in…' : 'Sign in' }}
          </button>
        </div>
      </form>

      <div class="auth-divider" aria-hidden="true"><span>or</span></div>

      <div class="figma-option">
        <p id="figma-error" class="figma-error" role="alert">{{ figmaErrorMessage }}</p>
        <button
          class="auth-figma"
          type="button"
          :disabled="figmaSubmitting"
          :aria-busy="figmaSubmitting"
          :aria-describedby="figmaErrorMessage ? 'figma-error' : undefined"
          @click="startFigmaLogin"
        >
          {{ figmaSubmitting ? 'Opening Figma…' : 'Continue with Figma' }}
        </button>
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
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--filter-action-gap);
  margin-bottom: var(--filter-overlay-group-gap);
}

.auth-header h1 {
  margin: 0;
  font-size: var(--filter-title-size);
  font-weight: 500;
  letter-spacing: -0.04em;
  line-height: 1;
}

form {
  display: grid;
  gap: var(--space);
}

.auth-field {
  position: relative;
}

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
  transition-property: background-color;
  transition-duration: 120ms;
  transition-timing-function: ease-out;
}

.auth-field input:hover {
  background: color-mix(in srgb, var(--filter-overlay-panel-color) 11%, transparent);
}

.auth-field input:focus-visible {
  border: 0;
  outline: 2px solid currentColor;
  outline-offset: 2px;
  background: color-mix(in srgb, var(--filter-overlay-panel-color) 14%, transparent);
}

.auth-field input[aria-invalid="true"] {
  outline: 2px solid color-mix(in srgb, var(--color-danger) 42%, #fff);
  outline-offset: 2px;
}

.auth-field input::placeholder {
  color: var(--filter-overlay-muted-color);
}

.auth-field input:-webkit-autofill,
.auth-field input:-webkit-autofill:hover,
.auth-field input:-webkit-autofill:focus {
  border: 0;
  -webkit-text-fill-color: var(--filter-overlay-panel-color);
  box-shadow: 0 0 0 1000px var(--filter-overlay-nested-background) inset;
  transition: background-color 9999s ease-out 0s;
}

.auth-error {
  min-height: 1.15em;
  margin: 0;
  color: color-mix(in srgb, var(--color-danger) 42%, #fff);
  font-size: var(--font-size-label);
}

.auth-error:empty {
  display: none;
}

.auth-form-action {
  display: grid;
  gap: var(--filter-action-gap);
}

.auth-submit.auth-submit,
.auth-figma.auth-figma {
  width: 100%;
  min-height: calc(var(--filter-action-height) + .25rem);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  padding: 0 var(--filter-action-padding);
  border: 0;
  border-radius: calc(var(--radius) * 1.5);
  font-size: var(--filter-action-font-size);
  font-weight: 600;
  line-height: 1;
  text-decoration: none;
  cursor: pointer;
  opacity: 1;
  transition-property: background-color, scale, opacity;
  transition-duration: 120ms;
  transition-timing-function: ease-out;
}

.auth-submit.auth-submit {
  color: var(--filter-overlay-primary-color);
  background: var(--filter-overlay-primary-background);
}

.auth-submit.auth-submit:hover {
  background: #fff;
}

.auth-submit.auth-submit:disabled {
  cursor: wait;
  opacity: 0.5;
}

.auth-submit.auth-submit:active,
.auth-figma.auth-figma:active {
  scale: 0.96;
}

.auth-submit.auth-submit:focus-visible,
.auth-figma.auth-figma:focus-visible {
  outline: 2px solid var(--filter-overlay-panel-color);
  outline-offset: 2px;
}

.auth-divider {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: var(--filter-action-gap);
  margin: calc(var(--filter-overlay-group-gap)/2) 0;
  color: var(--filter-overlay-muted-color);
  font-size: var(--font-size-caption);
  letter-spacing: var(--letter-spacing-caption);
}

.auth-divider::before,
.auth-divider::after {
  height: 1px;
  background: color-mix(in srgb, var(--filter-overlay-panel-color) 18%, transparent);
  content: "";
}

.figma-option {
  display: grid;
  gap: var(--filter-action-gap);
}

.figma-error {
  margin: 0;
  color: var(--filter-overlay-muted-color);
  font-size: var(--font-size-label);
}

.figma-error {
  color: color-mix(in srgb, var(--color-danger) 42%, #fff);
}

.figma-error:empty {
  display: none;
}

.auth-figma.auth-figma {
  color: var(--filter-overlay-panel-color);
  background: color-mix(in srgb, var(--filter-overlay-panel-color) 7%, transparent);
}

.auth-figma.auth-figma:hover {
  color: var(--filter-overlay-panel-color);
  background: color-mix(in srgb, var(--filter-overlay-panel-color) 11%, transparent);
}

.auth-figma.auth-figma:disabled {
  cursor: wait;
  opacity: 0.5;
}

@media (max-width: 520px) {
  .auth-shell {
    place-items: center;
  }

  .auth-panel {
    height: max-content;
    min-height: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: var(--filter-sheet-content-padding-mobile);
    border-radius: calc(var(--radius-mobile)*1.5);
    background: var(--filter-overlay-panel-background-mobile);
  }

  .auth-field input {
    height: calc(var(--range-control-height-mobile) + .25rem);
    min-height: calc(var(--range-control-height-mobile) + .25rem);
  }

  .auth-submit.auth-submit,
  .auth-figma.auth-figma {
    min-height: calc(var(--range-control-height-mobile) + .25rem);
  }

}

/* WebKit subtracts safe-area height from dynamic viewport units in some
   installed viewport-fit=cover apps. The layout viewport unit remains tied
   to the full translucent canvas, so use it as the standalone centering box. */
@supports (-webkit-touch-callout: none) {
  @media (display-mode: standalone) {
    .auth-shell {
      min-height: 100vh;
    }
  }
}

@media (prefers-reduced-motion: reduce) {
  .auth-field input,
  .auth-submit.auth-submit,
  .auth-figma.auth-figma {
    transition: none;
  }

  .auth-submit.auth-submit:active,
  .auth-figma.auth-figma:active {
    scale: 1;
  }
}

@media (forced-colors: active) {
  .auth-panel,
  .auth-field input,
  .auth-submit.auth-submit,
  .auth-figma.auth-figma {
    border: 1px solid CanvasText;
  }
}
</style>
