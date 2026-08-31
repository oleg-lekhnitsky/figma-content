import { getRouterParam } from 'h3'
import { appError, databaseError } from '../../../utils/app-error'
import { requireBoardRole } from '../../../utils/boards'
import { requireAuth } from '../../../utils/session'

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  const id = getRouterParam(event, 'id') ?? ''
  const { role } = await requireBoardRole(id, session.user.organization_id, session.user.id, ['owner', 'editor', 'contributor', 'viewer'], session.user.role)
  const { data, error } = await useSupabaseAdmin().from('public_collection_members')
    .select('user_id,role,created_at,allowed_users!public_collection_members_user_id_organization_id_fkey(email,figma_handle,avatar_url)')
    .eq('collection_id', id).eq('organization_id', session.user.organization_id).order('created_at')
  if (error) throw databaseError('list board members', error)
  if (!data) throw appError(404, 'BOARD_NOT_FOUND', 'Board not found.')
  let workspaceMembers: Array<{ id: string; email: string | null; figma_handle: string | null; avatar_url: string | null; role: string }> = []
  if (role === 'owner') {
    const { data: candidates, error: candidatesError } = await useSupabaseAdmin().from('allowed_users')
      .select('id,email,figma_handle,avatar_url,role')
      .eq('organization_id', session.user.organization_id)
      .eq('is_active', true)
      .neq('id', session.user.id)
      .order('email')
    if (candidatesError) throw databaseError('list workspace members for board roles', candidatesError)
    workspaceMembers = candidates
  }
  return { data: { members: data, workspaceMembers } }
})
