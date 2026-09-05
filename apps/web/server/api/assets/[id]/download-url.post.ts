import { getRouterParam } from 'h3'
import { appError } from '../../../utils/app-error'
import { requireAsset, signedAssetUrl } from '../../../utils/assets'
import { requireAuth } from '../../../utils/session'
import { requireTrustedMutation } from '../../../utils/request-security'

export default defineEventHandler(async (event) => {
  requireTrustedMutation(event)
  const session = await requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw appError(400, 'INVALID_ASSET_ID', 'Asset ID is required.')
  const asset = await requireAsset(id, session.user.organization_id)
  if (session.user.role === 'viewer' && asset.status !== 'approved') throw appError(403, 'FORBIDDEN', 'Only liked assets can be downloaded.')
  return { data: { url: await signedAssetUrl(asset.image_path, 60), expiresIn: 60 } }
})
