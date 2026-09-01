import { getRouterParam } from 'h3'
import { appError, databaseError } from '../../utils/app-error'
import { projectBoardLocksAction, requireBoardRole } from '../../utils/boards'
import { requireTrustedMutation } from '../../utils/request-security'
import { requireAuth } from '../../utils/session'

export default defineEventHandler(async (event) => {
  requireTrustedMutation(event)
  const session = await requireAuth(event)
  const id = getRouterParam(event, 'id') ?? ''
  const { collection } = await requireBoardRole(id, session.user.organization_id, session.user.id, ['owner'], session.user.role)
  if (projectBoardLocksAction(collection.source_project_id, 'delete')) throw appError(409, 'PROJECT_BOARD_DELETE', 'Archive the linked project to hide this board.')
  if (collection.purpose === 'portfolio' && collection.portfolio_kind === 'main') {
    throw appError(409, 'MAIN_PORTFOLIO_REQUIRED', 'The main portfolio cannot be deleted. Delete individual client versions instead.')
  }

  const { data, error } = await useSupabaseAdmin().from('public_collections').delete()
    .eq('id', id).eq('organization_id', session.user.organization_id).select('id').maybeSingle()
  if (error) throw databaseError('delete board', error)
  if (!data) throw appError(404, 'BOARD_NOT_FOUND', 'Board not found.')

  return { data: { deleted: true } }
})
