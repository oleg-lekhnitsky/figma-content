import type { BoardRole } from '@content-library/shared'
import { appError, databaseError } from './app-error'

const rank: Record<BoardRole, number> = { viewer: 0, contributor: 1, editor: 2, owner: 3 }

export const requireBoardRole = async (
  collectionId: string,
  organizationId: string,
  userId: string,
  allowed: readonly BoardRole[]
) => {
  const db = useSupabaseAdmin()
  const { data: collection, error: collectionError } = await db.from('public_collections')
    .select('id,organization_id,created_by,title,mode,filters,slug,expires_at,revoked_at,created_at,updated_at')
    .eq('id', collectionId).eq('organization_id', organizationId).maybeSingle()
  if (collectionError) throw databaseError('read board', collectionError)
  if (!collection) throw appError(404, 'BOARD_NOT_FOUND', 'Board not found.')
  const { data: membership, error } = await db.from('public_collection_members')
    .select('role').eq('collection_id', collectionId).eq('organization_id', organizationId).eq('user_id', userId).maybeSingle()
  if (error) throw databaseError('read board membership', error)
  const role = (membership?.role ?? (collection.created_by === userId ? 'owner' : null)) as BoardRole | null
  if (!role || !allowed.includes(role)) throw appError(403, 'BOARD_FORBIDDEN', 'You do not have permission to change this board.')
  return { collection, role }
}

export const canManageBoardRole = (role: BoardRole, required: BoardRole) => rank[role] >= rank[required]
