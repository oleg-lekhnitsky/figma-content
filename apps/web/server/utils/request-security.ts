import type { H3Event } from 'h3'
import { getHeader, getRequestIP } from 'h3'
import { appError } from './app-error'

const attempts = new Map<string, { count: number, resetAt: number }>()

export const rateLimit = (event: H3Event, key: string, limit: number, windowMs: number) => {
  const id = `${key}:${getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'}`
  const now = Date.now()
  const record = attempts.get(id)
  if (!record || record.resetAt <= now) {
    attempts.set(id, { count: 1, resetAt: now + windowMs })
    return
  }
  record.count += 1
  if (record.count > limit) throw appError(429, 'RATE_LIMITED', 'Too many requests. Please try again later.')
}

export const requireSameOrigin = (event: H3Event) => {
  const origin = getHeader(event, 'origin')
  const expected = new URL(useRuntimeConfig().public.appUrl).origin
  if (!origin || origin !== expected) throw appError(403, 'INVALID_ORIGIN', 'The request origin is not allowed.')
}

export const isBearerAuthorization = (authorization: string | undefined) =>
  authorization?.startsWith('Bearer ') === true && authorization.length > 7

// Bearer credentials are explicitly supplied and are not sent automatically by
// browsers, so they are not exposed to cookie-based cross-site request forgery.
export const requireTrustedMutation = (event: H3Event) => {
  if (isBearerAuthorization(getHeader(event, 'authorization'))) return
  requireSameOrigin(event)
}
