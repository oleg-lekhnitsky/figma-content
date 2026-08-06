import { z } from 'zod'

const tokenResponseSchema = z.object({ access_token: z.string().min(1) })
const figmaUserSchema = z.object({
  id: z.string().min(1),
  email: z.email(),
  handle: z.string(),
  img_url: z.url().nullable().optional()
})

export type FigmaUser = z.infer<typeof figmaUserSchema>

export const buildFigmaAuthorizationUrl = (options: {
  clientId: string, redirectUri: string, state: string, challenge: string
}) => {
  const url = new URL('https://www.figma.com/oauth')
  url.search = new URLSearchParams({
    client_id: options.clientId,
    redirect_uri: options.redirectUri,
    scope: 'current_user:read',
    state: options.state,
    response_type: 'code',
    code_challenge: options.challenge
  }).toString()
  return url.toString()
}

export const exchangeFigmaCode = async (code: string, verifier: string) => {
  const config = useRuntimeConfig()
  const credentials = Buffer.from(`${config.figmaClientId}:${config.figmaClientSecret}`).toString('base64')
  const response = await $fetch('https://api.figma.com/v1/oauth/token', {
    method: 'POST',
    headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      redirect_uri: config.figmaRedirectUri,
      code,
      grant_type: 'authorization_code',
      code_verifier: verifier
    }).toString()
  })
  return tokenResponseSchema.parse(response).access_token
}

export const getFigmaUser = async (accessToken: string) => {
  const response = await $fetch('https://api.figma.com/v1/me', {
    headers: { Authorization: `Bearer ${accessToken}` }
  })
  return figmaUserSchema.parse(response)
}
