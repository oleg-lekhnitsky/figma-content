import { publicCollectionFiltersSchema } from '@content-library/shared'
import { databaseError } from '../../utils/app-error'
import { boardPreviewForCollection } from '../../utils/public-collections'
import { requireAuth } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  const { data: memberships, error: membershipError } = await useSupabaseAdmin().from('public_collection_members')
    .select('collection_id,role').eq('organization_id', session.user.organization_id).eq('user_id', session.user.id)
  if (membershipError) throw databaseError('list board memberships', membershipError)
  const roles = new Map(memberships.map((membership: { collection_id: string; role: string }) => [membership.collection_id, membership.role]))
  if (!memberships.length && session.user.role !== 'admin') return { data: { collections: [] } }
  let query = useSupabaseAdmin().from('public_collections')
    .select('id,slug,title,purpose,review_month,submission_deadline,mode,filters,expires_at,revoked_at,publication_enabled,content_strategy,layout,created_at,updated_at')
    .eq('organization_id', session.user.organization_id)
  if (session.user.role !== 'admin') query = query.in('id', [...roles.keys()])
  const { data, error } = await query.order('created_at', { ascending: false }).limit(50)
  if (error) throw databaseError('list public collections', error)
  const collections = await Promise.all(data.map(async (collection: { id: string; organization_id?: string; purpose: 'showcase' | 'review'; mode: 'dynamic' | 'static'; filters: unknown; [key: string]: unknown }) => ({
    ...collection,
    role: roles.get(collection.id) ?? 'admin',
    ...await boardPreviewForCollection({
      id: collection.id,
      organization_id: session.user.organization_id,
      purpose: collection.purpose,
      mode: collection.mode,
      filters: publicCollectionFiltersSchema.parse(collection.filters)
    })
  })))
  return { data: { collections } }
})
