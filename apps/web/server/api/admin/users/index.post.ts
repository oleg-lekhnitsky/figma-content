import { readValidatedBody } from 'h3'
import { userInviteSchema } from '@content-library/shared'
import { appError, databaseError } from '../../../utils/app-error'
import { writeAuditLog } from '../../../utils/audit'
import { requireRole } from '../../../utils/session'
import { requireTrustedMutation } from '../../../utils/request-security'

export default defineEventHandler(async (event) => {
  requireTrustedMutation(event)
  const session = await requireRole(event, ['admin'])
  const input = await readValidatedBody(event, body => userInviteSchema.safeParse(body))
  if (!input.success) throw appError(400, 'INVALID_USER', 'Enter a valid email and role.', input.error.flatten())
  const { data, error } = await useSupabaseAdmin().from('allowed_users').insert({ organization_id: session.user.organization_id, email: input.data.email, role: input.data.role, is_active: true }).select('*').single()
  if (error) throw databaseError('invite user', error)
  await writeAuditLog(session.user.organization_id, session.user.id, 'invite', 'user', data.id, { email: data.email, role: data.role })
  return { data: { user: data } }
})
