import { readValidatedBody } from 'h3'
import { z } from 'zod'
import { appError, databaseError } from '../../../utils/app-error'
import { hashToken } from '../../../utils/crypto'
import { createAppSession } from '../../../utils/session'
import { rateLimit } from '../../../utils/request-security'

const bodySchema = z.object({ code: z.string().min(32).max(200) }).strict()

export default defineEventHandler(async (event) => {
  rateLimit(event, 'plugin-code-exchange', 20, 60_000)
  const body = await readValidatedBody(event, value => bodySchema.safeParse(value))
  if (!body.success) throw appError(400, 'INVALID_REQUEST', 'A valid authorization code is required.', body.error.flatten())

  const now = new Date().toISOString()
  const { data, error } = await useSupabaseAdmin().rpc('consume_plugin_auth_code', {
    p_code_hash: hashToken(body.data.code), p_now: now
  })
  if (error) throw databaseError('consume plugin auth code', error)
  const allowedUserId = data?.[0]?.allowed_user_id
  if (!allowedUserId) throw appError(401, 'INVALID_AUTH_CODE', 'The authorization code is invalid, expired, or already used.')

  const { data: user, error: userError } = await useSupabaseAdmin().from('allowed_users')
    .select('is_active').eq('id', allowedUserId).maybeSingle()
  if (userError) throw databaseError('check plugin user', userError)
  if (!user?.is_active) throw appError(403, 'ACCESS_DENIED', 'This Figma account does not have access to this library. Contact a library administrator.')

  const session = await createAppSession(allowedUserId)
  return { data: { token: session.token, expiresAt: session.expiresAt } }
})
