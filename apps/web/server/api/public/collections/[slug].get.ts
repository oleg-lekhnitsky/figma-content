import { boardViewSettingsSchema, publicCollectionFiltersSchema } from '@content-library/shared'
import { getQuery, getRouterParam } from 'h3'
import { appError, databaseError } from '../../../utils/app-error'
import { publicAssetsForCollection } from '../../../utils/public-collections'
import { requireAuth } from '../../../utils/session'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug') ?? ''
  const preview = getQuery(event).preview === 'true'
  const now = new Date().toISOString()
  let query = useSupabaseAdmin().from('public_collections')
    .select('id,organization_id,title,purpose,portfolio_kind,portfolio_client,introduction,contact_heading,contact_links,mode,asset_scope,layout,view_settings,filters,expires_at,created_at,updated_at,organizations(name)')
    .eq('slug', slug)
  if (preview) {
    const session = await requireAuth(event)
    query = query.eq('organization_id', session.user.organization_id)
  } else {
    query = query.eq('publication_enabled', true).or(`expires_at.is.null,expires_at.gt.${now}`)
  }
  const { data, error } = await query.maybeSingle()
  if (error) throw databaseError('read public collection', error)
  if (!data) throw appError(404, 'COLLECTION_NOT_FOUND', preview ? 'This preview is unavailable.' : 'This collection is unavailable or has expired.')
  const collection = { ...data, mode: data.mode as 'dynamic' | 'static', filters: publicCollectionFiltersSchema.parse(data.filters) }
  const assets = await publicAssetsForCollection(collection)
  let cases: Array<{id:string;title:string;description:string|null;layout:string;assets:unknown[]}> = []
  if (collection.purpose === 'portfolio') {
    const { data: links, error: linksError } = await useSupabaseAdmin().from('portfolio_edition_cases')
      .select('case_id,position,display_title,description,public_collections!portfolio_edition_cases_case_id_fkey(id,title,mode,asset_scope,filters,organization_id)')
      .eq('edition_id', collection.id).order('position')
    if (linksError) throw databaseError('read published portfolio cases', linksError)
    cases = await Promise.all(links.map(async (link: { display_title:string|null;description:string|null;public_collections: {id:string;title:string;mode:'dynamic'|'static';asset_scope:'approved'|'all';filters:unknown;organization_id:string} | null }) => {
      const item = link.public_collections
      if (!item) throw appError(404, 'CASE_NOT_FOUND', 'A portfolio case is unavailable.')
      return { id:item.id, title:link.display_title || item.title, description:link.description, layout:collection.layout, viewSettings:boardViewSettingsSchema.parse(collection.view_settings ?? {}), assets:await publicAssetsForCollection({ ...item, filters:publicCollectionFiltersSchema.parse(item.filters) }) }
    }))
  }
  return { data: { collection: { title: collection.title, purpose: collection.purpose, portfolioKind: collection.portfolio_kind, portfolioClient: collection.portfolio_client, introduction: collection.introduction, contactHeading:collection.contact_heading, contactLinks:collection.contact_links, mode: collection.mode, layout: collection.layout, viewSettings:boardViewSettingsSchema.parse(collection.view_settings ?? {}), expiresAt: collection.expires_at, updatedAt: collection.updated_at, organization: collection.organizations }, assets, cases } }
})
