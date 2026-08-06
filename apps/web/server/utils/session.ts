import type { H3Event } from 'h3'
import { deleteCookie, getCookie, getHeader, setCookie } from 'h3'
import type { Role } from '@content-library/shared'
import type { AllowedUserRow } from './database.types'
import { appError, databaseError } from './app-error'
import { hashToken, randomToken } from './crypto'

const sessionCookieName = () => process.env.NODE_ENV === 'production'
  ? '__Host-content_library_session'
  : 'content_library_session'

export interface AppSession {
  id: string
  user: AllowedUserRow
  expiresAt: string
}

export const createAppSession = async (allowedUserId: string) => {
  const config = useRuntimeConfig()
  const token = randomToken()
  const expiresAt = new Date(Date.now() + Number(config.sessionTtlSeconds) * 1000).toISOString()
  const { error } = await useSupabaseAdmin().from('sessions').insert({
    allowed_user_id: allowedUserId,
    token_hash: hashToken(token),
    expires_at: expiresAt
  })
  if (error) throw databaseError('create session', error)
  return { token, expiresAt }
}

export const setWebSessionCookie = (event: H3Event, token: string, expiresAt: string) => {
  setCookie(event, sessionCookieName(), token, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', expires: new Date(expiresAt)
  })
}

const sessionToken = (event: H3Event) => {
  const authorization = getHeader(event, 'authorization')
  if (authorization?.startsWith('Bearer ')) return authorization.slice(7)
  return getCookie(event, sessionCookieName())
}

export const getAppSession = async (event: H3Event): Promise<AppSession | null> => {
  const token = sessionToken(event)
  if (!token) return null
  const now = new Date().toISOString()
  const { data, error } = await useSupabaseAdmin().from('sessions')
    .select('id, expires_at, allowed_users(*)')
    .eq('token_hash', hashToken(token)).is('revoked_at', null).gt('expires_at', now).maybeSingle()
  if (error) throw databaseError('read session', error)
  if (!data) return null
  const user = data.allowed_users as unknown as AllowedUserRow
  if (!user?.is_active) return null
  void useSupabaseAdmin().from('sessions').update({ last_used_at: now }).eq('id', data.id)
  return { id: data.id as string, expiresAt: data.expires_at as string, user }
}

export const requireAuth = async (event: H3Event) => {
  const session = await getAppSession(event)
  if (!session) throw appError(401, 'UNAUTHENTICATED', 'Authentication is required.')
  return session
}

export const requireRole = async (event: H3Event, roles: readonly Role[]) => {
  const session = await requireAuth(event)
  if (!roles.includes(session.user.role)) throw appError(403, 'FORBIDDEN', 'You do not have permission to perform this action.')
  return session
}

export const revokeSession = async (sessionId: string) => {
  const { error } = await useSupabaseAdmin().from('sessions').update({ revoked_at: new Date().toISOString() }).eq('id', sessionId)
  if (error) throw databaseError('revoke session', error)
}

export const clearWebSessionCookie = (event: H3Event) => deleteCookie(event, sessionCookieName(), { path: '/' })
