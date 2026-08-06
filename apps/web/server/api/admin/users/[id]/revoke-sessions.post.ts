import { getRouterParam } from 'h3'
import { appError, databaseError } from '../../../../utils/app-error'
import { writeAuditLog } from '../../../../utils/audit'
import { requireRole } from '../../../../utils/session'
import { requireTrustedMutation } from '../../../../utils/request-security'

export default defineEventHandler(async (event) => {
  requireTrustedMutation(event)
  const session = await requireRole(event, ['admin'])
  const id = getRouterParam(event, 'id')
  if (!id) throw appError(400, 'INVALID_USER_ID', 'User ID is required.')
  const { error } = await useSupabaseAdmin().from('sessions').update({ revoked_at: new Date().toISOString() }).eq('allowed_user_id', id).is('revoked_at', null)
  if (error) throw databaseError('revoke sessions', error)
  await writeAuditLog(session.user.organization_id, session.user.id, 'session_revoke', 'user', id)
  return { data: { revoked: true } }
})
