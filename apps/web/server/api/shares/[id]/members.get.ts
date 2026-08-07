import { getRouterParam } from 'h3'
import { appError, databaseError } from '../../../utils/app-error'
import { requireBoardRole } from '../../../utils/boards'
import { requireAuth } from '../../../utils/session'

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  const id = getRouterParam(event, 'id') ?? ''
  await requireBoardRole(id, session.user.organization_id, session.user.id, ['owner', 'editor', 'contributor', 'viewer'], session.user.role)
  const { data, error } = await useSupabaseAdmin().from('public_collection_members')
    .select('user_id,role,created_at,allowed_users!public_collection_members_user_id_organization_id_fkey(email,figma_handle,avatar_url)')
    .eq('collection_id', id).eq('organization_id', session.user.organization_id).order('created_at')
  if (error) throw databaseError('list board members', error)
  if (!data) throw appError(404, 'BOARD_NOT_FOUND', 'Board not found.')
  return { data: { members: data } }
})
