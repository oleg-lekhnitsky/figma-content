import { z } from 'zod'

export const roles = ['viewer', 'contributor', 'editor', 'admin'] as const
export const roleSchema = z.enum(roles)
export type Role = z.infer<typeof roleSchema>

export const permissions = [
  'asset:view', 'asset:download', 'asset:upload', 'asset:edit-own',
  'asset:archive-own', 'asset:edit-any', 'asset:approve', 'asset:archive-any',
  'asset:delete', 'taxonomy:manage', 'user:manage', 'audit:view'
] as const
export type Permission = (typeof permissions)[number]

export const rolePermissions: Record<Role, readonly Permission[]> = {
  viewer: ['asset:view', 'asset:download'],
  contributor: ['asset:view', 'asset:download', 'asset:upload', 'asset:edit-own', 'asset:archive-own'],
  editor: ['asset:view', 'asset:download', 'asset:upload', 'asset:edit-own', 'asset:archive-own', 'asset:edit-any', 'asset:approve', 'asset:archive-any', 'taxonomy:manage'],
  admin: [...permissions]
}

export const hasPermission = (role: Role, permission: Permission) =>
  rolePermissions[role].includes(permission)

export const passwordSchema = z.string().min(12, 'Use at least 12 characters.').max(128)
export const userInviteSchema = z.object({
  email: z.email().trim().toLowerCase(),
  role: roleSchema.default('viewer'),
  temporaryPassword: passwordSchema.optional()
})
export const passwordLoginSchema = z.object({ email: z.email().trim().toLowerCase(), password: z.string().min(1).max(128) })
export const passwordChangeSchema = z.object({ currentPassword: z.string().min(1).max(128), newPassword: passwordSchema })
  .refine(value => value.currentPassword !== value.newPassword, { message: 'Choose a new password.', path: ['newPassword'] })
export const userUpdateSchema = z.object({ role: roleSchema.optional(), isActive: z.boolean().optional() })
  .refine(value => value.role !== undefined || value.isActive !== undefined, 'Provide at least one change.')
