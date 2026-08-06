import type { Role } from '@content-library/shared'

export type AssetAction = 'edit' | 'archive' | 'approve' | 'delete'

export const canManageAsset = (role: Role, userId: string, uploadedBy: string, action: AssetAction) => {
  if (role === 'admin') return true
  if (action === 'delete') return false
  if (role === 'editor') return true
  if (role !== 'contributor' || userId !== uploadedBy) return false
  return action === 'edit' || action === 'archive'
}

export const canAccessOrganization = (userOrganizationId: string, resourceOrganizationId: string) =>
  userOrganizationId === resourceOrganizationId
