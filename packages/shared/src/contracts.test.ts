import { describe, expect, it } from 'vitest'
import { assetListQuerySchema, assetMetadataSchema, createPublicCollectionSchema, hasPermission, passwordChangeSchema, passwordLoginSchema, roleSchema, userInviteSchema, userUpdateSchema } from './index'

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

  it('requires strong temporary and replacement passwords', () => {
    expect(userInviteSchema.safeParse({ email: 'new@example.com', temporaryPassword: 'short' }).success).toBe(false)
    expect(userInviteSchema.safeParse({ email: 'new@example.com', temporaryPassword: 'long-temporary-password' }).success).toBe(true)
    expect(passwordLoginSchema.safeParse({ email: 'new@example.com', password: '' }).success).toBe(false)
    expect(passwordChangeSchema.safeParse({ currentPassword: 'long-temporary-password', newPassword: 'long-temporary-password' }).success).toBe(false)
  })

  it('requires an explicit user-management change', () => {
    expect(userUpdateSchema.safeParse({}).success).toBe(false)
    expect(userUpdateSchema.safeParse({ isActive: false }).success).toBe(true)
  })

  it('validates dynamic and static public collection settings', () => {
    const base = { title: 'August approvals', filters: { search: '', projectId: null, tagId: null, dateFrom: null, dateTo: null }, expiresAt: null }
    expect(createPublicCollectionSchema.safeParse({ ...base, mode: 'dynamic' }).success).toBe(true)
    expect(createPublicCollectionSchema.safeParse({ ...base, mode: 'static' }).success).toBe(true)
    expect(createPublicCollectionSchema.safeParse({ ...base, title: ' ', mode: 'static' }).success).toBe(false)
  })

  it('rejects public collection date ranges in reverse order', () => {
    const result = createPublicCollectionSchema.safeParse({
      title: 'Invalid range', mode: 'dynamic', expiresAt: null,
      filters: { search: '', projectId: null, tagId: null, dateFrom: '2026-08-10T00:00:00.000Z', dateTo: '2026-08-01T00:00:00.000Z' }
    })
    expect(result.success).toBe(false)
  })

  it('validates asset list date filters', () => {
    expect(assetListQuerySchema.safeParse({ dateFrom: '2026-08-01T00:00:00.000Z' }).success).toBe(true)
    expect(assetListQuerySchema.safeParse({ dateFrom: '2026-08-10T00:00:00.000Z', dateTo: '2026-08-01T00:00:00.000Z' }).success).toBe(false)
  })
})
