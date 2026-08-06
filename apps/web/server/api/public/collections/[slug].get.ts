import { publicCollectionFiltersSchema } from '@content-library/shared'
import { getRouterParam } from 'h3'
import { appError, databaseError } from '../../../utils/app-error'
import { publicAssetsForCollection } from '../../../utils/public-collections'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug') ?? ''
  const now = new Date().toISOString()
  const { data, error } = await useSupabaseAdmin().from('public_collections')
    .select('id,organization_id,title,mode,filters,expires_at,created_at,updated_at,organizations(name)')
    .eq('slug', slug).is('revoked_at', null).or(`expires_at.is.null,expires_at.gt.${now}`).maybeSingle()
  if (error) throw databaseError('read public collection', error)
  if (!data) throw appError(404, 'COLLECTION_NOT_FOUND', 'This collection is unavailable or has expired.')
  const collection = { ...data, mode: data.mode as 'dynamic' | 'static', filters: publicCollectionFiltersSchema.parse(data.filters) }
  const assets = await publicAssetsForCollection(collection)
  return { data: { collection: { title: collection.title, mode: collection.mode, expiresAt: collection.expires_at, updatedAt: collection.updated_at, organization: collection.organizations }, assets } }
})
