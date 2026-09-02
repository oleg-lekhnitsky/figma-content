type AuthSessionResponse = {
  data: {
    authenticated: boolean
    user?: { mustChangePassword?: boolean }
  }
}

export default defineNuxtRouteMiddleware(async () => {
  if (import.meta.server) {
    const productionSession = useCookie('__Host-content_library_session')
    const developmentSession = useCookie('content_library_session')
    if (productionSession.value || developmentSession.value) return
    return navigateTo('/login')
  }

  const nuxtApp = useNuxtApp()
  const { data: session } = useNuxtData<AuthSessionResponse>('auth-session')
  if (session.value?.data.authenticated) {
    return
  }
  const sessionRequest = $fetch<AuthSessionResponse>('/api/auth/session')
    .then(value => ({ value }))
    .catch(() => ({ value: undefined }))
  const finishValidation = async () => {
    const result = await sessionRequest
    // A temporary API failure is not evidence that the browser session expired.
    if (!result.value) return
    session.value = result.value
    if (!session.value.data.authenticated) return navigateTo('/login')
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
