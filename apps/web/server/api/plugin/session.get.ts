import { requireAuth } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  return { data: {
    expiresAt: session.expiresAt,
    user: {
      id: session.user.id,
      email: session.user.email,
      figmaHandle: session.user.figma_handle,
      avatarUrl: session.user.avatar_url,
      role: session.user.role
    }
  } }
})
