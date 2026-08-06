import { describe, expect, it } from 'vitest'
import { canAccessOrganization, canManageAsset } from './authorization'

describe('asset authorization', () => {
  it('keeps viewers read-only', () => {
    expect(canManageAsset('viewer', 'viewer', 'viewer', 'edit')).toBe(false)
  })

  it('limits contributors to editing and archiving their own assets', () => {
    expect(canManageAsset('contributor', 'author', 'author', 'edit')).toBe(true)
    expect(canManageAsset('contributor', 'author', 'other', 'edit')).toBe(false)
    expect(canManageAsset('contributor', 'author', 'author', 'archive')).toBe(true)
    expect(canManageAsset('contributor', 'author', 'author', 'approve')).toBe(false)
  })

  it('allows editors to approve but reserves deletion for admins', () => {
    expect(canManageAsset('editor', 'editor', 'author', 'approve')).toBe(true)
    expect(canManageAsset('editor', 'editor', 'author', 'delete')).toBe(false)
    expect(canManageAsset('admin', 'admin', 'author', 'delete')).toBe(true)
  })

  it('rejects resources outside the session organization', () => {
    expect(canAccessOrganization('org-a', 'org-a')).toBe(true)
    expect(canAccessOrganization('org-a', 'org-b')).toBe(false)
  })
})
