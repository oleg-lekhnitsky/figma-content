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
  })
  return { data: { assets } }
})
