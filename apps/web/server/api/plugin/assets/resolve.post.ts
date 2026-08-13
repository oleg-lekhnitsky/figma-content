import { readBody } from 'h3'
import { z } from 'zod'
import { appError, databaseError } from '../../../utils/app-error'
import { requireAuth } from '../../../utils/session'
import { rateLimit, requireTrustedMutation } from '../../../utils/request-security'

const schema = z.object({
  refs: z.array(z.object({
    fileKey: z.string().regex(/^[A-Za-z0-9_-]{8,128}$/),
    nodeId: z.string().trim().min(1).max(200)
  })).min(1).max(100)
})

export default defineEventHandler(async (event) => {
  rateLimit(event, 'plugin-asset-resolve', 60, 60_000)
  requireTrustedMutation(event)
  const session = await requireAuth(event)
  const parsed = schema.safeParse(await readBody(event))
  if (!parsed.success) throw appError(400, 'INVALID_ASSET_REFERENCES', 'The selected Figma frames are invalid.')

  const assets: Record<string, string> = {}
  const refsByFile = new Map<string, Set<string>>()
  for (const ref of parsed.data.refs) {
    const nodeIds = refsByFile.get(ref.fileKey) ?? new Set<string>()
    nodeIds.add(ref.nodeId)
    refsByFile.set(ref.fileKey, nodeIds)
  }
  for (const [fileKey, nodeIds] of refsByFile) {
    const { data, error } = await useSupabaseAdmin().from('assets')
      .select('id,figma_file_key,figma_node_id,updated_at')
      .eq('organization_id', session.user.organization_id)
      .eq('figma_file_key', fileKey)
      .in('figma_node_id', [...nodeIds])
      .neq('status', 'archived')
      .order('updated_at', { ascending: false })
    if (error) throw databaseError('resolve plugin assets', error)
    for (const asset of data) {
      const key = `${asset.figma_file_key}:${asset.figma_node_id}`
      if (!assets[key]) assets[key] = asset.id
    }
  }
  return { data: { assets } }
})
