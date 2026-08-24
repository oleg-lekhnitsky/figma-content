import type { PublicCollectionFilters } from '@content-library/shared'
import { databaseError } from './app-error'
import { signedAssetUrl } from './assets'

const cleanSearch = (value: string) => value.replace(/[%_,()]/g, '')

export const matchingApprovedAssetIds = async (organizationId: string, filters: PublicCollectionFilters) => {
  let taggedIds: string[] | null = null
  const tagIds = filters.tagIds.length ? filters.tagIds : filters.tagId ? [filters.tagId] : []
  if (tagIds.length) {
    const { data, error } = await useSupabaseAdmin().from('asset_tags')
      .select('asset_id').eq('organization_id', organizationId).in('tag_id', tagIds).limit(1000)
    if (error) throw databaseError('filter shared assets by tag', error)
    const matchingTagIds: string[] = data.map((item: { asset_id: string }) => item.asset_id)
    if (!matchingTagIds.length) return []
    taggedIds = matchingTagIds
  }

  let query = useSupabaseAdmin().from('assets').select('id')
    .eq('organization_id', organizationId).eq('status', 'approved')
  if (filters.projectId) query = query.eq('project_id', filters.projectId)
  if (filters.projectIds.length) query = query.in('project_id', filters.projectIds)
  if (filters.uploadedBy) query = query.eq('uploaded_by', filters.uploadedBy)
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

const applyDynamicBoardOrder = async (collectionId: string, newestIds: string[]) => {
  if (!newestIds.length) return newestIds
  const { data, error } = await useSupabaseAdmin().from('public_collection_assets')
    .select('asset_id,position').eq('collection_id', collectionId).in('asset_id', newestIds)
    .not('position', 'is', null).order('position', { ascending: true })
  if (error) throw databaseError('read dynamic board order', error)
  const positionedIds = data.map((item: { asset_id: string }) => item.asset_id)
  const positioned = new Set(positionedIds)
  return [...newestIds.filter(assetId => !positioned.has(assetId)), ...positionedIds]
}

export const replaceCollectionSnapshot = async (collectionId: string, organizationId: string, filters: PublicCollectionFilters, addedBy?: string) => {
  const ids: string[] = await matchingApprovedAssetIds(organizationId, filters)
  const db = useSupabaseAdmin()
  const { error: deleteError } = await db.from('public_collection_assets').delete().eq('collection_id', collectionId)
  if (deleteError) throw databaseError('clear collection snapshot', deleteError)
  if (ids.length) {
    const { error } = await db.from('public_collection_assets').upsert(ids.map((assetId, position) => ({ collection_id: collectionId, asset_id: assetId, added_by: addedBy ?? null, source: 'snapshot', position })), { onConflict: 'collection_id,asset_id', ignoreDuplicates: true })
    if (error) throw databaseError('save collection snapshot', error)
  }
  const { error: strategyError } = await db.from('public_collections').update({ content_strategy: 'snapshot' }).eq('id', collectionId).eq('organization_id', organizationId)
  if (strategyError) throw databaseError('save collection content strategy', strategyError)
  return ids.length
}

export const boardPreviewForCollection = async (collection: {
  id: string
  organization_id: string
  purpose: 'showcase' | 'review' | 'portfolio' | 'case'
  mode: 'dynamic' | 'static'
  filters: PublicCollectionFilters
}) => {
  let ids: string[]
  if (collection.mode === 'dynamic') {
    ids = await applyDynamicBoardOrder(collection.id, await matchingApprovedAssetIds(collection.organization_id, collection.filters))
  } else {
    const { data, error } = await useSupabaseAdmin().from('public_collection_assets')
      .select('asset_id').eq('collection_id', collection.id).order('position', { ascending: true, nullsFirst: false }).limit(500)
    if (error) throw databaseError('read board preview assets', error)
    ids = data.map((item: { asset_id: string }) => item.asset_id)
  }
  if (!ids.length) return { itemCount: 0, assetIds: [], previewAssets: [] }

  const previewIds = ids.slice(0, 4)
  let query = useSupabaseAdmin().from('assets')
    .select('id,title,thumbnail_path,image_path,mime_type,width,height', { count: 'exact' })
    .eq('organization_id', collection.organization_id).in('id', previewIds)
  query = collection.purpose === 'review' ? query.neq('status', 'archived') : query.eq('status', 'approved')
  const { data, count, error } = await query.order('created_at', { ascending: false }).limit(4)
  if (error) throw databaseError('load board preview assets', error)
  const previewAssets = await Promise.all(data.map(async (asset: { id: string; title: string; thumbnail_path: string | null; image_path: string; mime_type: string; width: number; height: number }) => ({
    id: asset.id,
    title: asset.title,
    width: asset.width,
    height: asset.height,
    mime_type: asset.mime_type,
    previewUrl: await signedAssetUrl(asset.thumbnail_path ?? asset.image_path, 3600)
  })))
  const position = new Map(previewIds.map((assetId, index) => [assetId, index]))
  previewAssets.sort((a, b) => (position.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (position.get(b.id) ?? Number.MAX_SAFE_INTEGER))
  return { itemCount: ids.length || count || 0, assetIds: ids, previewAssets }
}

export const publicAssetsForCollection = async (
  collection: { id: string; organization_id: string; mode: 'dynamic' | 'static'; filters: PublicCollectionFilters },
  options: { includeUnapproved?: boolean } = {}
) => {
  let ids: string[]
  if (collection.mode === 'dynamic') {
    ids = await applyDynamicBoardOrder(collection.id, await matchingApprovedAssetIds(collection.organization_id, collection.filters))
  } else {
    const { data, error } = await useSupabaseAdmin().from('public_collection_assets')
      .select('asset_id').eq('collection_id', collection.id).order('position', { ascending: true, nullsFirst: false }).limit(500)
    if (error) throw databaseError('read collection snapshot', error)
    ids = data.map((item: { asset_id: string }) => item.asset_id)
  }
  if (!ids.length) return []
  const selection = options.includeUnapproved
    ? 'id,title,description,thumbnail_path,thumbnail_2x_path,image_path,mime_type,width,height,status,figma_url,uploaded_by,created_at,projects(name),asset_tags(tags(name)),allowed_users!assets_uploaded_by_fkey(email,figma_handle,avatar_url)'
    : 'id,title,description,thumbnail_path,thumbnail_2x_path,image_path,mime_type,width,height,status,figma_url,created_at,projects(name),asset_tags(tags(name))'
  let query = useSupabaseAdmin().from('assets')
    .select(selection)
    .eq('organization_id', collection.organization_id).in('id', ids)
  query = options.includeUnapproved ? query.neq('status', 'archived') : query.eq('status', 'approved')
  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) throw databaseError('load public collection assets', error)
  const signedAssets = await Promise.all(data.map(async (asset: { thumbnail_path: string | null; thumbnail_2x_path: string | null; image_path: string; [key: string]: unknown }) => ({
    ...asset,
    previewUrl: await signedAssetUrl(asset.thumbnail_path ?? asset.image_path, 3600),
    preview2xUrl: asset.thumbnail_2x_path ? await signedAssetUrl(asset.thumbnail_2x_path, 3600) : null,
    originalUrl: await signedAssetUrl(asset.image_path, 3600)
  })))
  const position = new Map(ids.map((id, index) => [id, index]))
  signedAssets.sort((a, b) => (position.get(String(a.id)) ?? Number.MAX_SAFE_INTEGER) - (position.get(String(b.id)) ?? Number.MAX_SAFE_INTEGER))
  return signedAssets
}
