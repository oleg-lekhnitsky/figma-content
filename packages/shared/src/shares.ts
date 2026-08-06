import { z } from 'zod'

export const publicCollectionFiltersSchema = z.object({
  search: z.string().trim().max(200).default(''),
  projectId: z.uuid().nullable().default(null),
  tagId: z.uuid().nullable().default(null),
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
  z.object({ action: z.literal('refresh') }),
  z.object({ action: z.literal('revoke') })
])

export type PublicCollectionFilters = z.infer<typeof publicCollectionFiltersSchema>
