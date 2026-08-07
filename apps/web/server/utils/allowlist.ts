import type { FigmaUser } from './figma'
import type { AllowedUserRow } from './database.types'
import { appError, databaseError } from './app-error'

export const ACCESS_DENIED_MESSAGE = 'This Figma account does not have access to this library. Contact a library administrator.'

export const resolveAllowedUser = async (figmaUser: FigmaUser): Promise<AllowedUserRow> => {
  const db = useSupabaseAdmin()
  const { data: accountById, error: idError } = await db.from('accounts').select('id').eq('figma_user_id', figmaUser.id).maybeSingle()
  if (idError) throw databaseError('match allowlist by Figma ID', idError)
  let account=accountById
  if(!account){
    const found=await db.from('accounts').select('id').eq('email',figmaUser.email.toLowerCase()).maybeSingle()
    if(found.error) throw databaseError('match account by email',found.error)
    if(!found.data) throw appError(403,'ACCESS_DENIED',ACCESS_DENIED_MESSAGE)
    const bound=await db.from('accounts').update({figma_user_id:figmaUser.id}).eq('id',found.data.id).is('figma_user_id',null).select('id').maybeSingle()
    if(bound.error || !bound.data) throw databaseError('bind Figma identity',bound.error)
    account=bound.data
  }
  const { data:members,error }=await db.from('allowed_users').select('*').eq('account_id',account.id).eq('is_active',true).order('last_login_at',{ascending:false,nullsFirst:false}).limit(1)
  if(error) throw databaseError('find active workspace',error)
  const user=members[0]
  if(!user) throw appError(403,'ACCESS_DENIED',ACCESS_DENIED_MESSAGE)
  const updated=await db.from('allowed_users').update({email:figmaUser.email.toLowerCase(),figma_user_id:figmaUser.id,figma_handle:figmaUser.handle,avatar_url:figmaUser.img_url??null,last_login_at:new Date().toISOString()}).eq('id',user.id).select('*').single()
  if(updated.error) throw databaseError('update Figma membership',updated.error)
  return updated.data as AllowedUserRow
}
