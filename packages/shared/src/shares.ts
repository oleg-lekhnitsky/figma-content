import { z } from 'zod'

export const boardRoleSchema = z.enum(['owner', 'editor', 'contributor', 'viewer'])
export const boardMemberRoleSchema = boardRoleSchema.exclude(['owner'])
export const boardPurposeSchema = z.enum(['showcase', 'review'])
export const boardLayoutSchema = z.enum(['masonry', 'column', 'presentation', 'grid'])

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
  purpose: boardPurposeSchema.default('showcase'),
  mode: z.enum(['dynamic', 'static']),
  layout: boardLayoutSchema.default('masonry'),
  filters: publicCollectionFiltersSchema,
  expiresAt: z.iso.datetime({ offset: true }).nullable().default(null),
  reviewMonth: z.iso.date().nullable().default(null),
  submissionDeadline: z.iso.datetime({ offset: true }).nullable().default(null)
}).refine(value => !value.expiresAt || value.expiresAt > new Date().toISOString(), {
  message: 'Choose an expiry date in the future.',
  path: ['expiresAt']
}).refine(value => value.purpose !== 'review' || (value.mode === 'static' && value.reviewMonth), {
  message: 'Monthly review boards require a review month and manual collection.',
  path: ['reviewMonth']
})

export const updatePublicCollectionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('rename'), title: z.string().trim().min(1).max(120) }),
  z.object({ action: z.literal('settings'), filters: publicCollectionFiltersSchema }),
  z.object({ action: z.literal('layout'), layout: boardLayoutSchema }),
  z.object({ action: z.literal('refresh') }),
  z.object({ action: z.literal('publish') }),
  z.object({ action: z.literal('revoke') })
])

export const boardMemberSchema = z.object({
  email: z.email().trim().toLowerCase(),
  role: boardMemberRoleSchema
}).strict()

export const boardAssetSchema = z.object({ assetId: z.uuid() }).strict()
export const boardOrderSchema = z.object({
  assetIds: z.array(z.uuid()).min(1).max(500).refine(ids => new Set(ids).size === ids.length)
}).strict()
export const reviewSubmissionSchema = z.object({ status: z.enum(['ready', 'reviewed']) }).strict()
export const reviewDecisionSchema = z.object({
  assetIds: z.array(z.uuid()).min(1).max(100).transform(ids => [...new Set(ids)]),
  decision: z.enum(['approve', 'pass', 'reopen'])
}).strict()

export type PublicCollectionFilters = z.infer<typeof publicCollectionFiltersSchema>
export type BoardRole = z.infer<typeof boardRoleSchema>
export type BoardLayout = z.infer<typeof boardLayoutSchema>
