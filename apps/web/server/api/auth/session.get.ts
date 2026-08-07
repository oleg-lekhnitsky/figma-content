import { getAppSession } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const session = await getAppSession(event)
  const organization = session ? await useSupabaseAdmin().from('organizations').select('id,name,slug').eq('id', session.user.organization_id).single() : null
  return { data: session ? {
    authenticated: true,
    expiresAt: session.expiresAt,
    user: {
      id: session.user.id,
      email: session.user.email,
      figmaHandle: session.user.figma_handle,
      avatarUrl: session.user.avatar_url,
      role: session.user.role,
      mustChangePassword: session.user.must_change_password,
      workspace: organization?.data ?? null
    }
  } : { authenticated: false } }
})
