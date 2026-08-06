import { databaseError } from '../../utils/app-error'
import { requireAuth } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  const { data, error } = await useSupabaseAdmin().from('tags').select('id,name,slug').eq('organization_id', session.user.organization_id).order('name')
  if (error) throw databaseError('list tags', error)
  return { data: { tags: data } }
})
