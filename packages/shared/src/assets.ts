import { z } from 'zod'

export const assetStatusSchema = z.enum(['draft', 'approved', 'archived'])
export const imageFormatSchema = z.enum(['png', 'jpg'])
export const isoDateSchema = z.iso.datetime({ offset: true })

export const assetMetadataSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5_000).nullable(),
  tags: z.array(z.string().trim().min(1).max(80)).max(50),
  projectId: z.uuid().nullable(),
  campaignId: z.uuid().nullable(),
  language: z.string().trim().min(2).max(35).nullable(),
  contentType: z.string().trim().min(1).max(80).nullable(),
  status: assetStatusSchema
})

export const assetSchema = assetMetadataSchema.extend({
  id: z.uuid(),
  organizationId: z.uuid(),
  uploadedBy: z.uuid(),
  imagePath: z.string().min(1),
  thumbnailPath: z.string().min(1).nullable(),
  mimeType: z.enum(['image/png', 'image/jpeg']),
  fileSize: z.number().int().positive(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  imageFormat: imageFormatSchema,
  figmaFileKey: z.string().min(1),
  figmaNodeId: z.string().min(1),
  figmaNodeName: z.string().min(1),
  figmaUrl: z.url(),
  version: z.number().int().positive(),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema
})

export type AssetStatus = z.infer<typeof assetStatusSchema>
export type AssetMetadata = z.infer<typeof assetMetadataSchema>
export type Asset = z.infer<typeof assetSchema>

export const assetListQuerySchema = z.object({
  search: z.string().trim().max(200).default(''),
  status: assetStatusSchema.optional(),
  projectId: z.uuid().optional(),
  tagId: z.uuid().optional(),
  projectIds: z.string().transform(value => value.split(',').filter(Boolean)).pipe(z.array(z.uuid()).max(50)).optional(),
  tagIds: z.string().transform(value => value.split(',').filter(Boolean)).pipe(z.array(z.uuid()).max(50)).optional(),
  dateFrom: isoDateSchema.optional(),
  dateTo: isoDateSchema.optional(),
  language: z.string().trim().max(35).optional(),
  contentType: z.string().trim().max(80).optional(),
  mine: z.enum(['true', 'false']).transform(value => value === 'true').optional(),
  sort: z.enum(['newest', 'oldest', 'updated', 'title', 'dimensions', 'submitter']).default('newest'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(60).default(24)
}).refine(value => !value.dateFrom || !value.dateTo || value.dateFrom <= value.dateTo, {
  message: 'The start date must be before the end date.', path: ['dateTo']
})

export const assetUploadFieldsSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5_000).default(''),
  tags: z.array(z.string().trim().min(1).max(80)).max(50).default([]),
  projectId: z.uuid().nullable().default(null),
  campaignId: z.uuid().nullable().default(null),
  language: z.string().trim().min(2).max(35).nullable().default(null),
  contentType: z.string().trim().min(1).max(80).nullable().default(null),
  status: assetStatusSchema.default('draft'),
  figmaFileKey: z.string().trim().min(1).max(200),
  figmaNodeId: z.string().trim().min(1).max(200),
  figmaNodeName: z.string().trim().min(1).max(500),
  figmaUrl: z.url()
})

export const assetUpdateSchema = assetMetadataSchema.partial()
  .refine(value => Object.keys(value).length > 0, 'Provide at least one change.')
export const assetVersionFieldsSchema = assetUploadFieldsSchema.omit({ status: true }).extend({ assetId: z.uuid() })
