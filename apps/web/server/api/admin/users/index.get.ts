import { requireRole } from '../../../utils/session'
import { databaseError } from '../../../utils/app-error'

export default defineEventHandler(async (event) => {
  const session = await requireRole(event, ['admin'])
  const { data, error } = await useSupabaseAdmin().from('allowed_users').select('id,email,figma_user_id,figma_handle,avatar_url,role,is_active,created_at,last_login_at,must_change_password,password_hash').eq('organization_id', session.user.organization_id).order('created_at')
  if (error) throw databaseError('list users', error)
  return { data: { users: data.map((user: { password_hash: string | null; [key: string]: unknown }) => ({ ...user, password_hash: undefined, has_password: Boolean(user.password_hash) })) } }
})
