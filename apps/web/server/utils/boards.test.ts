import { describe, expect, it } from 'vitest'
import { resolveBoardRole } from './boards'

describe('board authorization', () => {
  it('lets workspace members view standard boards without an explicit board role', () => {
    for (const purpose of ['showcase', 'portfolio', 'case'] as const) {
      expect(resolveBoardRole({ isCreator: false, workspaceRole: 'viewer', purpose })).toBe('viewer')
    }
  })

  it('keeps review boards restricted to explicitly added members', () => {
    expect(resolveBoardRole({ isCreator: false, workspaceRole: 'viewer', purpose: 'review' })).toBeNull()
    expect(resolveBoardRole({ membershipRole: 'contributor', isCreator: false, workspaceRole: 'viewer', purpose: 'review' })).toBe('contributor')
  })

  it('always lets creators and workspace admins manage a board', () => {
    expect(resolveBoardRole({ membershipRole: 'viewer', isCreator: true, workspaceRole: 'viewer', purpose: 'showcase' })).toBe('owner')
    expect(resolveBoardRole({ membershipRole: 'viewer', isCreator: false, workspaceRole: 'admin', purpose: 'review' })).toBe('owner')
  })
})
