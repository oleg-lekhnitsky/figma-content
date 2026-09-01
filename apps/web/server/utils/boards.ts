import type { BoardRole, Role } from '@content-library/shared'
import { appError, databaseError } from './app-error'

const rank: Record<BoardRole, number> = { viewer: 0, contributor: 1, editor: 2, owner: 3 }
type ProjectBoardLockedAction = 'settings' | 'apply-filters' | 'delete'

export const projectBoardLocksAction = (sourceProjectId: string | null | undefined, action: ProjectBoardLockedAction) => (
  Boolean(sourceProjectId) && ['settings', 'apply-filters', 'delete'].includes(action)
)

export const resolveBoardRole = ({
  membershipRole,
  isCreator,
  workspaceRole,
  purpose
}: {
  membershipRole?: BoardRole | null
  isCreator: boolean
  workspaceRole?: Role
  purpose: 'showcase' | 'review' | 'portfolio' | 'case'
}): BoardRole | null => {
  if (isCreator || workspaceRole === 'admin') return 'owner'
  if (membershipRole) return membershipRole
  return purpose === 'review' ? null : 'viewer'
}

export const requireBoardRole = async (
  collectionId: string,
  organizationId: string,
  userId: string,
  allowed: readonly BoardRole[],
  workspaceRole?: Role
) => {
  const db = useSupabaseAdmin()
  const { data: collection, error: collectionError } = await db.from('public_collections')
    .select('id,organization_id,created_by,title,purpose,portfolio_kind,portfolio_client,introduction,contact_heading,contact_links,review_month,submission_deadline,mode,filters,slug,expires_at,revoked_at,publication_enabled,content_strategy,asset_scope,layout,view_settings,source_project_id,created_at,updated_at')
    .eq('id', collectionId).eq('organization_id', organizationId).maybeSingle()
  if (collectionError) throw databaseError('read board', collectionError)
  if (!collection) throw appError(404, 'BOARD_NOT_FOUND', 'Board not found.')
  const { data: membership, error } = await db.from('public_collection_members')
    .select('role').eq('collection_id', collectionId).eq('organization_id', organizationId).eq('user_id', userId).maybeSingle()
  if (error) throw databaseError('read board membership', error)
  const role = resolveBoardRole({
    membershipRole: membership?.role as BoardRole | null | undefined,
    isCreator: collection.created_by === userId,
    workspaceRole,
    purpose: collection.purpose as 'showcase' | 'review' | 'portfolio' | 'case'
  })
  if (!role || !allowed.includes(role)) throw appError(403, 'BOARD_FORBIDDEN', 'You do not have permission to change this board.')
  return { collection, role }
}

export const canManageBoardRole = (role: BoardRole, required: BoardRole) => rank[role] >= rank[required]
