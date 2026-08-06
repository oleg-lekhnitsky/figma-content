import { readMultipartFormData } from 'h3'
import sharp from 'sharp'
import { assetUploadFieldsSchema } from '@content-library/shared'
import { appError, databaseError } from '../../utils/app-error'
import { slugify } from '../../utils/assets'
import { requireRole } from '../../utils/session'
import { rateLimit, requireTrustedMutation } from '../../utils/request-security'
import { expectedSharpFormat, isAllowedUploadMime } from '../../utils/upload-validation'

export default defineEventHandler(async (event) => {
  rateLimit(event, 'asset-upload', 30, 60_000)
  requireTrustedMutation(event)
  const session = await requireRole(event, ['contributor', 'editor', 'admin'])
  const parts = await readMultipartFormData(event)
  const file = parts?.find(part => part.name === 'file' && part.filename)
  const metadataPart = parts?.find(part => part.name === 'metadata')
  if (!file?.data || !metadataPart?.data) throw appError(400, 'INVALID_UPLOAD', 'Choose an image and provide its metadata.')
  const maxBytes = Number(useRuntimeConfig().maxUploadBytes)
  if (file.data.byteLength > maxBytes) throw appError(413, 'FILE_TOO_LARGE', `Choose an image smaller than ${Math.floor(maxBytes / 1_048_576)} MB.`)
  if (!file.type || !isAllowedUploadMime(file.type)) throw appError(415, 'INVALID_MIME_TYPE', 'Upload a PNG or JPG image.')

  let rawMetadata: unknown
  try { rawMetadata = JSON.parse(metadataPart.data.toString('utf8')) } catch { throw appError(400, 'INVALID_METADATA', 'Check the asset metadata and try again.') }
  const parsed = assetUploadFieldsSchema.safeParse(rawMetadata)
  if (!parsed.success) throw appError(400, 'INVALID_METADATA', 'Check the asset metadata and try again.', parsed.error.flatten())
  const metadata = parsed.data
  const image = sharp(file.data, { failOn: 'error' })
  const info = await image.metadata().catch(() => null)
  const expectedFormat = expectedSharpFormat(file.type)
  if (!info?.width || !info.height || info.format !== expectedFormat) throw appError(415, 'INVALID_IMAGE', 'The file contents do not match a valid PNG or JPG image.')

  const assetId = crypto.randomUUID()
  const extension = file.type === 'image/png' ? 'png' : 'jpg'
  const basePath = `${session.user.organization_id}/${assetId}`
  const imagePath = `${basePath}/original.${extension}`
  const thumbnailPath = `${basePath}/thumbnail.webp`
  const thumbnail2xPath = `${basePath}/thumbnail@2x.webp`
  const [thumbnail, thumbnail2x] = await Promise.all([
    image.clone().resize({ width: 640, withoutEnlargement: true }).webp({ quality: 100 }).toBuffer(),
    image.clone().resize({ width: 1280, withoutEnlargement: true }).webp({ quality: 100 }).toBuffer()
  ])
  const bucket = useSupabaseAdmin().storage.from('assets')
  const originalUpload = await bucket.upload(imagePath, file.data, { contentType: file.type, upsert: false })
  if (originalUpload.error) throw databaseError('upload original asset', originalUpload.error)
  const thumbnailUpload = await bucket.upload(thumbnailPath, thumbnail, { contentType: 'image/webp', upsert: false })
  if (thumbnailUpload.error) {
    await bucket.remove([imagePath])
    throw databaseError('upload asset thumbnail', thumbnailUpload.error)
  }
  const thumbnail2xUpload = await bucket.upload(thumbnail2xPath, thumbnail2x, { contentType: 'image/webp', upsert: false })
  if (thumbnail2xUpload.error) {
    await bucket.remove([imagePath, thumbnailPath])
    throw databaseError('upload retina asset thumbnail', thumbnail2xUpload.error)
  }

  const db = useSupabaseAdmin()
  const status = session.user.role === 'contributor' ? 'draft' : metadata.status
  const { data: asset, error } = await db.from('assets').insert({
    id: assetId, organization_id: session.user.organization_id, title: metadata.title,
    description: metadata.description || null, uploaded_by: session.user.id, image_path: imagePath,
    thumbnail_path: thumbnailPath, thumbnail_2x_path: thumbnail2xPath, mime_type: file.type, file_size: file.data.byteLength,
    width: info.width, height: info.height, image_format: extension, figma_file_key: metadata.figmaFileKey,
    figma_node_id: metadata.figmaNodeId, figma_node_name: metadata.figmaNodeName, figma_url: metadata.figmaUrl,
    project_id: metadata.projectId, campaign_id: metadata.campaignId, language: metadata.language,
    content_type: metadata.contentType, status
  }).select('*').single()
  if (error) {
    await bucket.remove([imagePath, thumbnailPath, thumbnail2xPath])
    throw databaseError('create asset', error)
  }
  await db.from('asset_versions').insert({
    organization_id: session.user.organization_id, asset_id: assetId, version: 1, image_path: imagePath,
    thumbnail_path: thumbnailPath, thumbnail_2x_path: thumbnail2xPath, mime_type: file.type, file_size: file.data.byteLength,
    width: info.width, height: info.height, metadata, created_by: session.user.id
  })
  for (const name of metadata.tags) {
    const slug = slugify(name)
    if (!slug) continue
    const { data: tag } = await db.from('tags').upsert({ organization_id: session.user.organization_id, name, slug }, { onConflict: 'organization_id,slug' }).select('id').single()
    if (tag) await db.from('asset_tags').upsert({ organization_id: session.user.organization_id, asset_id: assetId, tag_id: tag.id })
  }
  await db.from('audit_logs').insert({ organization_id: session.user.organization_id, actor_id: session.user.id, action: 'upload', target_type: 'asset', target_id: assetId, metadata: { title: asset.title } })
  return { data: { asset } }
})
