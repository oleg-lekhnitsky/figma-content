import { getRouterParam } from 'h3'
import { appError, databaseError } from '../../utils/app-error'
import { requireBoardRole } from '../../utils/boards'
import { requireTrustedMutation } from '../../utils/request-security'
import { requireAuth } from '../../utils/session'

export default defineEventHandler(async (event) => {
  requireTrustedMutation(event)
  const session = await requireAuth(event)
  const id = getRouterParam(event, 'id') ?? ''
  await requireBoardRole(id, session.user.organization_id, session.user.id, ['owner'], session.user.role)

  const { data, error } = await useSupabaseAdmin().from('public_collections').delete()
    .eq('id', id).eq('organization_id', session.user.organization_id).select('id').maybeSingle()
  if (error) throw databaseError('delete board', error)
  if (!data) throw appError(404, 'BOARD_NOT_FOUND', 'Board not found.')

  return { data: { deleted: true } }
})
