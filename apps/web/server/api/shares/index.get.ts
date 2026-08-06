import { databaseError } from '../../utils/app-error'
import { requireRole } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const session = await requireRole(event, ['editor', 'admin'])
  const { data, error } = await useSupabaseAdmin().from('public_collections')
    .select('id,slug,title,mode,filters,expires_at,revoked_at,created_at,updated_at')
    .eq('organization_id', session.user.organization_id).is('revoked_at', null)
    .order('created_at', { ascending: false }).limit(50)
  if (error) throw databaseError('list public collections', error)
  return { data: { collections: data } }
})
