import { publicCollectionFiltersSchema } from '@content-library/shared'
import { getRouterParam } from 'h3'
import { appError, databaseError } from '../../../utils/app-error'
import { publicAssetsForCollection } from '../../../utils/public-collections'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug') ?? ''
  const now = new Date().toISOString()
  const { data, error } = await useSupabaseAdmin().from('public_collections')
    .select('id,organization_id,title,purpose,portfolio_kind,portfolio_client,introduction,contact_heading,contact_links,mode,layout,filters,expires_at,created_at,updated_at,organizations(name)')
    .eq('slug', slug).eq('publication_enabled', true).or(`expires_at.is.null,expires_at.gt.${now}`).maybeSingle()
  if (error) throw databaseError('read public collection', error)
  if (!data) throw appError(404, 'COLLECTION_NOT_FOUND', 'This collection is unavailable or has expired.')
  const collection = { ...data, mode: data.mode as 'dynamic' | 'static', filters: publicCollectionFiltersSchema.parse(data.filters) }
  const assets = await publicAssetsForCollection(collection)
  let cases: Array<{id:string;title:string;layout:string;assets:unknown[]}> = []
  if (collection.purpose === 'portfolio') {
    const { data: links, error: linksError } = await useSupabaseAdmin().from('portfolio_edition_cases')
      .select('case_id,position,public_collections!portfolio_edition_cases_case_id_fkey(id,title,mode,layout,filters,organization_id)')
      .eq('edition_id', collection.id).order('position')
    if (linksError) throw databaseError('read published portfolio cases', linksError)
    cases = await Promise.all(links.map(async (link: { public_collections: {id:string;title:string;mode:'static';layout:string;filters:unknown;organization_id:string} | null }) => {
      const item = link.public_collections
      if (!item) throw appError(404, 'CASE_NOT_FOUND', 'A portfolio case is unavailable.')
      return { id:item.id, title:item.title, layout:item.layout, assets:await publicAssetsForCollection({ ...item, filters:publicCollectionFiltersSchema.parse(item.filters) }) }
    }))
  }
  return { data: { collection: { title: collection.title, purpose: collection.purpose, portfolioKind: collection.portfolio_kind, portfolioClient: collection.portfolio_client, introduction: collection.introduction, contactHeading:collection.contact_heading, contactLinks:collection.contact_links, mode: collection.mode, layout: collection.layout, expiresAt: collection.expires_at, updatedAt: collection.updated_at, organization: collection.organizations }, assets, cases } }
})
