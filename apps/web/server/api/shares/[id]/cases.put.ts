import { z } from 'zod'
import { getRouterParam, readBody } from 'h3'
import { appError, databaseError } from '../../../utils/app-error'
import { requireBoardRole } from '../../../utils/boards'
import { requireTrustedMutation } from '../../../utils/request-security'
import { requireAuth } from '../../../utils/session'

const schema = z.object({ caseIds: z.array(z.uuid()).max(100).refine(ids => new Set(ids).size === ids.length) })

export default defineEventHandler(async (event) => {
  requireTrustedMutation(event)
  const session = await requireAuth(event)
  const id = getRouterParam(event, 'id') ?? ''
  const parsed = schema.safeParse(await readBody(event))
  if (!parsed.success) throw appError(400, 'INVALID_CASE_ORDER', 'Choose valid portfolio cases.')
  const { collection } = await requireBoardRole(id, session.user.organization_id, session.user.id, ['owner', 'editor'], session.user.role)
  if (collection.purpose !== 'portfolio') throw appError(409, 'NOT_PORTFOLIO', 'This board is not a portfolio edition.')
  const db = useSupabaseAdmin()
  if (parsed.data.caseIds.length) {
    const { data: cases, error } = await db.from('public_collections').select('id').eq('organization_id', session.user.organization_id).eq('purpose', 'case').in('id', parsed.data.caseIds)
    if (error) throw databaseError('validate portfolio cases', error)
    if (cases.length !== parsed.data.caseIds.length) throw appError(400, 'INVALID_CASE', 'One or more cases are unavailable.')
  }
  const { error: clearError } = await db.from('portfolio_edition_cases').delete().eq('edition_id', id).eq('organization_id', session.user.organization_id)
  if (clearError) throw databaseError('clear portfolio case order', clearError)
  if (parsed.data.caseIds.length) {
    const { error } = await db.from('portfolio_edition_cases').insert(parsed.data.caseIds.map((caseId, position) => ({ edition_id:id, case_id:caseId, organization_id:session.user.organization_id, position })))
    if (error) throw databaseError('save portfolio case order', error)
  }
  return { data: { caseIds: parsed.data.caseIds } }
})
