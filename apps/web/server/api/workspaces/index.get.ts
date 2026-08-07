import { databaseError } from '../../utils/app-error'
import { requireAuth } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  const { data, error } = await useSupabaseAdmin().from('allowed_users')
    .select('id,role,organization_id,organizations(id,name,slug)')
    .eq('account_id', session.user.account_id).eq('is_active', true).order('created_at')
  if (error) throw databaseError('list workspaces', error)
  return { data: { currentId: session.user.organization_id, workspaces: data.map((item: { id:string; role:string; organizations:object }) => ({ membershipId:item.id, role:item.role, ...item.organizations })) } }
})
