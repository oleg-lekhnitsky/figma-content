import { publicCollectionFiltersSchema, updatePublicCollectionSchema } from '@content-library/shared'
import { getRouterParam, readBody } from 'h3'
import { appError, databaseError } from '../../utils/app-error'
import { addCollectionMatches, replaceCollectionSnapshot } from '../../utils/public-collections'
import { slugify } from '../../utils/assets'
import { projectBoardLocksAction, requireBoardRole } from '../../utils/boards'
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
    if (collection.source_project_id) {
      if (!['editor', 'admin'].includes(session.user.role)) throw appError(403, 'PROJECT_FORBIDDEN', 'Only workspace editors and admins can rename projects.')
      const { error: projectRenameError } = await db.from('projects').update({
        name: parsed.data.title,
        slug: slugify(parsed.data.title)
      }).eq('id', collection.source_project_id).eq('organization_id', session.user.organization_id)
      if (projectRenameError) throw databaseError('rename linked project', projectRenameError)
      const { data, error: linkedRenameError } = await db.from('public_collections')
        .select('id,title,updated_at').eq('id', id).eq('organization_id', session.user.organization_id).single()
      if (linkedRenameError) throw databaseError('read renamed project board', linkedRenameError)
      return { data: { collection: data } }
    }
    const { data, error: renameError } = await db.from('public_collections').update({ title: parsed.data.title })
      .eq('id', id).eq('organization_id', session.user.organization_id).select('id,title,updated_at').single()
    if (renameError) throw databaseError('rename board', renameError)
    return { data: { collection: data } }
  }
  if (parsed.data.action === 'settings') {
    if (projectBoardLocksAction(collection.source_project_id, 'settings')) throw appError(409, 'PROJECT_BOARD_FILTERS', 'Project board filters are managed by the linked project.')
    const filters = session.user.role === 'contributor'
      ? { ...parsed.data.filters, uploadedBy: session.user.id, uploadedBys: [session.user.id] }
      : parsed.data.filters
    const { data, error: settingsError } = await db.from('public_collections').update({ filters })
      .eq('id', id).eq('organization_id', session.user.organization_id).select('id,filters,updated_at').single()
    if (settingsError) throw databaseError('update board settings', settingsError)
    return { data: { collection: data } }
  }
  if (parsed.data.action === 'apply-filters') {
    if (projectBoardLocksAction(collection.source_project_id, 'apply-filters')) throw appError(409, 'PROJECT_BOARD_FILTERS', 'Project board filters are managed by the linked project.')
    if (collection.purpose !== 'showcase') throw appError(409, 'BOARD_FILTERS_UNAVAILABLE', 'Filters can only populate a standard board.')
    const assetScope = parsed.data.assetScope ?? collection.asset_scope as 'approved' | 'all'
    if (parsed.data.behavior === 'automatic') {
      const { data, error: automaticError } = await db.from('public_collections').update({
        mode: 'dynamic',
        content_strategy: 'dynamic',
        filters: parsed.data.filters,
        asset_scope: assetScope
      }).eq('id', id).eq('organization_id', session.user.organization_id)
        .select('id,mode,content_strategy,filters,asset_scope,updated_at').single()
      if (automaticError) throw databaseError('make board automatic', automaticError)
      return { data: { collection: data, behavior: 'automatic' } }
    }
    if (collection.mode !== 'static') throw appError(409, 'SMART_BOARD_MEMBERSHIP', 'Automatic board membership is controlled by rules.')
    const result = await addCollectionMatches(id, session.user.organization_id, parsed.data.filters, session.user.id, assetScope)
    const { data, error: addError } = await db.from('public_collections').update({
      filters: parsed.data.filters,
      content_strategy: 'manual',
      asset_scope: assetScope
    }).eq('id', id).eq('organization_id', session.user.organization_id)
      .select('id,mode,content_strategy,filters,asset_scope,updated_at').single()
    if (addError) throw databaseError('save board match filters', addError)
    return { data: { collection: data, behavior: 'add', ...result } }
  }
  if (parsed.data.action === 'portfolio-settings') {
    if (collection.purpose !== 'portfolio') throw appError(409, 'NOT_PORTFOLIO', 'This board is not a portfolio edition.')
    const portfolioKind = collection.portfolio_kind as 'main' | 'client' | null
    if (portfolioKind && parsed.data.portfolioKind !== portfolioKind) {
      throw appError(409, 'PORTFOLIO_KIND_LOCKED', 'Create a separate portfolio version instead of changing this one.')
    }
    const persistedKind = portfolioKind ?? parsed.data.portfolioKind
    const { data, error: settingsError } = await db.from('public_collections').update({
      portfolio_kind: persistedKind,
      portfolio_client: persistedKind === 'client' ? parsed.data.portfolioClient : null,
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
  if (parsed.data.action === 'asset-scope') {
    if (collection.purpose === 'review') throw appError(409, 'REVIEW_ASSET_SCOPE', 'Review boards always show liked and draft assets.')
    const { data, error: scopeError } = await db.from('public_collections').update({ asset_scope: parsed.data.assetScope })
      .eq('id', id).eq('organization_id', session.user.organization_id).select('id,asset_scope,updated_at').single()
    if (scopeError) throw databaseError('update board asset scope', scopeError)
    return { data: { collection: data } }
  }
  if (parsed.data.action === 'view-settings') {
    const { data, error: viewError } = await db.from('public_collections').update({ view_settings: parsed.data.viewSettings })
      .eq('id', id).eq('organization_id', session.user.organization_id).select('id,view_settings,updated_at').single()
    if (viewError) throw databaseError('update board view settings', viewError)
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
  const itemCount = await replaceCollectionSnapshot(id, session.user.organization_id, filters, session.user.id, collection.asset_scope as 'approved' | 'all')
  return { data: { refreshed: true, itemCount } }
})
