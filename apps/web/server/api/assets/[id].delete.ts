import { getRouterParam } from 'h3'
import { appError, databaseError } from '../../utils/app-error'
import { requireAsset } from '../../utils/assets'
import { writeAuditLog } from '../../utils/audit'
import { requireRole } from '../../utils/session'
import { requireTrustedMutation } from '../../utils/request-security'

export default defineEventHandler(async (event) => {
  requireTrustedMutation(event)
  const session = await requireRole(event, ['admin'])
  const id = getRouterParam(event, 'id')
  if (!id) throw appError(400, 'INVALID_ASSET_ID', 'Asset ID is required.')
  const asset = await requireAsset(id, session.user.organization_id)
  const { data: versions } = await useSupabaseAdmin().from('asset_versions').select('image_path,thumbnail_path').eq('asset_id', id).eq('organization_id', session.user.organization_id)
  const paths = [...new Set([asset.image_path, asset.thumbnail_path, ...(versions ?? []).flatMap((row: { image_path: string, thumbnail_path: string | null }) => [row.image_path, row.thumbnail_path])].filter(Boolean))] as string[]
  const { error } = await useSupabaseAdmin().from('assets').delete().eq('id', id).eq('organization_id', session.user.organization_id)
  if (error) throw databaseError('delete asset', error)
  if (paths.length) await useSupabaseAdmin().storage.from('assets').remove(paths)
  await writeAuditLog(session.user.organization_id, session.user.id, 'delete', 'asset', id, { title: asset.title })
  return { data: { deleted: true } }
})
