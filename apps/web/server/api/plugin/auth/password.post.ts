import { passwordLoginSchema } from '@content-library/shared'
import { readValidatedBody } from 'h3'
import { appError, databaseError } from '../../../utils/app-error'
import { hashPassword, verifyPassword } from '../../../utils/password'
import { rateLimit } from '../../../utils/request-security'
import { createAppSession } from '../../../utils/session'

const invalidLogin = () => appError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.')
const fallbackHashPromise = hashPassword('invalid-plugin-password-placeholder')

export default defineEventHandler(async (event) => {
  rateLimit(event, 'plugin-password-login', 10, 15 * 60 * 1000)
  const input = await readValidatedBody(event, body => passwordLoginSchema.safeParse(body))
  if (!input.success) throw invalidLogin()
  const db = useSupabaseAdmin()
  const { data: users, error } = await db.from('allowed_users').select('*')
    .eq('email', input.data.email).not('password_hash', 'is', null).limit(2)
  if (error) throw databaseError('find plugin password account', error)
  const user = users.length === 1 ? users[0] : null
  const valid = await verifyPassword(input.data.password, user?.password_hash ?? await fallbackHashPromise)
  const now = new Date()
  if (!user || !valid || !user.is_active || (user.locked_until && new Date(user.locked_until) > now)) {
    if (user && !valid) {
      const failedCount = Number(user.failed_login_count ?? 0) + 1
      const update = failedCount >= 5
        ? { failed_login_count: 0, locked_until: new Date(now.getTime() + 15 * 60 * 1000).toISOString() }
        : { failed_login_count: failedCount }
      await db.from('allowed_users').update(update).eq('id', user.id)
    }
    throw invalidLogin()
  }
  if (user.must_change_password) throw appError(403, 'PASSWORD_CHANGE_REQUIRED', 'Sign in on the library website and replace your temporary password first.')
  await db.from('allowed_users').update({ failed_login_count: 0, locked_until: null, last_login_at: now.toISOString() }).eq('id', user.id)
  const session = await createAppSession(user.id)
  return { data: { token: session.token, expiresAt: session.expiresAt } }
})
