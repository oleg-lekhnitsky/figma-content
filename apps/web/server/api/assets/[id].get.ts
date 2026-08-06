import { getRouterParam } from 'h3'
import { appError } from '../../utils/app-error'
import { requireAsset, signedAssetUrl } from '../../utils/assets'
import { requireAuth } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw appError(400, 'INVALID_ASSET_ID', 'Asset ID is required.')
  const asset = await requireAsset(id, session.user.organization_id)
  if (session.user.role === 'viewer' && asset.status !== 'approved') throw appError(404, 'ASSET_NOT_FOUND', 'Asset not found.')
  const { data: versions } = await useSupabaseAdmin().from('asset_versions').select('id,version,width,height,file_size,created_at').eq('asset_id', id).order('version', { ascending: false })
  return { data: { asset: { ...asset, previewUrl: await signedAssetUrl(asset.image_path), versions: versions ?? [] } } }
})
