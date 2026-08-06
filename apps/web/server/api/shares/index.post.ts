import { createPublicCollectionSchema } from '@content-library/shared'
import { readBody } from 'h3'
import { appError, databaseError } from '../../utils/app-error'
import { replaceCollectionSnapshot } from '../../utils/public-collections'
import { requireRole } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const session = await requireRole(event, ['editor', 'admin'])
  const parsed = createPublicCollectionSchema.safeParse(await readBody(event))
  if (!parsed.success) throw appError(400, 'INVALID_COLLECTION', 'Check the collection settings and try again.', parsed.error.flatten())
  const input = parsed.data
  const db = useSupabaseAdmin()
  const { data, error } = await db.from('public_collections').insert({
    organization_id: session.user.organization_id,
    created_by: session.user.id,
    title: input.title,
    mode: input.mode,
    filters: input.filters,
    expires_at: input.expiresAt
  }).select('id,slug,title,mode,filters,expires_at,created_at,updated_at').single()
  if (error) throw databaseError('create public collection', error)
  let itemCount: number | null = null
  if (input.mode === 'static') itemCount = await replaceCollectionSnapshot(data.id, session.user.organization_id, input.filters)
  return { data: { collection: { ...data, itemCount } } }
})
