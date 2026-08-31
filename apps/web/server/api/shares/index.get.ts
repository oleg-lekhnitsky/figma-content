import { publicCollectionFiltersSchema } from '@content-library/shared'
import { databaseError } from '../../utils/app-error'
import { boardPreviewForCollection } from '../../utils/public-collections'
import { requireAuth } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  const includePreviews = getQuery(event).previews !== 'false'
  const { data: memberships, error: membershipError } = await useSupabaseAdmin().from('public_collection_members')
    .select('collection_id,role').eq('organization_id', session.user.organization_id).eq('user_id', session.user.id)
  if (membershipError) throw databaseError('list board memberships', membershipError)
  const roles = new Map(memberships.map((membership: { collection_id: string; role: string }) => [membership.collection_id, membership.role]))
  let query = useSupabaseAdmin().from('public_collections')
    .select('id,slug,title,purpose,portfolio_kind,portfolio_client,introduction,contact_heading,contact_links,review_month,submission_deadline,mode,filters,expires_at,revoked_at,publication_enabled,content_strategy,layout,view_settings,source_project_id,source_project:projects!public_collections_source_project_id_fkey(archived_at),created_at,updated_at')
    .eq('organization_id', session.user.organization_id)
  if (session.user.role !== 'admin') {
    const memberBoardIds = [...roles.keys()]
    query = memberBoardIds.length
      ? query.or(`purpose.neq.review,id.in.(${memberBoardIds.join(',')})`)
      : query.neq('purpose', 'review')
  }
  const { data, error } = await query.order('created_at', { ascending: false }).limit(50)
  if (error) throw databaseError('list public collections', error)
  const activeCollections = data.filter((collection: { source_project_id: string | null; source_project: { archived_at: string | null } | null }) => (
    !collection.source_project_id || !collection.source_project?.archived_at
  ))
  const collections = await Promise.all(activeCollections.map(async (collection: { id: string; organization_id?: string; purpose: 'showcase' | 'review' | 'portfolio' | 'case'; mode: 'dynamic' | 'static'; filters: unknown; [key: string]: unknown }) => ({
    ...collection,
    role: session.user.role === 'admin' ? 'admin' : roles.get(collection.id) ?? 'viewer',
    ...await boardPreviewForCollection({
      id: collection.id,
      organization_id: session.user.organization_id,
      purpose: collection.purpose,
      mode: collection.mode,
      filters: publicCollectionFiltersSchema.parse(collection.filters)
    }, { includePreviews })
  })))
  return { data: { collections } }
})
