import { boardAssetScopeSchema, publicCollectionFiltersSchema } from '@content-library/shared'
import { getRouterParam, readValidatedBody } from 'h3'
import { appError, databaseError } from '../../../utils/app-error'
import { requireBoardRole } from '../../../utils/boards'
import { matchingAssetIds } from '../../../utils/public-collections'
import { requireTrustedMutation } from '../../../utils/request-security'
import { requireAuth } from '../../../utils/session'

export default defineEventHandler(async (event) => {
  requireTrustedMutation(event)
  const session = await requireAuth(event)
  const id = getRouterParam(event, 'id') ?? ''
  const { collection } = await requireBoardRole(id, session.user.organization_id, session.user.id, ['owner', 'editor'], session.user.role)
  if (collection.purpose !== 'showcase') throw appError(409, 'BOARD_FILTERS_UNAVAILABLE', 'Filters can only populate a standard board.')
  const input = await readValidatedBody(event, value => publicCollectionFiltersSchema.extend({ assetScope: boardAssetScopeSchema.optional() }).safeParse(value))
  if (!input.success) throw appError(400, 'INVALID_BOARD_FILTERS', 'Check the filters and try again.', input.error.flatten())
  const { assetScope: requestedAssetScope, ...filters } = input.data
  const assetScope = requestedAssetScope ?? collection.asset_scope as 'approved' | 'all'
  const ids: string[] = await matchingAssetIds(session.user.organization_id, filters, assetScope)
  let previews: Array<{ id: string; title: string; previewUrl: string; mime_type: string; width: number; height: number }> = []
  if (ids.length) {
    const chunks = Array.from({ length: Math.ceil(ids.length / 100) }, (_, index) => ids.slice(index * 100, (index + 1) * 100))
    const rows = await Promise.all(chunks.map(async (chunk) => {
      let query = useSupabaseAdmin().from('assets')
        .select('id,title,mime_type,width,height')
        .eq('organization_id', session.user.organization_id)
        .in('id', chunk)
      query = assetScope === 'all' ? query.neq('status', 'archived') : query.eq('status', 'approved')
      const { data, error } = await query
      if (error) throw databaseError('load matching asset previews', error)
      return data as Array<{ id: string; title: string; mime_type: string; width: number; height: number }>
    }))
    const positions = new Map<string, number>(ids.map((assetId: string, index: number): [string, number] => [assetId, index]))
    previews = rows.flat().map(asset => ({
      ...asset,
      previewUrl: `/api/assets/${encodeURIComponent(asset.id)}/media?variant=preview`
    }))
    previews.sort((a, b) => (positions.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (positions.get(b.id) ?? Number.MAX_SAFE_INTEGER))
  }
  return { data: { count: ids.length, previews } }
})
