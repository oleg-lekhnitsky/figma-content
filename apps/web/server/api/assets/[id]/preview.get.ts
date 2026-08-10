import { getRouterParam } from 'h3'
import { appError } from '../../../utils/app-error'
import { requireAsset, signedAssetUrl } from '../../../utils/assets'
import { requireAuth } from '../../../utils/session'

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw appError(400, 'INVALID_ASSET_ID', 'Asset ID is required.')
  const asset = await requireAsset(id, session.user.organization_id)
  if (session.user.role === 'viewer' && asset.status !== 'approved') throw appError(404, 'ASSET_NOT_FOUND', 'Asset not found.')
  return { data: { id, url: await signedAssetUrl(asset.image_path) } }
})
