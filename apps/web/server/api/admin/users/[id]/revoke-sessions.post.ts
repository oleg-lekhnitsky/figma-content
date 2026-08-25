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
  const target = await useSupabaseAdmin().from('allowed_users').select('id').eq('id', id).eq('organization_id', session.user.organization_id).maybeSingle()
  if (target.error) throw databaseError('find user for session revocation', target.error)
  if (!target.data) throw appError(404, 'USER_NOT_FOUND', 'This person no longer belongs to the workspace.')
  const { data: revokedSessions, error } = await useSupabaseAdmin().from('sessions')
    .update({ revoked_at: new Date().toISOString() })
    .eq('allowed_user_id', id)
    .is('revoked_at', null)
    .select('id')
  if (error) throw databaseError('revoke sessions', error)
  await writeAuditLog(session.user.organization_id, session.user.id, 'session_revoke', 'user', id)
  return { data: { revoked: true, revokedCount: revokedSessions?.length ?? 0 } }
})
