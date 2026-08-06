import { getQuery } from 'h3'
import { requireRole } from '../../utils/session'
import { databaseError } from '../../utils/app-error'

export default defineEventHandler(async (event) => {
  const session = await requireRole(event, ['admin'])
  const page = Math.max(1, Number(getQuery(event).page) || 1)
  const { data, count, error } = await useSupabaseAdmin().from('audit_logs').select('id,action,target_type,target_id,metadata,created_at,allowed_users!audit_logs_actor_id_fkey(email,figma_handle)', { count: 'exact' }).eq('organization_id', session.user.organization_id).order('created_at', { ascending: false }).range((page - 1) * 50, page * 50 - 1)
  if (error) throw databaseError('list audit logs', error)
  return { data: { logs: data, total: count ?? 0, page } }
})
