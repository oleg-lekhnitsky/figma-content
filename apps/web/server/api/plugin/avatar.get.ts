import { appError } from '../../utils/app-error'
import { requireAuth } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  if (!session.user.avatar_url) throw appError(404, 'AVATAR_NOT_FOUND', 'This account does not have an avatar.')

  let sourceUrl: URL
  try { sourceUrl = new URL(session.user.avatar_url) }
  catch { throw appError(502, 'AVATAR_UNAVAILABLE', 'The account avatar URL is invalid.') }
  if (sourceUrl.protocol !== 'https:' || (sourceUrl.hostname !== 'figma.com' && !sourceUrl.hostname.endsWith('.figma.com'))) {
    throw appError(502, 'AVATAR_UNAVAILABLE', 'The account avatar host is not supported.')
  }

  const source = await fetch(sourceUrl, { signal: AbortSignal.timeout(10_000) }).catch(() => null)
  if (!source?.ok) throw appError(502, 'AVATAR_UNAVAILABLE', 'The account avatar could not be downloaded.')
  const contentType = source.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase()
  if (!contentType?.startsWith('image/')) throw appError(502, 'AVATAR_UNAVAILABLE', 'The account avatar is not an image.')
  const bytes = await source.arrayBuffer()
  if (!bytes.byteLength || bytes.byteLength > 5_000_000) throw appError(502, 'AVATAR_UNAVAILABLE', 'The account avatar is invalid.')

  return new Response(bytes, { headers: {
    'Content-Type': contentType,
    'Cache-Control': 'private, max-age=3600'
  } })
})
