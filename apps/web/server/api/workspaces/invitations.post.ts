import { workspaceInviteSchema } from '@content-library/shared'
import { getRequestURL, readValidatedBody } from 'h3'
import { appError, databaseError } from '../../utils/app-error'
import { hashToken, randomToken } from '../../utils/crypto'
import { requireTrustedMutation } from '../../utils/request-security'
import { requireRole } from '../../utils/session'

export default defineEventHandler(async (event) => {
  requireTrustedMutation(event)
  const session = await requireRole(event,['admin'])
  const input = await readValidatedBody(event, body => workspaceInviteSchema.safeParse(body))
  if (!input.success) throw appError(400,'INVALID_INVITATION','Enter a valid email and role.',input.error.flatten())
  const token=randomToken(32)
  const expiresAt=new Date(Date.now()+7*24*60*60*1000).toISOString()
  const { data,error }=await useSupabaseAdmin().from('organization_invitations').insert({ organization_id:session.user.organization_id,email:input.data.email,role:input.data.role,token_hash:hashToken(token),invited_by:session.user.id,expires_at:expiresAt }).select('id,email,role,expires_at').single()
  if(error) throw databaseError('create workspace invitation',error)
  const url=getRequestURL(event)
  return { data:{ invitation:data, inviteUrl:`${url.origin}/invite/${token}` } }
})
