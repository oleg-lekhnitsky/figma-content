import { databaseError } from '../../utils/app-error'
import { requireAuth } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  const db = useSupabaseAdmin()
  const { data: memberships, error: membershipError } = await db.from('public_collection_members')
    .select('collection_id,role')
    .eq('organization_id', session.user.organization_id)
    .eq('user_id', session.user.id)
    .in('role', ['owner', 'editor', 'contributor'])
  if (membershipError) throw databaseError('list plugin board memberships', membershipError)
  if (!memberships.length && session.user.role !== 'admin') return { data: { boards: [] } }

  const roles = new Map(memberships.map((membership: { collection_id: string; role: string }) => [membership.collection_id, membership.role]))
  let query = db.from('public_collections')
    .select('id,title,review_month,submission_deadline')
    .eq('organization_id', session.user.organization_id)
    .eq('purpose', 'review')
  if (session.user.role !== 'admin') query = query.in('id', [...roles.keys()])
  const { data, error } = await query.order('review_month', { ascending: false }).limit(50)
  if (error) throw databaseError('list plugin review boards', error)
  return {
    data: {
      boards: data.map((board: { id: string; [key: string]: unknown }) => ({
        ...board,
        role: roles.get(board.id) ?? 'admin'
      }))
    }
  }
})
