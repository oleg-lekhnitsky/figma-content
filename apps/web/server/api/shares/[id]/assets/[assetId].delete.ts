import { getRouterParam } from 'h3'
import { appError, databaseError } from '../../../../utils/app-error'
import { requireBoardRole } from '../../../../utils/boards'
import { requireTrustedMutation } from '../../../../utils/request-security'
import { requireAuth } from '../../../../utils/session'

export default defineEventHandler(async (event) => {
  requireTrustedMutation(event)
  const session = await requireAuth(event)
  const id = getRouterParam(event, 'id') ?? ''
  const assetId = getRouterParam(event, 'assetId') ?? ''
  const { collection, role } = await requireBoardRole(id, session.user.organization_id, session.user.id, ['owner', 'editor', 'contributor'], session.user.role)
  if (collection.mode !== 'static') throw appError(409, 'DYNAMIC_BOARD', 'Items are controlled by filters on a dynamic board.')
  let query = useSupabaseAdmin().from('public_collection_assets').delete()
    .eq('collection_id', id).eq('asset_id', assetId)
  if (role === 'contributor') query = query.eq('added_by', session.user.id)
  const { error } = await query
  if (error) throw databaseError('remove board asset', error)
  return { data: { removed: true } }
})
