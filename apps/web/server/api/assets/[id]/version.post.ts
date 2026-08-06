import { getRouterParam, readMultipartFormData } from 'h3'
import sharp from 'sharp'
import { assetUploadFieldsSchema } from '@content-library/shared'
import { appError, databaseError } from '../../../utils/app-error'
import { requireAsset } from '../../../utils/assets'
import { writeAuditLog } from '../../../utils/audit'
import { requireRole } from '../../../utils/session'
import { expectedSharpFormat, isAllowedUploadMime } from '../../../utils/upload-validation'
import { rateLimit, requireTrustedMutation } from '../../../utils/request-security'
import { canManageAsset } from '../../../utils/authorization'

export default defineEventHandler(async (event) => {
  rateLimit(event, 'asset-version-upload', 30, 60_000)
  requireTrustedMutation(event)
  const session = await requireRole(event, ['contributor', 'editor', 'admin'])
  const id = getRouterParam(event, 'id')
  if (!id) throw appError(400, 'INVALID_ASSET_ID', 'Asset ID is required.')
  const current = await requireAsset(id, session.user.organization_id)
  if (!canManageAsset(session.user.role, session.user.id, current.uploaded_by, 'edit')) throw appError(403, 'FORBIDDEN', 'You can replace only assets you are allowed to edit.')
  const parts = await readMultipartFormData(event)
  const file = parts?.find(part => part.name === 'file' && part.filename)
  const metadataPart = parts?.find(part => part.name === 'metadata')
  if (!file?.data || !metadataPart?.data || !file.type || !isAllowedUploadMime(file.type)) throw appError(400, 'INVALID_UPLOAD', 'Choose a PNG or JPG and provide metadata.')
  if (file.data.byteLength > Number(useRuntimeConfig().maxUploadBytes)) throw appError(413, 'FILE_TOO_LARGE', 'The replacement exceeds the upload limit.')
  let raw: unknown
  try { raw = JSON.parse(metadataPart.data.toString('utf8')) } catch { throw appError(400, 'INVALID_METADATA', 'Check the asset metadata.') }
  const parsed = assetUploadFieldsSchema.safeParse(raw)
  if (!parsed.success) throw appError(400, 'INVALID_METADATA', 'Check the asset metadata.', parsed.error.flatten())
  const image = sharp(file.data, { failOn: 'error' }); const info = await image.metadata().catch(() => null)
  if (!info?.width || !info.height || info.format !== expectedSharpFormat(file.type)) throw appError(415, 'INVALID_IMAGE', 'The replacement is not a valid PNG or JPG.')
  const version = current.version + 1
  const extension = file.type === 'image/png' ? 'png' : 'jpg'
  const basePath = `${session.user.organization_id}/${id}/versions/${version}`
  const imagePath = `${basePath}/original.${extension}`; const thumbnailPath = `${basePath}/thumbnail.webp`; const thumbnail2xPath = `${basePath}/thumbnail@2x.webp`
  const [thumbnail, thumbnail2x] = await Promise.all([
    image.clone().resize({ width: 640, withoutEnlargement: true }).webp({ quality: 100 }).toBuffer(),
    image.clone().resize({ width: 1280, withoutEnlargement: true }).webp({ quality: 100 }).toBuffer()
  ])
  const bucket = useSupabaseAdmin().storage.from('assets')
  const originalUpload = await bucket.upload(imagePath, file.data, { contentType: file.type, upsert: false })
  if (originalUpload.error) throw databaseError('upload replacement', originalUpload.error)
  const thumbnailUpload = await bucket.upload(thumbnailPath, thumbnail, { contentType: 'image/webp', upsert: false })
  if (thumbnailUpload.error) { await bucket.remove([imagePath]); throw databaseError('upload replacement thumbnail', thumbnailUpload.error) }
  const thumbnail2xUpload = await bucket.upload(thumbnail2xPath, thumbnail2x, { contentType: 'image/webp', upsert: false })
  if (thumbnail2xUpload.error) { await bucket.remove([imagePath, thumbnailPath]); throw databaseError('upload retina replacement thumbnail', thumbnail2xUpload.error) }
  const metadata = parsed.data
  const update = { image_path: imagePath, thumbnail_path: thumbnailPath, thumbnail_2x_path: thumbnail2xPath, mime_type: file.type, file_size: file.data.byteLength, width: info.width, height: info.height, image_format: extension, figma_file_key: metadata.figmaFileKey, figma_node_id: metadata.figmaNodeId, figma_node_name: metadata.figmaNodeName, figma_url: metadata.figmaUrl, version, status: 'draft' }
  const db = useSupabaseAdmin()
  const { error: versionError } = await db.from('asset_versions').insert({ organization_id: session.user.organization_id, asset_id: id, version, image_path: imagePath, thumbnail_path: thumbnailPath, thumbnail_2x_path: thumbnail2xPath, mime_type: file.type, file_size: file.data.byteLength, width: info.width, height: info.height, metadata, created_by: session.user.id })
  if (versionError) { await bucket.remove([imagePath, thumbnailPath, thumbnail2xPath]); throw databaseError('create asset version', versionError) }
  const { data: asset, error } = await db.from('assets').update(update).eq('id', id).eq('organization_id', session.user.organization_id).eq('version', current.version).select('*').single()
  if (error) { await db.from('asset_versions').delete().eq('asset_id', id).eq('version', version); await bucket.remove([imagePath, thumbnailPath, thumbnail2xPath]); throw databaseError('activate asset version', error) }
  await writeAuditLog(session.user.organization_id, session.user.id, 'upload', 'asset', id, { version, replacement: true })
  return { data: { asset } }
})
