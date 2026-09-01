import { getRouterParam } from 'h3'
import { databaseError } from '../../../utils/app-error'
import { requireBoardRole } from '../../../utils/boards'
import { boardPreviewForCollection } from '../../../utils/public-collections'
import { publicCollectionFiltersSchema } from '@content-library/shared'
import { requireAuth } from '../../../utils/session'

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  const requestQuery = getQuery(event)
  const includePreviews = requestQuery.previews !== 'false'
  const includeLinkedPreviews = requestQuery.previews === 'true'
  const linksOnly = requestQuery.linksOnly === 'true'
  const previewCaseId = typeof requestQuery.previewCaseId === 'string' ? requestQuery.previewCaseId : ''
  const previewOffset = Math.max(0, Number.parseInt(String(requestQuery.previewOffset ?? '0'), 10) || 0)
  const previewLimit = Math.min(24, Math.max(1, Number.parseInt(String(requestQuery.previewLimit ?? '8'), 10) || 8))
  const id = getRouterParam(event, 'id') ?? ''
  const { collection } = await requireBoardRole(id, session.user.organization_id, session.user.id, ['owner', 'editor', 'viewer'], session.user.role)
  if (collection.purpose !== 'portfolio') throw createError({ statusCode: 409, statusMessage: 'This board is not a portfolio edition.' })
  const db = useSupabaseAdmin()
  const { data: links, error: linkError } = await db.from('portfolio_edition_cases')
    .select('case_id,position,display_title,description').eq('edition_id', id).eq('organization_id', session.user.organization_id).order('position')
  if (linkError) throw databaseError('read portfolio case order', linkError)
  const selectedIds = links.map((link: { case_id: string }) => link.case_id)
  const selectedCaseDetails = links.map((link: { case_id: string; display_title: string | null; description: string | null }) => ({
    caseId: link.case_id,
    title: link.display_title,
    description: link.description
  }))
  if (previewCaseId) {
    if (!selectedIds.includes(previewCaseId)) throw createError({ statusCode: 404, statusMessage: 'Portfolio board not found.' })
    const { data: previewCase, error: previewCaseError } = await db.from('public_collections')
      .select('id,title,purpose,mode,filters,asset_scope,organization_id')
      .eq('organization_id', session.user.organization_id)
      .eq('id', previewCaseId)
      .single()
    if (previewCaseError) throw databaseError('load portfolio board previews', previewCaseError)
    const preview = await boardPreviewForCollection({
      ...previewCase,
      filters: publicCollectionFiltersSchema.parse(previewCase.filters)
    }, { includePreviews: true, previewLimit, previewOffset })
    return { data: { caseId: previewCaseId, itemCount: preview.itemCount, previewAssets: preview.previewAssets } }
  }
  if (linksOnly) {
    if (!includeLinkedPreviews || !selectedIds.length) return { data: { selectedIds, selectedCases: selectedCaseDetails } }
    const { data: selectedCases, error: selectedCasesError } = await db.from('public_collections')
      .select('id,title,purpose,mode,filters,asset_scope,organization_id')
      .eq('organization_id', session.user.organization_id)
      .in('id', selectedIds)
    if (selectedCasesError) throw databaseError('load portfolio case previews', selectedCasesError)
    const details = new Map<string, { caseId: string; title: string | null; description: string | null }>(selectedCaseDetails.map((item: { caseId: string; title: string | null; description: string | null }) => [item.caseId, item]))
    const order = new Map<string, number>(selectedIds.map((caseId: string, index: number) => [caseId, index]))
    const enriched = await Promise.all(selectedCases.map(async (item: { id:string; title:string; purpose:'showcase'|'review'|'case'; mode:'dynamic'|'static'; filters:unknown; asset_scope:'approved'|'all'; organization_id:string }) => {
      const preview = await boardPreviewForCollection({ ...item, filters: publicCollectionFiltersSchema.parse(item.filters) }, { includePreviews: true, previewLimit })
      return {
        caseId: item.id,
        ...details.get(item.id),
        itemCount: preview.itemCount,
        previewAssets: preview.previewAssets
      }
    }))
    enriched.sort((first, second) => (order.get(first.caseId) ?? Number.MAX_SAFE_INTEGER) - (order.get(second.caseId) ?? Number.MAX_SAFE_INTEGER))
    return { data: { selectedIds, selectedCases: enriched } }
  }

  const { data: cases, error } = await db.from('public_collections')
    .select('id,title,purpose,mode,filters,asset_scope,organization_id')
    .eq('organization_id', session.user.organization_id)
    .neq('purpose', 'portfolio')
    .neq('id', id)
    .order('created_at')
  if (error) throw databaseError('list portfolio cases', error)
  const enriched = await Promise.all(cases.map(async (item: { id:string; title:string; purpose:'showcase'|'review'|'case'; mode:'dynamic'|'static'; filters:unknown; asset_scope:'approved'|'all'; organization_id:string }) => ({
    id: item.id,
    title: item.title,
    ...await boardPreviewForCollection({ ...item, filters: publicCollectionFiltersSchema.parse(item.filters) }, { includePreviews })
  })))
  const order = new Map<string, number>(selectedIds.map((caseId: string, index: number) => [caseId, index]))
  const details = new Map<string, { caseId: string; title: string | null; description: string | null }>(selectedCaseDetails.map((item: { caseId: string; title: string | null; description: string | null }) => [item.caseId, item]))
  return { data: { cases: enriched, selectedIds, selectedCases: enriched.filter(item => order.has(item.id)).sort((a, b) => order.get(a.id)! - order.get(b.id)!).map(item => ({ ...item, ...(details.get(item.id) ?? {}) })) } }
})
