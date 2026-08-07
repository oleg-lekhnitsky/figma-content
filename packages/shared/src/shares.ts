import { z } from 'zod'

export const boardRoleSchema = z.enum(['owner', 'editor', 'contributor', 'viewer'])
export const boardMemberRoleSchema = boardRoleSchema.exclude(['owner'])

export const publicCollectionFiltersSchema = z.object({
  search: z.string().trim().max(200).default(''),
  projectId: z.uuid().nullable().default(null),
  tagId: z.uuid().nullable().default(null),
  uploadedBy: z.uuid().nullable().default(null),
  dateFrom: z.iso.datetime({ offset: true }).nullable().default(null),
  dateTo: z.iso.datetime({ offset: true }).nullable().default(null)
}).refine(value => !value.dateFrom || !value.dateTo || value.dateTo >= value.dateFrom, {
  message: 'The end date must be after the start date.',
  path: ['dateTo']
})

export const createPublicCollectionSchema = z.object({
  title: z.string().trim().min(1).max(120),
  mode: z.enum(['dynamic', 'static']),
  filters: publicCollectionFiltersSchema,
  expiresAt: z.iso.datetime({ offset: true }).nullable().default(null)
}).refine(value => !value.expiresAt || value.expiresAt > new Date().toISOString(), {
  message: 'Choose an expiry date in the future.',
  path: ['expiresAt']
})

export const updatePublicCollectionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('rename'), title: z.string().trim().min(1).max(120) }),
  z.object({ action: z.literal('settings'), filters: publicCollectionFiltersSchema }),
  z.object({ action: z.literal('refresh') }),
  z.object({ action: z.literal('publish') }),
  z.object({ action: z.literal('revoke') })
])

export const boardMemberSchema = z.object({
  email: z.email().trim().toLowerCase(),
  role: boardMemberRoleSchema
}).strict()

export const boardAssetSchema = z.object({ assetId: z.uuid() }).strict()

export type PublicCollectionFilters = z.infer<typeof publicCollectionFiltersSchema>
export type BoardRole = z.infer<typeof boardRoleSchema>
