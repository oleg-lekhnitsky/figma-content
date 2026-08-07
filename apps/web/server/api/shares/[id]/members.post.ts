import { boardMemberSchema } from '@content-library/shared'
import { getRouterParam, readValidatedBody } from 'h3'
import { appError, databaseError } from '../../../utils/app-error'
import { requireBoardRole } from '../../../utils/boards'
import { requireTrustedMutation } from '../../../utils/request-security'
import { requireAuth } from '../../../utils/session'

export default defineEventHandler(async (event) => {
  requireTrustedMutation(event)
  const session = await requireAuth(event)
  const id = getRouterParam(event, 'id') ?? ''
  await requireBoardRole(id, session.user.organization_id, session.user.id, ['owner'], session.user.role)
  const input = await readValidatedBody(event, value => boardMemberSchema.safeParse(value))
  if (!input.success) throw appError(400, 'INVALID_BOARD_MEMBER', 'Enter a team member and board role.', input.error.flatten())
  const db = useSupabaseAdmin()
  const { data: user, error: userError } = await db.from('allowed_users').select('id,email,figma_handle')
    .eq('organization_id', session.user.organization_id).ilike('email', input.data.email).eq('is_active', true).maybeSingle()
  if (userError) throw databaseError('find board member', userError)
  if (!user) throw appError(404, 'TEAM_MEMBER_NOT_FOUND', 'Add this person to the team before inviting them to a board.')
  if (user.id === session.user.id) throw appError(400, 'OWNER_ROLE_FIXED', 'The board owner role cannot be changed here.')
  const { data, error } = await db.from('public_collection_members').upsert({
    collection_id: id, organization_id: session.user.organization_id, user_id: user.id,
    role: input.data.role, invited_by: session.user.id
  }, { onConflict: 'collection_id,user_id' }).select('user_id,role').single()
  if (error) throw databaseError('save board member', error)
  return { data: { member: { ...data, allowed_users: user } } }
})
