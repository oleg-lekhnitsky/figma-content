import { requireRole } from '../../../utils/session'
import { databaseError } from '../../../utils/app-error'

export default defineEventHandler(async (event) => {
  const session = await requireRole(event, ['admin'])
  const { data, error } = await useSupabaseAdmin().from('allowed_users').select('id,email,figma_user_id,figma_handle,avatar_url,role,is_active,created_at,last_login_at,accounts(password_hash,must_change_password)').eq('organization_id', session.user.organization_id).eq('is_active', true).order('created_at')
  if (error) throw databaseError('list users', error)
  return { data: { users: data.map((user: { id: string; accounts: { password_hash:string|null; must_change_password:boolean } | null; [key: string]: unknown }) => { const account=user.accounts; return { ...user, accounts:undefined, is_self:user.id === session.user.id, must_change_password:Boolean(account?.must_change_password), has_password:Boolean(account?.password_hash) } }) } }
})
