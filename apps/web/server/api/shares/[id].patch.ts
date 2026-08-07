import { publicCollectionFiltersSchema, updatePublicCollectionSchema } from '@content-library/shared'
import { getRouterParam, readBody } from 'h3'
import { appError, databaseError } from '../../utils/app-error'
import { replaceCollectionSnapshot } from '../../utils/public-collections'
import { requireBoardRole } from '../../utils/boards'
import { requireTrustedMutation } from '../../utils/request-security'
import { requireAuth } from '../../utils/session'

export default defineEventHandler(async (event) => {
  requireTrustedMutation(event)
  const session = await requireAuth(event)
  const id = getRouterParam(event, 'id') ?? ''
  const parsed = updatePublicCollectionSchema.safeParse(await readBody(event))
  if (!parsed.success) throw appError(400, 'INVALID_ACTION', 'Choose a valid collection action.')
  const db = useSupabaseAdmin()
  const { collection } = await requireBoardRole(id, session.user.organization_id, session.user.id, ['owner', 'editor'], session.user.role)
  if (collection.revoked_at) throw appError(404, 'COLLECTION_NOT_FOUND', 'Public collection not found.')
  if (parsed.data.action === 'rename') {
    const { data, error: renameError } = await db.from('public_collections').update({ title: parsed.data.title })
      .eq('id', id).eq('organization_id', session.user.organization_id).select('id,title,updated_at').single()
    if (renameError) throw databaseError('rename board', renameError)
    return { data: { collection: data } }
  }
  if (parsed.data.action === 'settings') {
    const filters = session.user.role === 'contributor'
      ? { ...parsed.data.filters, uploadedBy: session.user.id }
      : parsed.data.filters
    const { data, error: settingsError } = await db.from('public_collections').update({ filters })
      .eq('id', id).eq('organization_id', session.user.organization_id).select('id,filters,updated_at').single()
    if (settingsError) throw databaseError('update board settings', settingsError)
    return { data: { collection: data } }
  }
  if (parsed.data.action === 'revoke') {
    const { error: revokeError } = await db.from('public_collections').update({ revoked_at: new Date().toISOString() }).eq('id', id)
    if (revokeError) throw databaseError('disable public collection', revokeError)
    return { data: { revoked: true } }
  }
  if (collection.mode !== 'static') throw appError(409, 'DYNAMIC_COLLECTION', 'Dynamic collections update automatically.')
  const filters = publicCollectionFiltersSchema.parse(collection.filters)
  const itemCount = await replaceCollectionSnapshot(id, session.user.organization_id, filters, session.user.id)
  return { data: { refreshed: true, itemCount } }
})
