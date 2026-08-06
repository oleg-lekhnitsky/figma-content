import { getRouterParam, readValidatedBody } from 'h3'
import { userUpdateSchema } from '@content-library/shared'
import { appError, databaseError } from '../../../utils/app-error'
import { writeAuditLog } from '../../../utils/audit'
import { requireRole } from '../../../utils/session'
import { requireTrustedMutation } from '../../../utils/request-security'

export default defineEventHandler(async (event) => {
  requireTrustedMutation(event)
  const session = await requireRole(event, ['admin'])
  const id = getRouterParam(event, 'id')
  if (!id) throw appError(400, 'INVALID_USER_ID', 'User ID is required.')
  const input = await readValidatedBody(event, body => userUpdateSchema.safeParse(body))
  if (!input.success) throw appError(400, 'INVALID_USER', 'Check the user settings.', input.error.flatten())
  if (id === session.user.id && input.data.isActive === false) throw appError(400, 'SELF_DISABLE', 'You cannot disable your own account.')
  const update = { ...(input.data.role ? { role: input.data.role } : {}), ...(input.data.isActive !== undefined ? { is_active: input.data.isActive } : {}) }
  const { data, error } = await useSupabaseAdmin().from('allowed_users').update(update).eq('id', id).eq('organization_id', session.user.organization_id).select('*').single()
  if (error) throw databaseError('update user', error)
  if (input.data.isActive === false) await useSupabaseAdmin().from('sessions').update({ revoked_at: new Date().toISOString() }).eq('allowed_user_id', id).is('revoked_at', null)
  await writeAuditLog(session.user.organization_id, session.user.id, input.data.role ? 'role_change' : 'user_disable', 'user', id, input.data)
  return { data: { user: data } }
})
