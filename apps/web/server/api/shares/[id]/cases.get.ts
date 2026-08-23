import { getRouterParam } from 'h3'
import { databaseError } from '../../../utils/app-error'
import { requireBoardRole } from '../../../utils/boards'
import { boardPreviewForCollection } from '../../../utils/public-collections'
import { publicCollectionFiltersSchema } from '@content-library/shared'
import { requireAuth } from '../../../utils/session'

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  const id = getRouterParam(event, 'id') ?? ''
  const { collection } = await requireBoardRole(id, session.user.organization_id, session.user.id, ['owner', 'editor', 'viewer'], session.user.role)
  if (collection.purpose !== 'portfolio') throw createError({ statusCode: 409, statusMessage: 'This board is not a portfolio edition.' })
  const db = useSupabaseAdmin()
  const { data: cases, error } = await db.from('public_collections')
    .select('id,title,purpose,mode,filters,organization_id')
    .eq('organization_id', session.user.organization_id)
    .neq('purpose', 'portfolio')
    .neq('id', id)
    .order('created_at')
  if (error) throw databaseError('list portfolio cases', error)
  const { data: links, error: linkError } = await db.from('portfolio_edition_cases')
    .select('case_id,position').eq('edition_id', id).eq('organization_id', session.user.organization_id).order('position')
  if (linkError) throw databaseError('read portfolio case order', linkError)
  const selectedIds = links.map((link: { case_id: string }) => link.case_id)
  const enriched = await Promise.all(cases.map(async (item: { id:string; title:string; purpose:'showcase'|'review'|'case'; mode:'dynamic'|'static'; filters:unknown; organization_id:string }) => ({
    id: item.id,
    title: item.title,
    ...await boardPreviewForCollection({ ...item, filters: publicCollectionFiltersSchema.parse(item.filters) })
  })))
  const order = new Map<string, number>(selectedIds.map((caseId: string, index: number) => [caseId, index]))
  return { data: { cases: enriched, selectedIds, selectedCases: enriched.filter(item => order.has(item.id)).sort((a, b) => order.get(a.id)! - order.get(b.id)!) } }
})
