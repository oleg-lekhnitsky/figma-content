import { describe, expect, it } from 'vitest'
import { assetMetadataSchema, hasPermission, roleSchema, userInviteSchema, userUpdateSchema } from './index'

describe('shared authorization contracts', () => {
  it('keeps role permissions least-privileged', () => {
    expect(hasPermission(roleSchema.parse('viewer'), 'asset:upload')).toBe(false)
    expect(hasPermission(roleSchema.parse('contributor'), 'asset:upload')).toBe(true)
    expect(hasPermission(roleSchema.parse('contributor'), 'asset:approve')).toBe(false)
    expect(hasPermission(roleSchema.parse('editor'), 'asset:approve')).toBe(true)
    expect(hasPermission(roleSchema.parse('admin'), 'user:manage')).toBe(true)
  })

  it('rejects empty asset titles', () => {
    const result = assetMetadataSchema.safeParse({
      title: '  ',
      description: null,
      tags: [],
      projectId: null,
      campaignId: null,
      language: null,
      contentType: null,
      status: 'draft'
    })

    expect(result.success).toBe(false)
  })

  it('defaults invitations to viewer and rejects malformed identities', () => {
    expect(userInviteSchema.parse({ email: 'NEW@EXAMPLE.COM' })).toEqual({ email: 'new@example.com', role: 'viewer' })
    expect(userInviteSchema.safeParse({ email: 'not-an-email', role: 'admin' }).success).toBe(false)
  })

  it('requires an explicit user-management change', () => {
    expect(userUpdateSchema.safeParse({}).success).toBe(false)
    expect(userUpdateSchema.safeParse({ isActive: false }).success).toBe(true)
  })
})
