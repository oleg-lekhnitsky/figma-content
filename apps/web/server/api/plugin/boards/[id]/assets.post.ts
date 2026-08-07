import { boardAssetSchema } from '@content-library/shared'
import { getRouterParam, readValidatedBody } from 'h3'
import { appError, databaseError } from '../../../../utils/app-error'
import { requireBoardRole } from '../../../../utils/boards'
import { requireTrustedMutation } from '../../../../utils/request-security'
import { requireAuth } from '../../../../utils/session'

export default defineEventHandler(async (event) => {
  requireTrustedMutation(event)
  const session = await requireAuth(event)
  const id = getRouterParam(event, 'id') ?? ''
  const { collection, role } = await requireBoardRole(
    id,
    session.user.organization_id,
    session.user.id,
    ['owner', 'editor', 'contributor'],
    session.user.role
  )
  if (collection.purpose !== 'review' || collection.mode !== 'static') {
    throw appError(409, 'NOT_REVIEW_BOARD', 'Choose a monthly review board.')
  }
  const input = await readValidatedBody(event, value => boardAssetSchema.safeParse(value))
  if (!input.success) throw appError(400, 'INVALID_BOARD_ASSET', 'Choose an asset to submit.')

  const db = useSupabaseAdmin()
  let query = db.from('assets').select('id,uploaded_by')
    .eq('id', input.data.assetId)
    .eq('organization_id', session.user.organization_id)
    .neq('status', 'archived')
  if (role === 'contributor') query = query.eq('uploaded_by', session.user.id)
  const { data: asset, error: assetError } = await query.maybeSingle()
  if (assetError) throw databaseError('read review submission', assetError)
  if (!asset) throw appError(403, 'REVIEW_ASSET_FORBIDDEN', 'You can submit only your own work to this review.')

  const { error } = await db.from('public_collection_assets').upsert({
    collection_id: id,
    asset_id: asset.id,
    added_by: session.user.id,
    source: 'manual',
    review_status: 'ready',
    reviewed_at: null,
    reviewed_by: null
  }, { onConflict: 'collection_id,asset_id' })
  if (error) throw databaseError('submit asset to review board', error)
  return { data: { submitted: true } }
})
