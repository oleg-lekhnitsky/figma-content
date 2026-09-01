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
  const filters = session.user.role === 'contributor'
    ? { ...input.filters, uploadedBy: session.user.id, uploadedBys: [session.user.id] }
    : input.filters
  const contentStrategy = input.contentStrategy
    ?? (['review', 'portfolio', 'case'].includes(input.purpose) ? 'manual' : input.mode === 'dynamic' ? 'dynamic' : 'snapshot')
  const db = useSupabaseAdmin()
  if (input.purpose === 'portfolio' && input.portfolioKind === 'main') {
    const { data: existingMain, error: mainError } = await db.from('public_collections')
      .select('id')
      .eq('organization_id', session.user.organization_id)
      .eq('purpose', 'portfolio')
      .eq('portfolio_kind', 'main')
      .limit(1)
      .maybeSingle()
    if (mainError) throw databaseError('check main portfolio', mainError)
    if (existingMain) throw appError(409, 'MAIN_PORTFOLIO_EXISTS', 'This workspace already has a main portfolio. Create a client version instead.')
  }
  const { data, error } = await db.from('public_collections').insert({
    organization_id: session.user.organization_id,
    created_by: session.user.id,
    title: input.title,
    purpose: input.purpose,
    review_month: input.reviewMonth,
    submission_deadline: input.submissionDeadline,
    portfolio_kind: input.purpose === 'portfolio' ? input.portfolioKind : null,
    portfolio_client: input.purpose === 'portfolio' ? input.portfolioClient : null,
    introduction: input.purpose === 'portfolio' ? input.introduction : null,
    contact_heading: input.purpose === 'portfolio' ? input.contactHeading : null,
    contact_links: input.purpose === 'portfolio' ? input.contactLinks : [],
    mode: input.mode,
    layout: input.layout,
    content_strategy: contentStrategy,
    publication_enabled: false,
    filters,
    expires_at: null
  }).select('id,slug,title,purpose,portfolio_kind,portfolio_client,introduction,contact_heading,contact_links,review_month,submission_deadline,mode,filters,expires_at,publication_enabled,content_strategy,asset_scope,layout,created_at,updated_at').single()
  if (error?.code === '23505' && input.purpose === 'portfolio' && input.portfolioKind === 'main') {
    throw appError(409, 'MAIN_PORTFOLIO_EXISTS', 'This workspace already has a main portfolio. Create a client version instead.')
  }
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
  if (contentStrategy === 'snapshot') itemCount = await replaceCollectionSnapshot(data.id, session.user.organization_id, filters, session.user.id)
  return { data: { collection: { ...data, role: 'owner', itemCount } } }
})
