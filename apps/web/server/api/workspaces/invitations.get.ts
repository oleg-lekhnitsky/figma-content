import { databaseError } from '../../utils/app-error'
import { requireRole } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const session = await requireRole(event, ['admin'])
  const { data, error } = await useSupabaseAdmin().from('organization_invitations')
    .select('id,email,role,expires_at,created_at')
    .eq('organization_id', session.user.organization_id)
    .is('accepted_at', null)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
  if (error) throw databaseError('list workspace invitations', error)
  return { data: { invitations: data ?? [] } }
})
