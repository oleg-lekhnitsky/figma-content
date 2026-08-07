import { workspaceSwitchSchema } from '@content-library/shared'
import { readValidatedBody } from 'h3'
import { appError, databaseError } from '../../utils/app-error'
import { requireTrustedMutation } from '../../utils/request-security'
import { createAppSession, requireAuth, revokeSession, setWebSessionCookie } from '../../utils/session'

export default defineEventHandler(async (event) => {
  requireTrustedMutation(event)
  const current = await requireAuth(event)
  const input = await readValidatedBody(event, body => workspaceSwitchSchema.safeParse(body))
  if (!input.success) throw appError(400,'INVALID_WORKSPACE','Choose a valid workspace.')
  const { data:member,error } = await useSupabaseAdmin().from('allowed_users').select('id').eq('account_id',current.user.account_id).eq('organization_id',input.data.workspaceId).eq('is_active',true).maybeSingle()
  if (error) throw databaseError('find workspace membership',error)
  if (!member) throw appError(403,'FORBIDDEN','You do not have access to this workspace.')
  const next = await createAppSession(member.id)
  setWebSessionCookie(event,next.token,next.expiresAt)
  await revokeSession(current.id)
  return { data:{ switched:true } }
})
