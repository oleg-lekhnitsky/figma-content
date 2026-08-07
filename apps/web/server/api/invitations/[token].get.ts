import { appError, databaseError } from '../../utils/app-error'
import { hashToken } from '../../utils/crypto'

export default defineEventHandler(async (event) => {
  const token=getRouterParam(event,'token') ?? ''
  const { data,error }=await useSupabaseAdmin().from('organization_invitations').select('email,role,expires_at,organizations(name)').eq('token_hash',hashToken(token)).is('accepted_at',null).is('revoked_at',null).gt('expires_at',new Date().toISOString()).maybeSingle()
  if(error) throw databaseError('read invitation',error)
  if(!data) throw appError(404,'INVITATION_NOT_FOUND','This invitation is invalid or has expired.')
  return { data:{ email:data.email,role:data.role,expiresAt:data.expires_at,workspace:data.organizations } }
})
