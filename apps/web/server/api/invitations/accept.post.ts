import { workspaceAcceptSchema } from '@content-library/shared'
import { readValidatedBody } from 'h3'
import { appError, databaseError } from '../../utils/app-error'
import { hashToken } from '../../utils/crypto'
import { hashPassword } from '../../utils/password'
import { requireTrustedMutation } from '../../utils/request-security'
import { createAppSession, getAppSession, setWebSessionCookie } from '../../utils/session'

export default defineEventHandler(async (event) => {
  requireTrustedMutation(event)
  const input=await readValidatedBody(event,body=>workspaceAcceptSchema.safeParse(body))
  if(!input.success) throw appError(400,'INVALID_INVITATION','Enter a valid invitation and password.',input.error.flatten())
  const db=useSupabaseAdmin()
  const { data:invite,error }=await db.from('organization_invitations').select('*').eq('token_hash',hashToken(input.data.token)).is('accepted_at',null).is('revoked_at',null).gt('expires_at',new Date().toISOString()).maybeSingle()
  if(error) throw databaseError('read invitation',error)
  if(!invite) throw appError(404,'INVITATION_NOT_FOUND','This invitation is invalid or has expired.')
  const current=await getAppSession(event)
  const { data:existing,error:accountError }=await db.from('accounts').select('*').eq('email',invite.email).maybeSingle()
  if(accountError) throw databaseError('find invited account',accountError)
  let account=existing
  if(existing) {
    if(!current || current.user.account_id!==existing.id) throw appError(401,'SIGN_IN_REQUIRED','Sign in with the invited email before accepting this invitation.')
  } else {
    if(!input.data.password) throw appError(400,'PASSWORD_REQUIRED','Choose a password with at least 12 characters.')
    const created=await db.from('accounts').insert({ email:invite.email,password_hash:await hashPassword(input.data.password) }).select('*').single()
    if(created.error) throw databaseError('create invited account',created.error)
    account=created.data
  }
  const { data:member,error:memberError }=await db.from('allowed_users').upsert({ organization_id:invite.organization_id,account_id:account!.id,email:invite.email,role:invite.role,is_active:true },{onConflict:'account_id,organization_id'}).select('id').single()
  if(memberError) throw databaseError('accept workspace invitation',memberError)
  const accepted=await db.from('organization_invitations').update({accepted_at:new Date().toISOString(),accepted_account_id:account!.id}).eq('id',invite.id).is('accepted_at',null).select('id').maybeSingle()
  if(accepted.error || !accepted.data) throw appError(409,'INVITATION_USED','This invitation has already been accepted.')
  const next=await createAppSession(member.id)
  setWebSessionCookie(event,next.token,next.expiresAt)
  return { data:{ accepted:true } }
})
