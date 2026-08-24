import { getQuery } from 'h3'
import { assetListQuerySchema } from '@content-library/shared'
import { appError } from '../../utils/app-error'
import { signedAssetUrl } from '../../utils/assets'
import { requireAuth } from '../../utils/session'
import { runSupabaseQuery, useSupabaseAdmin } from '../../utils/supabase'

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  const parsed = assetListQuerySchema.safeParse(getQuery(event))
  if (!parsed.success) throw appError(400, 'INVALID_QUERY', 'Check the filters and try again.', parsed.error.flatten())
  const q = parsed.data
  const from = (q.page - 1) * q.pageSize
  const ordering = {
    newest: ['created_at', false], oldest: ['created_at', true], updated: ['updated_at', false],
    title: ['title', true], dimensions: ['width', false]
  } as const
  const standardSort = q.sort === 'submitter' ? null : ordering[q.sort]
  let taggedAssetIds: string[] | null = null
  const tagIds = q.tagIds?.length ? q.tagIds : q.tagId ? [q.tagId] : []
  if (tagIds.length) {
    const { data: taggedAssets } = await runSupabaseQuery('filter assets by tag', async () => await useSupabaseAdmin().from('asset_tags')
      .select('asset_id').eq('organization_id', session.user.organization_id).in('tag_id', tagIds).limit(1000))
    taggedAssetIds = taggedAssets.map((item: { asset_id: string }) => item.asset_id)
  }
  const buildAssetQuery = () => {
    let query = useSupabaseAdmin().from('assets')
      .select('id,title,description,thumbnail_path,thumbnail_2x_path,image_path,mime_type,width,height,status,figma_url,created_at,updated_at,language,content_type,projects(name),asset_tags(tags(id,name,slug)),allowed_users!assets_uploaded_by_fkey(figma_handle,avatar_url)', { count: 'exact' })
      .eq('organization_id', session.user.organization_id).neq('status', 'archived')
    if (session.user.role === 'viewer') query = query.eq('status', 'approved')
    if (q.mine) query = query.eq('uploaded_by', session.user.id)
    if (q.uploadedBy) query = query.eq('uploaded_by', q.uploadedBy)
    if (q.uploadedBys?.length) query = query.in('uploaded_by', q.uploadedBys)
    if (q.status) query = query.eq('status', q.status)
    if (q.projectId) query = query.eq('project_id', q.projectId)
    if (q.projectIds?.length) query = query.in('project_id', q.projectIds)
    if (taggedAssetIds) query = query.in('id', taggedAssetIds.length ? taggedAssetIds : ['00000000-0000-0000-0000-000000000000'])
    if (q.dateFrom) query = query.gte('created_at', q.dateFrom)
    if (q.dateTo) query = query.lte('created_at', q.dateTo)
    if (q.language) query = query.eq('language', q.language)
    if (q.contentType) query = query.eq('content_type', q.contentType)
    if (q.search) query = query.or(`title.ilike.%${q.search.replace(/[%_,()]/g, '')}%,description.ilike.%${q.search.replace(/[%_,()]/g, '')}%`)
    return standardSort
      ? query.order(standardSort[0], { ascending: standardSort[1] })
      : query.order('allowed_users(figma_handle)', { ascending: true, nullsFirst: false })
  }
  const { data, count } = await runSupabaseQuery('list assets', async () => await buildAssetQuery().range(from, from + q.pageSize - 1))
  let submitters: Array<{ id: string, figma_handle: string | null, avatar_url: string | null }> = []
  if (q.page === 1) {
    const buildSubmitterAssetsQuery = () => {
      let query = useSupabaseAdmin().from('assets')
        .select('uploaded_by').eq('organization_id', session.user.organization_id).neq('status', 'archived')
      if (session.user.role === 'viewer') query = query.eq('status', 'approved')
      if (q.mine) query = query.eq('uploaded_by', session.user.id)
      return query
    }
    const { data: submitterAssets } = await runSupabaseQuery('list asset submitters', async () => await buildSubmitterAssetsQuery())
    const submitterIds = [...new Set(submitterAssets.map((item: { uploaded_by: string }) => item.uploaded_by))]
    if (submitterIds.length) {
      const result = await runSupabaseQuery('load asset submitters', async () => await useSupabaseAdmin().from('allowed_users')
        .select('id,figma_handle,avatar_url').in('id', submitterIds).order('figma_handle'))
      submitters = result.data
    }
  }
  const safeSignedUrl = async (path: string, fallback: string) => {
    try {
      return await signedAssetUrl(path)
    } catch {
      return fallback
    }
  }
  const assets = await Promise.all(data.map(async (asset: { thumbnail_path: string | null, thumbnail_2x_path: string | null, image_path: string, [key: string]: unknown }) => ({
    ...asset,
    previewUrl: await safeSignedUrl(asset.thumbnail_path ?? asset.image_path, `/api/assets/${encodeURIComponent(String(asset.id))}/media?variant=preview`),
    preview2xUrl: asset.thumbnail_2x_path ? await safeSignedUrl(asset.thumbnail_2x_path, `/api/assets/${encodeURIComponent(String(asset.id))}/media?variant=preview2x`) : null,
    originalUrl: await safeSignedUrl(asset.image_path, `/api/assets/${encodeURIComponent(String(asset.id))}/media?variant=original`)
  })))
  return { data: { assets, submitters, total: count ?? 0, page: q.page, pageSize: q.pageSize } }
})
