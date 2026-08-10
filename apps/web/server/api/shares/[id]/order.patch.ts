import { boardOrderSchema } from '@content-library/shared'
import { getRouterParam, readValidatedBody } from 'h3'
import { appError, databaseError } from '../../../utils/app-error'
import { requireBoardRole } from '../../../utils/boards'
import { requireTrustedMutation } from '../../../utils/request-security'
import { requireAuth } from '../../../utils/session'
import { matchingApprovedAssetIds } from '../../../utils/public-collections'

export default defineEventHandler(async (event) => {
  requireTrustedMutation(event)
  const session = await requireAuth(event)
  const id = getRouterParam(event, 'id') ?? ''
  const { collection } = await requireBoardRole(id, session.user.organization_id, session.user.id, ['owner', 'editor'], session.user.role)
  const input = await readValidatedBody(event, value => boardOrderSchema.safeParse(value))
  if (!input.success) throw appError(400, 'INVALID_BOARD_ORDER', 'Choose a valid order for every board item.')

  const db = useSupabaseAdmin()
  let currentIds: Set<string>
  if (collection.mode === 'dynamic') {
    currentIds = new Set(await matchingApprovedAssetIds(collection.organization_id, collection.filters))
  } else {
    const { data: current, error: readError } = await db.from('public_collection_assets').select('asset_id').eq('collection_id', id)
    if (readError) throw databaseError('read board order', readError)
    currentIds = new Set(current.map((row: { asset_id: string }) => row.asset_id))
  }
  if (currentIds.size !== input.data.assetIds.length || input.data.assetIds.some(assetId => !currentIds.has(assetId))) {
    throw appError(409, 'STALE_BOARD_ORDER', 'Board content changed. Reload and try again.')
  }

  const updates = await Promise.all(input.data.assetIds.map((assetId, position) => collection.mode === 'dynamic'
    ? db.from('public_collection_assets').upsert({ collection_id: id, asset_id: assetId, added_by: session.user.id, source: 'manual', position }, { onConflict: 'collection_id,asset_id' })
    : db.from('public_collection_assets').update({ position }).eq('collection_id', id).eq('asset_id', assetId)))
  const updateError = updates.find(result => result.error)?.error
  if (updateError) throw databaseError('save board order', updateError)
  return { data: { ordered: true } }
})
