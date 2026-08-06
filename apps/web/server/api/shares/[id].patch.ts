import { publicCollectionFiltersSchema, updatePublicCollectionSchema } from '@content-library/shared'
import { getRouterParam, readBody } from 'h3'
import { appError, databaseError } from '../../utils/app-error'
import { replaceCollectionSnapshot } from '../../utils/public-collections'
import { requireRole } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const session = await requireRole(event, ['editor', 'admin'])
  const id = getRouterParam(event, 'id') ?? ''
  const parsed = updatePublicCollectionSchema.safeParse(await readBody(event))
  if (!parsed.success) throw appError(400, 'INVALID_ACTION', 'Choose a valid collection action.')
  const db = useSupabaseAdmin()
  const { data: collection, error } = await db.from('public_collections')
    .select('id,mode,filters').eq('id', id).eq('organization_id', session.user.organization_id).is('revoked_at', null).maybeSingle()
  if (error) throw databaseError('read public collection', error)
  if (!collection) throw appError(404, 'COLLECTION_NOT_FOUND', 'Public collection not found.')
  if (parsed.data.action === 'revoke') {
    const { error: revokeError } = await db.from('public_collections').update({ revoked_at: new Date().toISOString() }).eq('id', id)
    if (revokeError) throw databaseError('disable public collection', revokeError)
    return { data: { revoked: true } }
  }
  if (collection.mode !== 'static') throw appError(409, 'DYNAMIC_COLLECTION', 'Dynamic collections update automatically.')
  const filters = publicCollectionFiltersSchema.parse(collection.filters)
  const itemCount = await replaceCollectionSnapshot(id, session.user.organization_id, filters)
  return { data: { refreshed: true, itemCount } }
})
