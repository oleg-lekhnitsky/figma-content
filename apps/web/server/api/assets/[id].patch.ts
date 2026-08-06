import { getRouterParam, readValidatedBody } from 'h3'
import { assetUpdateSchema } from '@content-library/shared'
import { appError, databaseError } from '../../utils/app-error'
import { requireAsset, slugify } from '../../utils/assets'
import { writeAuditLog } from '../../utils/audit'
import { requireRole } from '../../utils/session'
import { requireTrustedMutation } from '../../utils/request-security'
import { canManageAsset } from '../../utils/authorization'

export default defineEventHandler(async (event) => {
  requireTrustedMutation(event)
  const session = await requireRole(event, ['contributor', 'editor', 'admin'])
  const id = getRouterParam(event, 'id')
  if (!id) throw appError(400, 'INVALID_ASSET_ID', 'Asset ID is required.')
  const asset = await requireAsset(id, session.user.organization_id)
  const input = await readValidatedBody(event, body => assetUpdateSchema.safeParse(body))
  if (!input.success) throw appError(400, 'INVALID_ASSET', 'Check the asset details and try again.', input.error.flatten())
  const requestedAction = input.data.status === 'approved' ? 'approve' : input.data.status === 'archived' ? 'archive' : 'edit'
  if (!canManageAsset(session.user.role, session.user.id, asset.uploaded_by, requestedAction)) throw appError(403, 'FORBIDDEN', 'You do not have permission to update this asset.')
  const { tags, ...fields } = input.data
  const update = Object.fromEntries(Object.entries(fields).map(([key, value]) => [key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`), value]))
  const { data, error } = await useSupabaseAdmin().from('assets').update(update).eq('id', id).eq('organization_id', session.user.organization_id).select('*').single()
  if (error) throw databaseError('update asset', error)
  if (tags) {
    const db = useSupabaseAdmin()
    await db.from('asset_tags').delete().eq('asset_id', id).eq('organization_id', session.user.organization_id)
    for (const name of tags) {
      const slug = slugify(name); if (!slug) continue
      const { data: tag } = await db.from('tags').upsert({ organization_id: session.user.organization_id, name, slug }, { onConflict: 'organization_id,slug' }).select('id').single()
      if (tag) await db.from('asset_tags').insert({ organization_id: session.user.organization_id, asset_id: id, tag_id: tag.id })
    }
  }
  await writeAuditLog(session.user.organization_id, session.user.id, requestedAction, 'asset', id, { fields: Object.keys(input.data) })
  return { data: { asset: data } }
})
