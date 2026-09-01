import { z } from 'zod'
import { getRouterParam, readBody } from 'h3'
import { appError, databaseError } from '../../../utils/app-error'
import { requireBoardRole } from '../../../utils/boards'
import { requireTrustedMutation } from '../../../utils/request-security'
import { requireAuth } from '../../../utils/session'

const portfolioCaseSchema = z.object({
  caseId: z.uuid(),
  title: z.string().trim().max(120).nullable().default(null),
  description: z.string().trim().max(1000).nullable().default(null)
})
const schema = z.object({
  cases: z.array(portfolioCaseSchema).max(100).refine(items => new Set(items.map(item => item.caseId)).size === items.length)
})

export default defineEventHandler(async (event) => {
  requireTrustedMutation(event)
  const session = await requireAuth(event)
  const id = getRouterParam(event, 'id') ?? ''
  const parsed = schema.safeParse(await readBody(event))
  if (!parsed.success) throw appError(400, 'INVALID_CASE_ORDER', 'Choose valid portfolio cases.')
  const { collection } = await requireBoardRole(id, session.user.organization_id, session.user.id, ['owner', 'editor'], session.user.role)
  if (collection.purpose !== 'portfolio') throw appError(409, 'NOT_PORTFOLIO', 'This board is not a portfolio edition.')
  const db = useSupabaseAdmin()
  const caseIds = parsed.data.cases.map(item => item.caseId)
  if (caseIds.length) {
    const { data: cases, error } = await db.from('public_collections').select('id').eq('organization_id', session.user.organization_id).neq('purpose', 'portfolio').in('id', caseIds)
    if (error) throw databaseError('validate portfolio cases', error)
    if (cases.length !== caseIds.length) throw appError(400, 'INVALID_CASE', 'One or more cases are unavailable.')
  }
  const { error: clearError } = await db.from('portfolio_edition_cases').delete().eq('edition_id', id).eq('organization_id', session.user.organization_id)
  if (clearError) throw databaseError('clear portfolio case order', clearError)
  if (parsed.data.cases.length) {
    const { error } = await db.from('portfolio_edition_cases').insert(parsed.data.cases.map((item, position) => ({
      edition_id: id,
      case_id: item.caseId,
      organization_id: session.user.organization_id,
      position,
      display_title: item.title || null,
      description: item.description || null
    })))
    if (error) throw databaseError('save portfolio case order', error)
  }
  return { data: { cases: parsed.data.cases } }
})
