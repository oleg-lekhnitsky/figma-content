import { getRouterParam } from 'h3'
import { appError, databaseError } from '../../../utils/app-error'
import { writeAuditLog } from '../../../utils/audit'
import { requireTrustedMutation } from '../../../utils/request-security'
import { requireRole } from '../../../utils/session'

export default defineEventHandler(async (event) => {
  requireTrustedMutation(event)
  const session = await requireRole(event, ['admin'])
  const id = getRouterParam(event, 'id')
  if (!id) throw appError(400, 'INVALID_INVITATION_ID', 'Invitation ID is required.')

  const { data, error } = await useSupabaseAdmin().from('organization_invitations')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)
    .eq('organization_id', session.user.organization_id)
    .is('accepted_at', null)
    .is('revoked_at', null)
    .select('id,email')
    .maybeSingle()
  if (error) throw databaseError('revoke workspace invitation', error)
  if (!data) throw appError(404, 'INVITATION_NOT_FOUND', 'This invitation is no longer active.')

  await writeAuditLog(session.user.organization_id, session.user.id, 'revoke', 'invitation', data.id, { email: data.email })
  return { data: { revoked: true } }
})
