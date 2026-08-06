export default defineNuxtRouteMiddleware(async () => {
  const headers = import.meta.server ? useRequestHeaders(['cookie']) : undefined
  const session = await $fetch<{ data: { authenticated: boolean } }>('/api/auth/session', { headers }).catch(() => null)
  if (!session?.data.authenticated) return navigateTo('/login')
})
