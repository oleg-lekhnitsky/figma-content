import { getRouterParam } from 'h3'
import { appError, databaseError } from '../../../../utils/app-error'
import { requireBoardRole } from '../../../../utils/boards'
import { requireTrustedMutation } from '../../../../utils/request-security'
import { requireAuth } from '../../../../utils/session'

export default defineEventHandler(async (event) => {
  requireTrustedMutation(event)
  const session = await requireAuth(event)
  const id = getRouterParam(event, 'id') ?? ''
  const userId = getRouterParam(event, 'userId') ?? ''
  await requireBoardRole(id, session.user.organization_id, session.user.id, ['owner'])
  if (!userId || userId === session.user.id) throw appError(400, 'OWNER_REQUIRED', 'The board owner cannot be removed.')
  const { error } = await useSupabaseAdmin().from('public_collection_members').delete()
    .eq('collection_id', id).eq('organization_id', session.user.organization_id).eq('user_id', userId).neq('role', 'owner')
  if (error) throw databaseError('remove board member', error)
  return { data: { removed: true } }
})
