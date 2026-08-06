export default defineNuxtRouteMiddleware(async (to) => {
  const headers = import.meta.server ? useRequestHeaders(['cookie']) : undefined
  const session = await $fetch<{ data: { authenticated: boolean; user?: { mustChangePassword?: boolean } } }>('/api/auth/session', { headers }).catch(() => null)
  if (!session?.data.authenticated) return navigateTo('/login')
  if (session.data.user?.mustChangePassword && to.path !== '/change-password') return navigateTo('/change-password')
})
