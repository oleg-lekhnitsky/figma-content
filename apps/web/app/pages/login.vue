<script setup lang="ts">
const route = useRoute()
const config = useRuntimeConfig()
const loginUrl = computed(() => {
  const url = new URL('/oauth/figma/start', config.public.appUrl)
  url.searchParams.set('flow', 'web')
  url.searchParams.set('redirect', typeof route.query.redirect === 'string' ? route.query.redirect : '/library')
  return url.toString()
})
const startLogin = () => window.location.assign(loginUrl.value)
const email = ref('')
const password = ref('')
const submitting = ref(false)
const errorMessage = ref('')
const passwordLogin = async () => {
  submitting.value = true
  errorMessage.value = ''
  try {
    const response = await $fetch<{ data: { mustChangePassword: boolean } }>('/api/auth/password/login', { method: 'POST', body: { email: email.value, password: password.value } })
    const redirect = typeof route.query.redirect === 'string' && route.query.redirect.startsWith('/') && !route.query.redirect.startsWith('//') ? route.query.redirect : '/library'
    await navigateTo(response.data.mustChangePassword ? '/change-password' : redirect)
  } catch { errorMessage.value = 'Email or password is incorrect. Check both fields and try again.' }
  finally { submitting.value = false }
}
</script>

<template>
  <main class="page-shell">
    <section class="message-panel" aria-labelledby="login-title">
      <p class="eyebrow">Private library</p>
      <h1 id="login-title" class="display-title">Sign in to<br>Content Library.</h1>
      <p class="muted">Sign in with the email and temporary password provided by an administrator.</p>
      <form @submit.prevent="passwordLogin"><label for="login-email">Email</label><input id="login-email" v-model="email" name="email" type="email" autocomplete="username" required><label for="login-password">Password</label><input id="login-password" v-model="password" name="password" type="password" autocomplete="current-password" required><button class="button" type="submit" :disabled="submitting">{{ submitting ? 'Signing in…' : 'Sign in' }}</button></form>
      <p class="form-error" role="alert">{{ errorMessage }}</p>
      <div class="alternative"><span>or</span></div>
      <p class="muted">Team members can continue with their approved Figma account.</p>
      <button class="button secondary" type="button" @click="startLogin">Continue with Figma</button>
    </section>
  </main>
</template>

<style scoped>.message-panel{padding:clamp(2rem,6vw,6rem) 0}.message-panel form{display:grid;gap:8px;margin-top:var(--space)}label{margin-top:8px;color:var(--color-muted);font-size:12px}input{box-sizing:border-box;width:100%;min-height:44px;padding:0 8px;border:0;border-bottom:1px solid var(--color-line);border-radius:0;color:inherit;background:transparent;font:inherit}.message-panel .button{justify-self:start;margin-top:8px}.secondary{color:var(--color-fg);background:var(--color-surface)}.form-error{min-height:1.25rem;margin:8px 0 0;color:#a20f0f}.alternative{display:flex;align-items:center;gap:12px;margin:var(--space) 0;color:var(--color-muted);font-size:12px}.alternative::before,.alternative::after{height:1px;flex:1;background:var(--color-line);content:""}:is(input,button):focus-visible{outline:2px solid #06f90e;outline-offset:2px}</style>
