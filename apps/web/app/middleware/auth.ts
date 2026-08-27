export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server) {
    const productionSession = useCookie('__Host-content_library_session')
    const developmentSession = useCookie('content_library_session')
    if (productionSession.value || developmentSession.value) return
    return navigateTo('/login')
  }

  const { data: session, execute: loadSession } = useFetch<{ data: { authenticated: boolean; user?: { mustChangePassword?: boolean } } }>('/api/auth/session', {
    key: 'auth-session',
    server: false,
    immediate: false
  })
  await loadSession().catch(() => undefined)
  if (!session.value?.data.authenticated) return navigateTo('/login')
  if (session.value.data.user?.mustChangePassword && to.path !== '/change-password') return navigateTo('/change-password')
})
