import { readBody, setResponseHeader } from 'h3'
import { z } from 'zod'
import { appError } from '../../utils/app-error'
import { requireAuth } from '../../utils/session'
import { rateLimit, requireTrustedMutation } from '../../utils/request-security'
import { isValidMp4 } from '../../utils/upload-validation'

const requestSchema = z.object({
  fileKey: z.string().regex(/^[A-Za-z0-9_-]{8,128}$/),
  videoHash: z.string().regex(/^[a-f0-9]{40}$/i)
})

const allowedVideoHosts = new Set([
  'www.figma.com',
  's3-figma-videos-production-sig.figma.com',
  's3-videos-eu-production-sig.figma.com',
  's3-videos-au-production-sig.figma.com'
])

export default defineEventHandler(async (event) => {
  rateLimit(event, 'figma-video-download', 30, 60_000)
  requireTrustedMutation(event)
  await requireAuth(event)
  const parsed = requestSchema.safeParse(await readBody(event))
  if (!parsed.success) throw appError(400, 'INVALID_VIDEO_REFERENCE', 'The Figma video reference is invalid.')

  const { fileKey, videoHash } = parsed.data
  const resolver = await fetch(`https://www.figma.com/api/files/${encodeURIComponent(fileKey)}/videos/${encodeURIComponent(videoHash)}`)
  if (!resolver.ok) throw appError(502, 'FIGMA_VIDEO_UNAVAILABLE', 'Figma could not resolve the embedded video file.')
  const payload = await resolver.json().catch(() => null) as { meta?: { signed_url?: unknown } } | null
  let sourceUrl: URL
  try { sourceUrl = new URL(String(payload?.meta?.signed_url)) }
  catch { throw appError(502, 'FIGMA_VIDEO_UNAVAILABLE', 'Figma returned an invalid video download path.') }
  if (sourceUrl.protocol !== 'https:' || !allowedVideoHosts.has(sourceUrl.hostname)) {
    throw appError(502, 'FIGMA_VIDEO_UNAVAILABLE', 'Figma returned an invalid video download path.')
  }

  const source = await fetch(sourceUrl, { signal: AbortSignal.timeout(120_000) })
  if (!source.ok) throw appError(502, 'FIGMA_VIDEO_UNAVAILABLE', 'Figma could not download the embedded video file.')
  const mimeType = source.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase()
  if (mimeType !== 'video/mp4') throw appError(415, 'INVALID_VIDEO', 'The embedded Figma video is not an MP4 file.')
  const declaredBytes = Number(source.headers.get('content-length'))
  const maxBytes = Number(useRuntimeConfig().maxUploadBytes)
  if (Number.isFinite(declaredBytes) && declaredBytes > maxBytes) throw appError(413, 'FILE_TOO_LARGE', `Choose a video smaller than ${Math.floor(maxBytes / 1_048_576)} MB.`)
  const bytes = new Uint8Array(await source.arrayBuffer())
  if (bytes.byteLength > maxBytes) throw appError(413, 'FILE_TOO_LARGE', `Choose a video smaller than ${Math.floor(maxBytes / 1_048_576)} MB.`)
  if (!isValidMp4(bytes)) throw appError(415, 'INVALID_VIDEO', 'The embedded Figma video is not a valid MP4 file.')

  setResponseHeader(event, 'Content-Type', 'video/mp4')
  setResponseHeader(event, 'Content-Length', bytes.byteLength)
  setResponseHeader(event, 'Content-Disposition', `attachment; filename="${videoHash}.mp4"`)
  return Buffer.from(bytes)
})
