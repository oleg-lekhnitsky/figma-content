import { DeleteObjectsCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { appError, databaseError } from './app-error'

const R2_PREFIX = 'r2:'

const r2Config = () => {
  const config = useRuntimeConfig()
  const accountId = String(config.r2AccountId || '')
  const endpoint = String(config.r2Endpoint || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : ''))
  const accessKeyId = String(config.r2AccessKeyId || '')
  const secretAccessKey = String(config.r2SecretAccessKey || '')
  const bucket = String(config.r2Bucket || '')

  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
    throw appError(503, 'R2_NOT_CONFIGURED', 'Media storage is not configured.')
  }

  return { endpoint, accessKeyId, secretAccessKey, bucket }
}

const r2Client = () => {
  const config = r2Config()
  return {
    bucket: config.bucket,
    client: new S3Client({
      region: 'auto',
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey
      }
    })
  }
}

export const r2AssetPath = (key: string) => `${R2_PREFIX}${key}`
export const isR2AssetPath = (path: string) => path.startsWith(R2_PREFIX)
const r2Key = (path: string) => path.slice(R2_PREFIX.length)

export const uploadAssetObject = async (path: string, body: Uint8Array, contentType: string) => {
  if (!isR2AssetPath(path)) throw appError(500, 'INVALID_STORAGE_PATH', 'The media storage path is invalid.')
  const { client, bucket } = r2Client()
  try {
    await client.send(new PutObjectCommand({ Bucket: bucket, Key: r2Key(path), Body: body, ContentType: contentType }))
  } catch (error) {
    throw databaseError('upload media to R2', error)
  }
}

export const signedAssetObjectUrl = async (path: string, expiresIn = 900) => {
  if (!isR2AssetPath(path)) {
    const { data, error } = await useSupabaseAdmin().storage.from('assets').createSignedUrl(path, expiresIn)
    if (error) throw databaseError('sign asset URL', error)
    return data.signedUrl
  }

  const { client, bucket } = r2Client()
  try {
    return await getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: r2Key(path) }), { expiresIn })
  } catch (error) {
    throw databaseError('sign R2 asset URL', error)
  }
}

export const removeAssetObjects = async (paths: string[]) => {
  const uniquePaths = [...new Set(paths.filter(Boolean))]
  const r2Paths = uniquePaths.filter(isR2AssetPath)
  const supabasePaths = uniquePaths.filter(path => !isR2AssetPath(path))

  if (r2Paths.length) {
    const { client, bucket } = r2Client()
    try {
      await client.send(new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: r2Paths.map(path => ({ Key: r2Key(path) })), Quiet: true }
      }))
    } catch (error) {
      throw databaseError('remove media from R2', error)
    }
  }

  if (supabasePaths.length) {
    const { error } = await useSupabaseAdmin().storage.from('assets').remove(supabasePaths)
    if (error) throw databaseError('remove media from Supabase Storage', error)
  }
}
