import { publicCollectionFiltersSchema } from '@content-library/shared'
import { getRouterParam } from 'h3'
import { publicAssetsForCollection } from '../../../utils/public-collections'
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
  const assets = await publicAssetsForCollection({
    id: collection.id,
    organization_id: collection.organization_id,
    mode: collection.mode as 'dynamic' | 'static',
    filters: publicCollectionFiltersSchema.parse(collection.filters)
  }, { includeUnapproved: collection.purpose === 'review' })
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
