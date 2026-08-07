import { readValidatedBody } from 'h3'
import { userInviteSchema } from '@content-library/shared'
import { appError, databaseError } from '../../../utils/app-error'
import { writeAuditLog } from '../../../utils/audit'
import { requireRole } from '../../../utils/session'
import { requireTrustedMutation } from '../../../utils/request-security'
import { hashPassword } from '../../../utils/password'

export default defineEventHandler(async (event) => {
  requireTrustedMutation(event)
  const session = await requireRole(event, ['admin'])
  const input = await readValidatedBody(event, body => userInviteSchema.safeParse(body))
  if (!input.success) throw appError(400, 'INVALID_USER', 'Enter a valid email and role.', input.error.flatten())
  const db = useSupabaseAdmin()
  const passwordHash = input.data.temporaryPassword ? await hashPassword(input.data.temporaryPassword) : undefined
  const { data: existingAccount, error: accountReadError } = await db.from('accounts').select('id,password_hash')
    .eq('email', input.data.email).maybeSingle()
  if (accountReadError) throw databaseError('find account', accountReadError)
  let account = existingAccount
  if (!account) {
    if (!passwordHash) throw appError(400, 'PASSWORD_REQUIRED', 'A temporary password is required for a new account.')
    const created = await db.from('accounts').insert({ email: input.data.email, password_hash: passwordHash, must_change_password: true }).select('id,password_hash').single()
    if (created.error) throw databaseError('create account', created.error)
    account = created.data
  }
  const { data: existing, error: readError } = await db.from('allowed_users').select('id')
    .eq('organization_id', session.user.organization_id).eq('email', input.data.email).maybeSingle()
  if (readError) throw databaseError('find invited user', readError)
  const values = {
    role: input.data.role,
    is_active: true,
  }
  const query = existing
    ? db.from('allowed_users').update(values).eq('id', existing.id)
    : db.from('allowed_users').insert({ organization_id: session.user.organization_id, account_id: account.id, email: input.data.email, ...values })
  const { data, error } = await query.select('id,email,figma_user_id,figma_handle,avatar_url,role,is_active,created_at,last_login_at').single()
  if (error) throw databaseError('add user', error)
  await writeAuditLog(session.user.organization_id, session.user.id, 'invite', 'user', data.id, { email: data.email, role: data.role })
  return { data: { user: { ...data, must_change_password: Boolean(passwordHash || (!existingAccount && account.password_hash)), has_password: Boolean(account.password_hash) } } }
})
