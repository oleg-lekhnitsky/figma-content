import { databaseError } from '../../utils/app-error'
import { signedAssetUrl } from '../../utils/assets'
import { requireAuth } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  const { data, error } = await useSupabaseAdmin().from('allowed_users')
    .select('id,role,organization_id,organizations(id,name,slug,created_by)')
    .eq('account_id', session.user.account_id).eq('is_active', true).order('created_at')
  if (error) throw databaseError('list workspaces', error)
  const workspaces = data.map((item: { id:string; role:string; organizations:{ id:string; name:string; slug:string; created_by:string|null } }) => {
    const { created_by: _createdBy, ...organization } = item.organizations
    return { membershipId:item.id, role:item.role, ...organization, canDelete:_createdBy === session.user.account_id }
  })
  const workspacesWithPreviews = await Promise.all(workspaces.map(async (workspace: { membershipId:string; role:string; id:string; name:string; slug:string; canDelete:boolean }) => {
    let query = useSupabaseAdmin().from('assets')
      .select('id,title,thumbnail_path,image_path')
      .eq('organization_id', workspace.id)
      .neq('status', 'archived')
      .not('mime_type', 'like', 'video/%')
      .order('created_at', { ascending: false })
      .limit(4)
    if (workspace.role === 'viewer') query = query.eq('status', 'approved')
    const { data: assets, error: previewError } = await query
    if (previewError) return { ...workspace, previewAssets: [] }
    const previewAssets = (await Promise.all((assets ?? []).map(async (asset: { id:string; title:string; thumbnail_path:string|null; image_path:string }) => {
      try {
        return { id: asset.id, title: asset.title, previewUrl: await signedAssetUrl(asset.thumbnail_path ?? asset.image_path) }
      } catch {
        return null
      }
    }))).filter((asset): asset is { id:string; title:string; previewUrl:string } => Boolean(asset))
    return { ...workspace, previewAssets }
  }))
  const { data: contributors, count: contributorCount, error: contributorError } = await useSupabaseAdmin().from('allowed_users')
    .select('id,email,figma_handle,avatar_url', { count: 'exact' })
    .eq('organization_id', session.user.organization_id)
    .eq('is_active', true)
    .in('role', ['contributor', 'editor', 'admin'])
    .order('created_at')
    .limit(6)
  if (contributorError) throw databaseError('list workspace contributors', contributorError)
  return {
    data: {
      currentId: session.user.organization_id,
      workspaces: workspacesWithPreviews,
      contributors: { items: contributors ?? [], total: contributorCount ?? contributors?.length ?? 0 }
    }
  }
})
