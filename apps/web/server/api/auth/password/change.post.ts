import { passwordChangeSchema } from '@content-library/shared'
import { readValidatedBody } from 'h3'
import { appError, databaseError } from '../../../utils/app-error'
import { hashPassword, verifyPassword } from '../../../utils/password'
import { requireTrustedMutation } from '../../../utils/request-security'
import { requireAuth } from '../../../utils/session'

export default defineEventHandler(async (event) => {
  requireTrustedMutation(event)
  const session = await requireAuth(event)
  const input = await readValidatedBody(event, body => passwordChangeSchema.safeParse(body))
  if (!input.success) throw appError(400, 'INVALID_PASSWORD', 'Use a new password with at least 12 characters.', input.error.flatten())
  if (!session.user.password_hash || !await verifyPassword(input.data.currentPassword, session.user.password_hash)) {
    throw appError(401, 'INVALID_PASSWORD', 'Current password is incorrect.')
  }
  const passwordHash = await hashPassword(input.data.newPassword)
  const { error } = await useSupabaseAdmin().from('accounts').update({
    password_hash: passwordHash,
    must_change_password: false,
    failed_login_count: 0,
    locked_until: null
  }).eq('id', session.user.account_id)
  if (error) throw databaseError('change password', error)
  const { data: memberships } = await useSupabaseAdmin().from('allowed_users').select('id').eq('account_id', session.user.account_id)
  if (memberships?.length) await useSupabaseAdmin().from('sessions').update({ revoked_at: new Date().toISOString() })
    .in('allowed_user_id', memberships.map((item: { id:string }) => item.id)).neq('id', session.id).is('revoked_at', null)
  return { data: { changed: true } }
})
