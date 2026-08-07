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
  const { data: accounts, error } = await db.from('accounts').select('*')
    .eq('email', input.data.email).not('password_hash', 'is', null).limit(1)
  if (error) throw databaseError('find plugin password account', error)
  const account = accounts[0] ?? null
  const valid = await verifyPassword(input.data.password, account?.password_hash ?? await fallbackHashPromise)
  const now = new Date()
  if (!account || !valid || (account.locked_until && new Date(account.locked_until) > now)) {
    if (account && !valid) {
      const failedCount = Number(account.failed_login_count ?? 0) + 1
      const update = failedCount >= 5
        ? { failed_login_count: 0, locked_until: new Date(now.getTime() + 15 * 60 * 1000).toISOString() }
        : { failed_login_count: failedCount }
      await db.from('accounts').update(update).eq('id', account.id)
    }
    throw invalidLogin()
  }
  if (account.must_change_password) throw appError(403, 'PASSWORD_CHANGE_REQUIRED', 'Sign in on the library website and replace your temporary password first.')
  const { data:memberships,error:membershipError }=await db.from('allowed_users').select('id').eq('account_id',account.id).eq('is_active',true).order('last_login_at',{ascending:false,nullsFirst:false}).limit(1)
  if(membershipError) throw databaseError('find plugin workspace',membershipError)
  const membership=memberships[0]
  if(!membership) throw invalidLogin()
  await db.from('accounts').update({ failed_login_count: 0, locked_until: null }).eq('id', account.id)
  await db.from('allowed_users').update({ last_login_at:now.toISOString() }).eq('id',membership.id)
  const session = await createAppSession(membership.id)
  return { data: { token: session.token, expiresAt: session.expiresAt } }
})
