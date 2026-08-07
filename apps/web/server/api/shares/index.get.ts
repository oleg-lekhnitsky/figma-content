import { databaseError } from '../../utils/app-error'
import { requireAuth } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  const { data: memberships, error: membershipError } = await useSupabaseAdmin().from('public_collection_members')
    .select('collection_id,role').eq('organization_id', session.user.organization_id).eq('user_id', session.user.id)
  if (membershipError) throw databaseError('list board memberships', membershipError)
  if (!memberships.length) return { data: { collections: [] } }
  const roles = new Map(memberships.map((membership: { collection_id: string; role: string }) => [membership.collection_id, membership.role]))
  const { data, error } = await useSupabaseAdmin().from('public_collections')
    .select('id,slug,title,mode,filters,expires_at,revoked_at,created_at,updated_at')
    .eq('organization_id', session.user.organization_id).in('id', [...roles.keys()]).is('revoked_at', null)
    .order('created_at', { ascending: false }).limit(50)
  if (error) throw databaseError('list public collections', error)
  return { data: { collections: data.map((collection: { id: string; [key: string]: unknown }) => ({ ...collection, role: roles.get(collection.id) })) } }
})
