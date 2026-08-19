import { getQuery, getRouterParam } from 'h3'
import { appError } from '../../../utils/app-error'
import { requireAsset, signedAssetUrl } from '../../../utils/assets'
import { requireAuth } from '../../../utils/session'

const variants = ['preview2x', 'preview', 'original'] as const
type MediaVariant = typeof variants[number]

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw appError(400, 'INVALID_ASSET_ID', 'Asset ID is required.')

  const requestedVariant = String(getQuery(event).variant || 'preview2x')
  if (!variants.includes(requestedVariant as MediaVariant)) {
    throw appError(400, 'INVALID_MEDIA_VARIANT', 'Media variant is invalid.')
  }

  const asset = await requireAsset(id, session.user.organization_id)
  if (session.user.role === 'viewer' && asset.status !== 'approved') {
    throw appError(404, 'ASSET_NOT_FOUND', 'Asset not found.')
  }

  const paths: Record<MediaVariant, string> = {
    preview2x: asset.thumbnail_2x_path || asset.thumbnail_path || asset.image_path,
    preview: asset.thumbnail_path || asset.image_path,
    original: asset.image_path,
  }
  const variant = requestedVariant as MediaVariant
  const upstream = await fetch(await signedAssetUrl(paths[variant]))
  if (!upstream.ok || !upstream.body) {
    throw appError(502, 'MEDIA_FETCH_FAILED', 'Asset media could not be loaded.')
  }

  return new Response(upstream.body, {
    headers: {
      'Content-Type': upstream.headers.get('content-type') || asset.mime_type || 'application/octet-stream',
      'Cache-Control': 'private, max-age=300',
    },
  })
})
