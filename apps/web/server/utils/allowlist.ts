import type { FigmaUser } from './figma'
import type { AllowedUserRow } from './database.types'
import { appError, databaseError } from './app-error'

export const ACCESS_DENIED_MESSAGE = 'This Figma account does not have access to this library. Contact a library administrator.'

export const resolveAllowedUser = async (figmaUser: FigmaUser): Promise<AllowedUserRow> => {
  const db = useSupabaseAdmin()
  const { data: idMatch, error: idError } = await db.from('allowed_users').select('*').eq('figma_user_id', figmaUser.id).maybeSingle()
  if (idError) throw databaseError('match allowlist by Figma ID', idError)

  let user = idMatch
  if (!user) {
    const { data: emailMatches, error: emailError } = await db
      .from('allowed_users').select('*').ilike('email', figmaUser.email).is('figma_user_id', null).limit(2)
    if (emailError) throw databaseError('match unbound allowlist invitation', emailError)
    if (emailMatches.length !== 1) throw appError(403, 'ACCESS_DENIED', ACCESS_DENIED_MESSAGE)

    const candidate = emailMatches[0]!
    if (!candidate.is_active) throw appError(403, 'ACCESS_DENIED', ACCESS_DENIED_MESSAGE)
    const { data: bound, error: bindError } = await db.from('allowed_users').update({
      figma_user_id: figmaUser.id,
      figma_handle: figmaUser.handle,
      avatar_url: figmaUser.img_url ?? null,
      last_login_at: new Date().toISOString()
    }).eq('id', candidate.id).is('figma_user_id', null).select('*').maybeSingle()
    if (bindError || !bound) throw databaseError('bind Figma identity', bindError)
    user = bound
  } else {
    if (!user.is_active) throw appError(403, 'ACCESS_DENIED', ACCESS_DENIED_MESSAGE)
    const { data: updated, error } = await db.from('allowed_users').update({
      email: figmaUser.email.toLowerCase(),
      figma_handle: figmaUser.handle,
      avatar_url: figmaUser.img_url ?? null,
      last_login_at: new Date().toISOString()
    }).eq('id', user.id).select('*').single()
    if (error) throw databaseError('update Figma identity', error)
    user = updated
  }

  if (!user.is_active) throw appError(403, 'ACCESS_DENIED', ACCESS_DENIED_MESSAGE)
  return user as AllowedUserRow
}
