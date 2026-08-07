import { workspaceSwitchSchema } from '@content-library/shared'
import { readValidatedBody } from 'h3'
import { appError, databaseError } from '../../utils/app-error'
import { createAppSession, requireAuth, revokeSession } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const current = await requireAuth(event)
  const input = await readValidatedBody(event, body => workspaceSwitchSchema.safeParse(body))
  if (!input.success) throw appError(400, 'INVALID_WORKSPACE', 'Choose a valid workspace.')
  const { data:member,error } = await useSupabaseAdmin().from('allowed_users').select('id,role,organizations(id,name,slug)').eq('account_id',current.user.account_id).eq('organization_id',input.data.workspaceId).eq('is_active',true).maybeSingle()
  if (error) throw databaseError('find plugin workspace membership',error)
  if (!member) throw appError(403,'FORBIDDEN','You do not have access to this workspace.')
  const next=await createAppSession(member.id)
  await revokeSession(current.id)
  return { data:{token:next.token,expiresAt:next.expiresAt,workspace:{...member.organizations,role:member.role}} }
})
