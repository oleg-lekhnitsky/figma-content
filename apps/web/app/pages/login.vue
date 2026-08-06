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
</script>

<template>
  <main class="page-shell">
    <section class="message-panel" aria-labelledby="login-title">
      <p class="eyebrow">Private library</p>
      <h1 id="login-title" class="display-title">Sign in to<br>Content Library.</h1>
      <p class="muted">Use the approved Figma account associated with your invitation.</p>
      <button class="button" type="button" @click="startLogin">Continue with Figma</button>
    </section>
  </main>
</template>

<style scoped>.message-panel .button{margin-top:var(--space)}</style>
