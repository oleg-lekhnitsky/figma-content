import { getQuery, sendRedirect } from 'h3'
import { z } from 'zod'
import { buildFigmaAuthorizationUrl } from '../../../utils/figma'
import { encryptSecret, hashToken, pkceChallenge, randomToken } from '../../../utils/crypto'
import { databaseError, appError } from '../../../utils/app-error'
import { rateLimit } from '../../../utils/request-security'

const querySchema = z.object({
  flow: z.enum(['web', 'plugin']).default('web'),
  redirect: z.string().optional(),
  response: z.enum(['redirect', 'json']).default('redirect')
})

export default defineEventHandler(async (event) => {
  rateLimit(event, 'figma-oauth-start', 10, 60_000)
  const parsed = querySchema.safeParse(getQuery(event))
  if (!parsed.success) throw appError(400, 'INVALID_REQUEST', 'Invalid OAuth request.', parsed.error.flatten())

  const config = useRuntimeConfig()
  if (!config.figmaClientId || !config.figmaRedirectUri || !config.sessionSecret) {
    throw appError(503, 'AUTH_NOT_CONFIGURED', 'Figma authentication is not configured.')
  }
  const redirect = parsed.data.redirect
  if (redirect && (!redirect.startsWith('/') || redirect.startsWith('//'))) {
    throw appError(400, 'INVALID_REDIRECT', 'The redirect path is not allowed.')
  }

  const state = randomToken()
  const verifier = randomToken(64)
  const { error } = await useSupabaseAdmin().from('oauth_states').insert({
    state_hash: hashToken(state),
    code_verifier_encrypted: encryptSecret(verifier, config.sessionSecret),
    flow: parsed.data.flow,
    redirect_uri: redirect ?? null,
    expires_at: new Date(Date.now() + 10 * 60_000).toISOString()
  })
  if (error) throw databaseError('create OAuth state', error)

  const authorizationUrl = buildFigmaAuthorizationUrl({
    clientId: config.figmaClientId,
    redirectUri: config.figmaRedirectUri,
    state,
    challenge: pkceChallenge(verifier)
  })
  if (parsed.data.response === 'json') return { data: { authorizationUrl } }
  return sendRedirect(event, authorizationUrl)
})
