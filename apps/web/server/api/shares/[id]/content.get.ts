import { publicCollectionFiltersSchema } from '@content-library/shared'
import { getRouterParam } from 'h3'
import { publicAssetsForCollection } from '../../../utils/public-collections'
import { databaseError } from '../../../utils/app-error'
import { requireBoardRole } from '../../../utils/boards'
import { requireAuth } from '../../../utils/session'

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  const id = getRouterParam(event, 'id') ?? ''
  const { collection } = await requireBoardRole(
    id,
    session.user.organization_id,
    session.user.id,
    ['owner', 'editor', 'contributor', 'viewer'],
    session.user.role
  )
  if (collection.purpose === 'portfolio') {
    const { data: links, error } = await useSupabaseAdmin().from('portfolio_edition_cases')
      .select('public_collections!portfolio_edition_cases_case_id_fkey(id,organization_id,mode,filters,asset_scope)')
      .eq('edition_id', id)
      .eq('organization_id', session.user.organization_id)
      .order('position')
    if (error) throw databaseError('read portfolio boards', error)
    const boardAssets = await Promise.all(links.map(async (link: {
      public_collections: { id: string; organization_id: string; mode: 'dynamic' | 'static'; filters: unknown; asset_scope: 'approved' | 'all' } | null
    }) => {
      const board = link.public_collections
      if (!board) return []
      return publicAssetsForCollection({
        ...board,
        filters: publicCollectionFiltersSchema.parse(board.filters)
      })
    }))
    const uniqueAssets = new Map<string, Record<string, unknown>>()
    for (const assets of boardAssets) {
      for (const asset of assets as Array<{ id: string; [key: string]: unknown }>) {
        if (!uniqueAssets.has(asset.id)) uniqueAssets.set(asset.id, asset)
      }
    }
    return { data: { assets: [...uniqueAssets.values()] } }
  }
  const assets = await publicAssetsForCollection({
    id: collection.id,
    organization_id: collection.organization_id,
    mode: collection.mode as 'dynamic' | 'static',
    asset_scope: collection.asset_scope as 'approved' | 'all',
    filters: publicCollectionFiltersSchema.parse(collection.filters)
  }, {
    includeUnapproved: collection.purpose === 'review',
    includeContributorDetails: collection.purpose === 'review' || collection.asset_scope === 'all'
  })
  if (collection.purpose !== 'review' || !assets.length) return { data: { assets } }
  const { data: submissions, error } = await useSupabaseAdmin().from('public_collection_assets')
    .select('asset_id,review_status,created_at,reviewed_at')
    .eq('collection_id', id)
    .in('asset_id', assets.map((asset: { id: string }) => asset.id))
  if (error) throw createError({ statusCode: 500, statusMessage: 'Unable to load review status.' })
  const submissionByAsset = new Map(submissions.map((submission: { asset_id: string; [key: string]: unknown }) => [submission.asset_id, submission]))
  return {
    data: {
      assets: assets.map((asset: { id: string; [key: string]: unknown }) => ({
        ...asset,
        submission: submissionByAsset.get(asset.id) ?? null
      }))
    }
  }
})
