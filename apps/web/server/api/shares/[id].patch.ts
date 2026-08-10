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
  if (parsed.data.action === 'portfolio-settings') {
    if (collection.purpose !== 'portfolio') throw appError(409, 'NOT_PORTFOLIO', 'This board is not a portfolio edition.')
    const { data, error: settingsError } = await db.from('public_collections').update({
      portfolio_kind: parsed.data.portfolioKind,
      portfolio_client: parsed.data.portfolioKind === 'client' ? parsed.data.portfolioClient : null,
      introduction: parsed.data.introduction,
      contact_heading: parsed.data.contactHeading,
      contact_links: parsed.data.contactLinks
    }).eq('id', id).eq('organization_id', session.user.organization_id)
      .select('id,portfolio_kind,portfolio_client,introduction,contact_heading,contact_links,updated_at').single()
    if (settingsError) throw databaseError('update portfolio settings', settingsError)
    return { data: { collection: data } }
  }
  if (parsed.data.action === 'layout') {
    const { data, error: layoutError } = await db.from('public_collections').update({ layout: parsed.data.layout })
      .eq('id', id).eq('organization_id', session.user.organization_id).select('id,layout,updated_at').single()
    if (layoutError) throw databaseError('update board layout', layoutError)
    return { data: { collection: data } }
  }
  if (parsed.data.action === 'revoke') {
    const { error: revokeError } = await db.from('public_collections').update({ publication_enabled: false, revoked_at: new Date().toISOString() }).eq('id', id)
    if (revokeError) throw databaseError('disable public collection', revokeError)
    return { data: { revoked: true } }
  }
  if (parsed.data.action === 'publish') {
    const { error: publishError } = await db.from('public_collections').update({ publication_enabled: true, revoked_at: null }).eq('id', id)
    if (publishError) throw databaseError('publish board', publishError)
    return { data: { published: true } }
  }
  if (collection.mode !== 'static') throw appError(409, 'DYNAMIC_COLLECTION', 'Dynamic collections update automatically.')
  const filters = publicCollectionFiltersSchema.parse(collection.filters)
  const itemCount = await replaceCollectionSnapshot(id, session.user.organization_id, filters, session.user.id)
  return { data: { refreshed: true, itemCount } }
})
