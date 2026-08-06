import { databaseError } from '../../utils/app-error'
import { requireAuth } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  const { data, error } = await useSupabaseAdmin().from('projects').select('id,name,slug').eq('organization_id', session.user.organization_id).is('archived_at', null).order('name')
  if (error) throw databaseError('list projects', error)
  return { data: { projects: data } }
})
