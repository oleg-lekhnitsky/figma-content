import { databaseError } from '../../utils/app-error'
import { requireRole } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const session = await requireRole(event, ['editor', 'admin'])
  const { data, error } = await useSupabaseAdmin().from('projects')
    .select('id,name,slug,archived_at,created_at,assets(count)')
    .eq('organization_id', session.user.organization_id)
    .order('archived_at', { ascending: true, nullsFirst: true })
    .order('name')
  if (error) throw databaseError('manage projects', error)
  return { data: { projects: data.map((project: { assets?: Array<{ count: number }>; [key: string]: unknown }) => ({
    ...project,
    assetCount: project.assets?.[0]?.count ?? 0,
    assets: undefined
  })) } }
})
