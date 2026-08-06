<script setup lang="ts">
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
  <main class="page-shell">
    <section class="message-panel" aria-labelledby="oauth-title">
      <p class="eyebrow">Authentication</p><h1 id="oauth-title" class="display-title">Connecting<br>to Figma.</h1>
      <p v-if="!errorMessage" class="muted" role="status">Opening Figma authentication…</p>
      <template v-else>
        <p class="muted" role="alert">{{ errorMessage }}</p>
        <NuxtLink class="button" to="/login">Return to sign in</NuxtLink>
      </template>
    </section>
  </main>
</template>

<style scoped>.button{display:inline-flex;align-items:center;margin-top:var(--space)}</style>
