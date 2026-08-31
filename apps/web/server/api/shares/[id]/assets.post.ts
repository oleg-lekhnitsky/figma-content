import { boardAssetSchema } from '@content-library/shared'
import { getRouterParam, readValidatedBody } from 'h3'
import { appError, databaseError } from '../../../utils/app-error'
import { requireBoardRole } from '../../../utils/boards'
import { requireTrustedMutation } from '../../../utils/request-security'
import { requireAuth } from '../../../utils/session'
import { writeAuditLog } from '../../../utils/audit'

export default defineEventHandler(async (event) => {
  requireTrustedMutation(event)
  const session = await requireAuth(event)
  const id = getRouterParam(event, 'id') ?? ''
  const { collection, role } = await requireBoardRole(id, session.user.organization_id, session.user.id, ['owner', 'editor', 'contributor'], session.user.role)
  if (collection.mode !== 'static') throw appError(409, 'DYNAMIC_BOARD', 'Assets are controlled by rules on a Smart board.')
  const input = await readValidatedBody(event, value => boardAssetSchema.safeParse(value))
  if (!input.success) throw appError(400, 'INVALID_BOARD_ASSET', 'Choose an asset to add.')
  const db = useSupabaseAdmin()
  let query = db.from('assets').select('id,uploaded_by,status').eq('id', input.data.assetId)
    .eq('organization_id', session.user.organization_id)
    .neq('status', 'archived')
  if (role === 'contributor') query = query.eq('uploaded_by', session.user.id)
  const { data: asset, error: assetError } = await query.maybeSingle()
  if (assetError) throw databaseError('read board asset', assetError)
  if (!asset) throw appError(403, 'BOARD_ASSET_FORBIDDEN', 'Contributors can add only their own approved assets.')
  const canApprove = ['editor', 'admin'].includes(session.user.role)
  if (asset.status !== 'approved' && !canApprove) throw appError(403, 'BOARD_ASSET_NOT_APPROVED', 'Approve this asset before adding it to a board.')
  if (asset.status !== 'approved') {
    const { error: approvalError } = await db.from('assets').update({ status: 'approved' })
      .eq('id', asset.id).eq('organization_id', session.user.organization_id)
    if (approvalError) throw databaseError('approve board asset', approvalError)
    await writeAuditLog(session.user.organization_id, session.user.id, 'approve', 'asset', asset.id, { source: 'board-add' })
  }
  const { data: lastItem } = await db.from('public_collection_assets').select('position').eq('collection_id', id)
    .order('position', { ascending: false, nullsFirst: false }).limit(1).maybeSingle()
  const { error } = await db.from('public_collection_assets').upsert({
    collection_id: id, asset_id: asset.id, added_by: session.user.id, source: 'manual', position: (lastItem?.position ?? -1) + 1,
    ...(collection.purpose === 'review' ? { review_status: 'ready', reviewed_at: null, reviewed_by: null } : {})
  }, { onConflict: 'collection_id,asset_id' })
  if (error) throw databaseError('add board asset', error)
  const { error: strategyError } = await db.from('public_collections').update({ content_strategy: 'manual' }).eq('id', id).eq('organization_id', session.user.organization_id)
  if (strategyError) throw databaseError('update board content strategy', strategyError)
  return { data: { added: true, approved: asset.status !== 'approved' } }
})
