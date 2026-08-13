import { readBody } from 'h3'
import { assetUploadFieldsSchema } from '@content-library/shared'
import { z } from 'zod'
import { appError, databaseError } from '../../utils/app-error'
import { canManageAsset } from '../../utils/authorization'
import { requireAsset, slugify } from '../../utils/assets'
import { writeAuditLog } from '../../utils/audit'
import { requireRole } from '../../utils/session'
import { rateLimit, requireTrustedMutation } from '../../utils/request-security'
import { isValidMp4 } from '../../utils/upload-validation'
import { r2AssetPath, removeAssetObjects, uploadAssetObject } from '../../utils/storage'

const requestSchema = z.object({
  fileKey: z.string().regex(/^[A-Za-z0-9_-]{8,128}$/),
  videoHash: z.string().regex(/^[a-f0-9]{40}$/i),
  assetId: z.uuid().nullable().optional(),
  metadata: assetUploadFieldsSchema.extend({
    width: z.number().int().positive(),
    height: z.number().int().positive()
  })
})

const allowedVideoHosts = new Set([
  'www.figma.com',
  's3-figma-videos-production-sig.figma.com',
  's3-videos-eu-production-sig.figma.com',
  's3-videos-au-production-sig.figma.com'
])

const downloadFigmaVideo = async (fileKey: string, videoHash: string) => {
  const resolver = await fetch(`https://www.figma.com/api/files/${encodeURIComponent(fileKey)}/videos/${encodeURIComponent(videoHash)}`)
  if (!resolver.ok) throw appError(502, 'FIGMA_VIDEO_UNAVAILABLE', 'Figma could not resolve the embedded video file.')
  const payload = await resolver.json().catch(() => null) as { meta?: { signed_url?: unknown } } | null
  let sourceUrl: URL
  try { sourceUrl = new URL(String(payload?.meta?.signed_url)) }
  catch { throw appError(502, 'FIGMA_VIDEO_UNAVAILABLE', 'Figma returned an invalid video download path.') }
  if (sourceUrl.protocol !== 'https:' || !allowedVideoHosts.has(sourceUrl.hostname)) {
    throw appError(502, 'FIGMA_VIDEO_UNAVAILABLE', 'Figma returned an invalid video download path.')
  }

  const source = await fetch(sourceUrl, { signal: AbortSignal.timeout(120_000) })
  if (!source.ok) throw appError(502, 'FIGMA_VIDEO_UNAVAILABLE', 'Figma could not download the embedded video file.')
  const mimeType = source.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase()
  if (mimeType !== 'video/mp4') throw appError(415, 'INVALID_VIDEO', 'The embedded Figma video is not an MP4 file.')
  const maxBytes = Number(useRuntimeConfig().maxUploadBytes)
  const declaredBytes = Number(source.headers.get('content-length'))
  if (Number.isFinite(declaredBytes) && declaredBytes > maxBytes) throw appError(413, 'FILE_TOO_LARGE', `Choose a video smaller than ${Math.floor(maxBytes / 1_048_576)} MB.`)
  const bytes = new Uint8Array(await source.arrayBuffer())
  if (bytes.byteLength > maxBytes) throw appError(413, 'FILE_TOO_LARGE', `Choose a video smaller than ${Math.floor(maxBytes / 1_048_576)} MB.`)
  if (!isValidMp4(bytes)) throw appError(415, 'INVALID_VIDEO', 'The embedded Figma video is not a valid MP4 file.')
  return bytes
}

