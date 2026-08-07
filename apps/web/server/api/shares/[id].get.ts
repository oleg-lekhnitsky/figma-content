import { getRouterParam } from 'h3'
import { requireBoardRole } from '../../utils/boards'
import { requireAuth } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  const id = getRouterParam(event, 'id') ?? ''
  const { collection, role } = await requireBoardRole(
    id,
    session.user.organization_id,
    session.user.id,
    ['owner', 'editor', 'contributor', 'viewer'],
    session.user.role
  )
  return {
    data: {
      collection,
      role,
      workspaceAdmin: session.user.role === 'admin'
    }
  }
})
