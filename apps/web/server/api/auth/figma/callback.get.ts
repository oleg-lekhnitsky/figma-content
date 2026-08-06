import { getQuery, sendRedirect } from 'h3'
import { z } from 'zod'
import { appError, databaseError } from '../../../utils/app-error'
import { decryptSecret, hashToken, randomToken } from '../../../utils/crypto'
import { exchangeFigmaCode, getFigmaUser } from '../../../utils/figma'
import { resolveAllowedUser } from '../../../utils/allowlist'
import { createAppSession, setWebSessionCookie } from '../../../utils/session'
import { rateLimit } from '../../../utils/request-security'

const callbackSchema = z.object({ code: z.string().min(1), state: z.string().min(1) })

export default defineEventHandler(async (event) => {
  rateLimit(event, 'figma-oauth-callback', 20, 60_000)
  const parsed = callbackSchema.safeParse(getQuery(event))
  if (!parsed.success) throw appError(400, 'INVALID_OAUTH_CALLBACK', 'The OAuth callback is invalid.')

  const now = new Date().toISOString()
  const db = useSupabaseAdmin()
  const { data: state, error: stateError } = await db.from('oauth_states').update({ consumed_at: now })
    .eq('state_hash', hashToken(parsed.data.state)).is('consumed_at', null).gt('expires_at', now)
    .select('id, code_verifier_encrypted, flow, redirect_uri').maybeSingle()
  if (stateError) throw databaseError('consume OAuth state', stateError)
  if (!state) throw appError(400, 'INVALID_OAUTH_STATE', 'The OAuth request is invalid or expired.')

  const config = useRuntimeConfig()
  const verifier = decryptSecret(state.code_verifier_encrypted as string, config.sessionSecret)
  const figmaToken = await exchangeFigmaCode(parsed.data.code, verifier)
  const figmaUser = await getFigmaUser(figmaToken)
  let user
  try {
    user = await resolveAllowedUser(figmaUser)
  } catch (error: unknown) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error && error.statusCode === 403) {
      return sendRedirect(event, '/access-denied')
    }
    throw error
  }

  const { error: auditError } = await db.from('audit_logs').insert({
    organization_id: user.organization_id,
    actor_id: user.id,
    action: 'login',
    target_type: 'allowed_user',
    target_id: user.id,
    metadata: { flow: state.flow }
  })
  if (auditError) throw databaseError('write login audit log', auditError)

  if (state.flow === 'plugin') {
    const code = randomToken()
    const { error } = await db.from('plugin_auth_codes').insert({
      code_hash: hashToken(code),
      allowed_user_id: user.id,
      expires_at: new Date(Date.now() + 60_000).toISOString()
    })
    if (error) throw databaseError('create plugin auth code', error)
    const callback = new URL(config.pluginCallbackUrl)
    callback.searchParams.set('code', code)
    return sendRedirect(event, callback.toString())
  }

  const session = await createAppSession(user.id)
  setWebSessionCookie(event, session.token, session.expiresAt)
  return sendRedirect(event, (state.redirect_uri as string | null) ?? '/library')
})
