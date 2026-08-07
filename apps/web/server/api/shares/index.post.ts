import { createPublicCollectionSchema } from '@content-library/shared'
import { readBody } from 'h3'
import { appError, databaseError } from '../../utils/app-error'
import { replaceCollectionSnapshot } from '../../utils/public-collections'
import { requireRole } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const session = await requireRole(event, ['contributor', 'editor', 'admin'])
  const parsed = createPublicCollectionSchema.safeParse(await readBody(event))
  if (!parsed.success) throw appError(400, 'INVALID_COLLECTION', 'Check the collection settings and try again.', parsed.error.flatten())
  const input = parsed.data
  const filters = session.user.role === 'contributor' ? { ...input.filters, uploadedBy: session.user.id } : input.filters
  const db = useSupabaseAdmin()
  const { data, error } = await db.from('public_collections').insert({
    organization_id: session.user.organization_id,
    created_by: session.user.id,
    title: input.title,
    mode: input.mode,
    content_strategy: input.mode === 'dynamic' ? 'dynamic' : 'snapshot',
    publication_enabled: true,
    filters,
    expires_at: input.expiresAt
  }).select('id,slug,title,mode,filters,expires_at,publication_enabled,content_strategy,created_at,updated_at').single()
  if (error) throw databaseError('create public collection', error)
  const { error: ownerError } = await db.from('public_collection_members').insert({
    collection_id: data.id, organization_id: session.user.organization_id,
    user_id: session.user.id, role: 'owner', invited_by: session.user.id
  })
  if (ownerError) {
    await db.from('public_collections').delete().eq('id', data.id).eq('organization_id', session.user.organization_id)
    throw databaseError('create board owner', ownerError)
  }
  let itemCount: number | null = null
  if (input.mode === 'static') itemCount = await replaceCollectionSnapshot(data.id, session.user.organization_id, filters, session.user.id)
  return { data: { collection: { ...data, role: 'owner', itemCount } } }
})
