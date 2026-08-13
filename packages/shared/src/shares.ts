import { z } from 'zod'

export const boardRoleSchema = z.enum(['owner', 'editor', 'contributor', 'viewer'])
export const boardMemberRoleSchema = boardRoleSchema.exclude(['owner'])
export const boardPurposeSchema = z.enum(['showcase', 'review', 'portfolio', 'case'])
export const boardLayoutSchema = z.enum(['masonry', 'column', 'presentation', 'grid'])
export const boardViewSettingsSchema = z.object({
  showText: z.boolean().default(true),
  radius: z.enum(['none', 'small', 'default', 'large']).default('default'),
  gap: z.enum(['none', 'tight', 'default', 'wide']).default('default'),
  columns: z.union([z.enum(['auto', 'even-fewer', 'fewer', 'more', 'even-more']), z.number().int().min(2).max(8)]).default('auto')
})
export const portfolioContactLinkSchema = z.object({
  label: z.string().trim().min(1).max(80),
  url: z.string().trim().max(500).refine(value => {
    try { return ['http:', 'https:', 'mailto:', 'tel:'].includes(new URL(value).protocol) } catch { return false }
  }, 'Enter a valid web, email, or phone link.')
})

export const publicCollectionFiltersSchema = z.object({
  search: z.string().trim().max(200).default(''),
  projectId: z.uuid().nullable().default(null),
  tagId: z.uuid().nullable().default(null),
  projectIds: z.array(z.uuid()).max(50).default([]),
  tagIds: z.array(z.uuid()).max(50).default([]),
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
  submissionDeadline: z.iso.datetime({ offset: true }).nullable().default(null),
  portfolioKind: z.enum(['main', 'client']).nullable().default(null),
  portfolioClient: z.string().trim().max(120).nullable().default(null),
  introduction: z.string().trim().max(2000).nullable().default(null),
  contactHeading: z.string().trim().max(160).nullable().default(null),
  contactLinks: z.array(portfolioContactLinkSchema).default([])
}).refine(value => !value.expiresAt || value.expiresAt > new Date().toISOString(), {
  message: 'Choose an expiry date in the future.',
  path: ['expiresAt']
}).refine(value => value.purpose !== 'review' || (value.mode === 'static' && value.reviewMonth), {
  message: 'Monthly review boards require a review month and manual collection.',
  path: ['reviewMonth']
}).refine(value => value.purpose !== 'portfolio' || value.mode === 'static', {
  message: 'Portfolio projects use manual ordering.',
  path: ['mode']
}).refine(value => value.purpose !== 'portfolio' || value.portfolioKind, {
  message: 'Choose a portfolio edition type.', path: ['portfolioKind']
}).refine(value => value.portfolioKind !== 'client' || value.portfolioClient, {
  message: 'Enter the client or recipient name.', path: ['portfolioClient']
}).refine(value => value.purpose !== 'case' || value.mode === 'static', {
  message: 'Portfolio cases use manual ordering.', path: ['mode']
})

export const updatePublicCollectionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('rename'), title: z.string().trim().min(1).max(120) }),
  z.object({ action: z.literal('settings'), filters: publicCollectionFiltersSchema }),
  z.object({
    action: z.literal('portfolio-settings'),
    portfolioKind: z.enum(['main', 'client']),
    portfolioClient: z.string().trim().max(120).nullable(),
    introduction: z.string().trim().max(2000).nullable(),
    contactHeading: z.string().trim().max(160).nullable(),
    contactLinks: z.array(portfolioContactLinkSchema)
  }).refine(value => value.portfolioKind !== 'client' || value.portfolioClient, {
    message: 'Enter the client or recipient name.',
    path: ['portfolioClient']
  }),
  z.object({ action: z.literal('layout'), layout: boardLayoutSchema }),
  z.object({ action: z.literal('view-settings'), viewSettings: boardViewSettingsSchema }),
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
export type BoardViewSettings = z.infer<typeof boardViewSettingsSchema>
