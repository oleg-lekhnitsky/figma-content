import { clearWebSessionCookie, getAppSession, revokeSession } from '../../utils/session'
import { requireSameOrigin } from '../../utils/request-security'

export default defineEventHandler(async (event) => {
  requireSameOrigin(event)
  const session = await getAppSession(event)
  if (session) await revokeSession(session.id)
  clearWebSessionCookie(event)
  return { data: { success: true } }
})
