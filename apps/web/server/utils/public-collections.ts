import type { PublicCollectionFilters } from '@content-library/shared'
import { databaseError } from './app-error'
import { signedAssetUrl } from './assets'

const cleanSearch = (value: string) => value.replace(/[%_,()]/g, '')

export const matchingApprovedAssetIds = async (organizationId: string, filters: PublicCollectionFilters) => {
  let taggedIds: string[] | null = null
  if (filters.tagId) {
    const { data, error } = await useSupabaseAdmin().from('asset_tags')
      .select('asset_id').eq('organization_id', organizationId).eq('tag_id', filters.tagId).limit(1000)
    if (error) throw databaseError('filter shared assets by tag', error)
    const matchingTagIds: string[] = data.map((item: { asset_id: string }) => item.asset_id)
    if (!matchingTagIds.length) return []
    taggedIds = matchingTagIds
  }

  let query = useSupabaseAdmin().from('assets').select('id')
    .eq('organization_id', organizationId).eq('status', 'approved')
  if (filters.projectId) query = query.eq('project_id', filters.projectId)
  if (filters.dateFrom) query = query.gte('created_at', filters.dateFrom)
  if (filters.dateTo) query = query.lte('created_at', filters.dateTo)
  if (filters.search) {
    const search = cleanSearch(filters.search)
    query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`)
  }
  if (taggedIds) query = query.in('id', taggedIds)
  const { data, error } = await query.order('created_at', { ascending: false }).limit(500)
  if (error) throw databaseError('match shared assets', error)
  return data.map((item: { id: string }) => item.id)
}

export const replaceCollectionSnapshot = async (collectionId: string, organizationId: string, filters: PublicCollectionFilters) => {
  const ids: string[] = await matchingApprovedAssetIds(organizationId, filters)
  const db = useSupabaseAdmin()
  const { error: deleteError } = await db.from('public_collection_assets').delete().eq('collection_id', collectionId)
  if (deleteError) throw databaseError('clear collection snapshot', deleteError)
  if (ids.length) {
    const { error } = await db.from('public_collection_assets').insert(ids.map(assetId => ({ collection_id: collectionId, asset_id: assetId })))
    if (error) throw databaseError('save collection snapshot', error)
  }
  return ids.length
}

export const publicAssetsForCollection = async (collection: { id: string; organization_id: string; mode: 'dynamic' | 'static'; filters: PublicCollectionFilters }) => {
  let ids: string[]
  if (collection.mode === 'dynamic') {
    ids = await matchingApprovedAssetIds(collection.organization_id, collection.filters)
  } else {
    const { data, error } = await useSupabaseAdmin().from('public_collection_assets')
      .select('asset_id').eq('collection_id', collection.id).limit(500)
    if (error) throw databaseError('read collection snapshot', error)
    ids = data.map((item: { asset_id: string }) => item.asset_id)
  }
  if (!ids.length) return []
  const { data, error } = await useSupabaseAdmin().from('assets')
    .select('id,title,description,thumbnail_path,thumbnail_2x_path,image_path,width,height,created_at,projects(name),asset_tags(tags(name))')
    .eq('organization_id', collection.organization_id).eq('status', 'approved').in('id', ids)
    .order('created_at', { ascending: false })
  if (error) throw databaseError('load public collection assets', error)
  return await Promise.all(data.map(async (asset: { thumbnail_path: string | null; thumbnail_2x_path: string | null; image_path: string; [key: string]: unknown }) => ({
    ...asset,
    previewUrl: await signedAssetUrl(asset.thumbnail_path ?? asset.image_path, 3600),
    preview2xUrl: asset.thumbnail_2x_path ? await signedAssetUrl(asset.thumbnail_2x_path, 3600) : null
  })))
}
