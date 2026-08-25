import { getRouterParam } from 'h3'
import { appError, databaseError } from '../../utils/app-error'
import { requireTrustedMutation } from '../../utils/request-security'
import { createAppSession, requireRole, setWebSessionCookie } from '../../utils/session'
import { removeAssetObjects } from '../../utils/storage'

interface AssetPaths {
  image_path: string
  thumbnail_path: string | null
  thumbnail_2x_path: string | null
}

export default defineEventHandler(async (event) => {
  requireTrustedMutation(event)
  const session = await requireRole(event, ['admin'])
  const id = getRouterParam(event, 'id')
  if (!id) throw appError(400, 'INVALID_WORKSPACE_ID', 'Workspace ID is required.')
  if (id !== session.user.organization_id) throw appError(403, 'FORBIDDEN', 'Switch to this workspace before deleting it.')

  const db = useSupabaseAdmin()
  const { data: workspace, error: workspaceError } = await db.from('organizations')
    .select('id,name,created_by').eq('id', id).maybeSingle()
  if (workspaceError) throw databaseError('find workspace', workspaceError)
  if (!workspace) throw appError(404, 'WORKSPACE_NOT_FOUND', 'Workspace not found.')
  if (workspace.created_by !== session.user.account_id) {
    throw appError(403, 'FORBIDDEN', 'Only the workspace creator can delete this workspace.')
  }

  const { data: nextMembership, error: membershipError } = await db.from('allowed_users')
    .select('id,organization_id')
    .eq('account_id', session.user.account_id)
    .eq('is_active', true)
    .neq('organization_id', id)
    .order('created_at')
    .limit(1)
    .maybeSingle()
  if (membershipError) throw databaseError('find replacement workspace', membershipError)
  if (!nextMembership) {
    throw appError(409, 'LAST_WORKSPACE', 'Create another workspace before deleting this one.')
  }

  const [assetsResult, versionsResult] = await Promise.all([
    db.from('assets').select('image_path,thumbnail_path,thumbnail_2x_path').eq('organization_id', id),
    db.from('asset_versions').select('image_path,thumbnail_path,thumbnail_2x_path').eq('organization_id', id)
  ])
  if (assetsResult.error) throw databaseError('list workspace media', assetsResult.error)
  if (versionsResult.error) throw databaseError('list workspace media versions', versionsResult.error)
  const paths = [...new Set([
    ...((assetsResult.data ?? []) as AssetPaths[]),
    ...((versionsResult.data ?? []) as AssetPaths[])
  ].flatMap(row => [row.image_path, row.thumbnail_path, row.thumbnail_2x_path]).filter(Boolean))] as string[]

  const { error: deleteError } = await db.from('organizations')
    .delete().eq('id', id).eq('created_by', session.user.account_id)
  if (deleteError) throw databaseError('delete workspace', deleteError)

  const nextSession = await createAppSession(nextMembership.id)
  setWebSessionCookie(event, nextSession.token, nextSession.expiresAt)

  try {
    for (let index = 0; index < paths.length; index += 500) {
      await removeAssetObjects(paths.slice(index, index + 500))
    }
  } catch (error) {
    console.error('Unable to remove all deleted workspace media', error)
  }

  return { data: { deleted: true, workspaceId: nextMembership.organization_id } }
})
