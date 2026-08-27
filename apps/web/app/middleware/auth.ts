type AuthSessionResponse = {
  data: {
    authenticated: boolean
    user?: { mustChangePassword?: boolean }
  }
}

export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server) {
    const productionSession = useCookie('__Host-content_library_session')
    const developmentSession = useCookie('content_library_session')
    if (productionSession.value || developmentSession.value) return
    return navigateTo('/login')
  }

  const nuxtApp = useNuxtApp()
  const { data: session } = useNuxtData<AuthSessionResponse>('auth-session')
  const sessionRequest = $fetch<AuthSessionResponse>('/api/auth/session').catch(() => undefined)
  const finishValidation = async () => {
    session.value = await sessionRequest
    if (!session.value?.data.authenticated) return navigateTo('/login')
    if (session.value.data.user?.mustChangePassword && to.path !== '/change-password') return navigateTo('/change-password')
  }

  // On the initial client pass, mutating keyed data before Vue mounts makes the
  // client render account controls that were absent from the SSR HTML. Start the
  // request immediately, but expose its result only after hydration is complete.
  if (nuxtApp.isHydrating) {
    nuxtApp.hook('app:mounted', () => { void finishValidation() })
    return
  }

  return finishValidation()
})