export default defineEventHandler(async (event) => {
  rateLimit(event, 'figma-video-import', 30, 60_000)
  requireTrustedMutation(event)
  const session = await requireRole(event, ['contributor', 'editor', 'admin'])
  const parsed = requestSchema.safeParse(await readBody(event))
  if (!parsed.success) throw appError(400, 'INVALID_VIDEO_REFERENCE', 'The Figma video reference or asset metadata is invalid.', parsed.error.flatten())

  const { fileKey, videoHash, assetId, metadata } = parsed.data
  const bytes = await downloadFigmaVideo(fileKey, videoHash)
  const db = useSupabaseAdmin()

  if (assetId) {
    const current = await requireAsset(assetId, session.user.organization_id)
    if (!canManageAsset(session.user.role, session.user.id, current.uploaded_by, 'edit')) throw appError(403, 'FORBIDDEN', 'You can replace only assets you are allowed to edit.')
    const version = current.version + 1
    const imagePath = r2AssetPath(`${session.user.organization_id}/${assetId}/versions/${version}/original.mp4`)
    await uploadAssetObject(imagePath, bytes, 'video/mp4')
    const { error: versionError } = await db.from('asset_versions').insert({
      organization_id: session.user.organization_id, asset_id: assetId, version, image_path: imagePath,
      thumbnail_path: null, thumbnail_2x_path: null, mime_type: 'video/mp4', file_size: bytes.byteLength,
      width: metadata.width, height: metadata.height, metadata, created_by: session.user.id
    })
    if (versionError) { await removeAssetObjects([imagePath]); throw databaseError('create asset version', versionError) }
    const { data: asset, error } = await db.from('assets').update({
      image_path: imagePath, thumbnail_path: null, thumbnail_2x_path: null, mime_type: 'video/mp4',
      file_size: bytes.byteLength, width: metadata.width, height: metadata.height, image_format: 'mp4',
      figma_file_key: metadata.figmaFileKey, figma_node_id: metadata.figmaNodeId,
      figma_node_name: metadata.figmaNodeName, figma_url: metadata.figmaUrl, version, status: 'draft'
    }).eq('id', assetId).eq('organization_id', session.user.organization_id).eq('version', current.version).select('*').single()
    if (error) {
      await db.from('asset_versions').delete().eq('asset_id', assetId).eq('version', version)
      await removeAssetObjects([imagePath])
      throw databaseError('activate asset version', error)
    }
    await writeAuditLog(session.user.organization_id, session.user.id, 'upload', 'asset', assetId, { version, replacement: true })
    return { data: { asset } }
  }

  const newAssetId = crypto.randomUUID()
  const imagePath = r2AssetPath(`${session.user.organization_id}/${newAssetId}/original.mp4`)
  await uploadAssetObject(imagePath, bytes, 'video/mp4')
  const status = session.user.role === 'contributor' ? 'draft' : metadata.status
  const { data: asset, error } = await db.from('assets').insert({
    id: newAssetId, organization_id: session.user.organization_id, title: metadata.title,
    description: metadata.description || null, uploaded_by: session.user.id, image_path: imagePath,
    thumbnail_path: null, thumbnail_2x_path: null, mime_type: 'video/mp4', file_size: bytes.byteLength,
    width: metadata.width, height: metadata.height, image_format: 'mp4', figma_file_key: metadata.figmaFileKey,
    figma_node_id: metadata.figmaNodeId, figma_node_name: metadata.figmaNodeName, figma_url: metadata.figmaUrl,
    project_id: metadata.projectId, campaign_id: metadata.campaignId, language: metadata.language,
    content_type: metadata.contentType, status
  }).select('*').single()
  if (error) { await removeAssetObjects([imagePath]); throw databaseError('create asset', error) }
  const { error: versionError } = await db.from('asset_versions').insert({
    organization_id: session.user.organization_id, asset_id: newAssetId, version: 1, image_path: imagePath,
    thumbnail_path: null, thumbnail_2x_path: null, mime_type: 'video/mp4', file_size: bytes.byteLength,
    width: metadata.width, height: metadata.height, metadata, created_by: session.user.id
  })
  if (versionError) {
    await db.from('assets').delete().eq('id', newAssetId).eq('organization_id', session.user.organization_id)
    await removeAssetObjects([imagePath])
    throw databaseError('create asset version', versionError)
  }
  for (const name of metadata.tags) {
    const slug = slugify(name)
    if (!slug) continue
    const { data: tag } = await db.from('tags').upsert({ organization_id: session.user.organization_id, name, slug }, { onConflict: 'organization_id,slug' }).select('id').single()
    if (tag) await db.from('asset_tags').upsert({ organization_id: session.user.organization_id, asset_id: newAssetId, tag_id: tag.id })
  }
  await writeAuditLog(session.user.organization_id, session.user.id, 'upload', 'asset', newAssetId, { title: asset.title })
  return { data: { asset } }
})
