import { boardAssetSchema } from '@content-library/shared'
import { getRouterParam, readValidatedBody } from 'h3'
import { appError, databaseError } from '../../../utils/app-error'
import { requireBoardRole } from '../../../utils/boards'
import { requireTrustedMutation } from '../../../utils/request-security'
import { requireAuth } from '../../../utils/session'

export default defineEventHandler(async (event) => {
  requireTrustedMutation(event)
  const session = await requireAuth(event)
  const id = getRouterParam(event, 'id') ?? ''
  const { collection, role } = await requireBoardRole(id, session.user.organization_id, session.user.id, ['owner', 'editor', 'contributor'], session.user.role)
  if (collection.mode !== 'static') throw appError(409, 'DYNAMIC_BOARD', 'Items are controlled by filters on a dynamic board.')
  const input = await readValidatedBody(event, value => boardAssetSchema.safeParse(value))
  if (!input.success) throw appError(400, 'INVALID_BOARD_ASSET', 'Choose an asset to add.')
  const db = useSupabaseAdmin()
  let query = db.from('assets').select('id,uploaded_by').eq('id', input.data.assetId)
    .eq('organization_id', session.user.organization_id).eq('status', 'approved')
  if (role === 'contributor') query = query.eq('uploaded_by', session.user.id)
  const { data: asset, error: assetError } = await query.maybeSingle()
  if (assetError) throw databaseError('read board asset', assetError)
  if (!asset) throw appError(403, 'BOARD_ASSET_FORBIDDEN', 'Contributors can add only their own approved assets.')
  const { error } = await db.from('public_collection_assets').upsert({
    collection_id: id, asset_id: asset.id, added_by: session.user.id, source: 'manual'
  }, { onConflict: 'collection_id,asset_id' })
  if (error) throw databaseError('add board asset', error)
  return { data: { added: true } }
})
