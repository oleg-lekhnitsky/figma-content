import { reviewDecisionSchema } from '@content-library/shared'
import { getRouterParam, readValidatedBody } from 'h3'
import { appError, databaseError } from '../../../utils/app-error'
import { writeAuditLog } from '../../../utils/audit'
import { requireBoardRole } from '../../../utils/boards'
import { requireTrustedMutation } from '../../../utils/request-security'
import { requireAuth } from '../../../utils/session'

export default defineEventHandler(async (event) => {
  requireTrustedMutation(event)
  const session = await requireAuth(event)
  const id = getRouterParam(event, 'id') ?? ''
  const { collection } = await requireBoardRole(
    id,
    session.user.organization_id,
    session.user.id,
    ['owner', 'editor'],
    session.user.role
  )
  if (collection.purpose !== 'review') throw appError(409, 'NOT_REVIEW_BOARD', 'Review decisions are available only on monthly review boards.')
  const input = await readValidatedBody(event, value => reviewDecisionSchema.safeParse(value))
  if (!input.success) throw appError(400, 'INVALID_REVIEW_DECISION', 'Choose submissions and a valid review decision.')
  if (input.data.decision === 'approve' && !['editor', 'admin'].includes(session.user.role)) {
    throw appError(403, 'APPROVAL_FORBIDDEN', 'Only workspace editors and admins can approve assets.')
  }

  const db = useSupabaseAdmin()
  const { data: submissions, error: submissionError } = await db.from('public_collection_assets')
    .select('asset_id').eq('collection_id', id).in('asset_id', input.data.assetIds)
  if (submissionError) throw databaseError('read review submissions', submissionError)
  if (submissions.length !== input.data.assetIds.length) throw appError(404, 'SUBMISSION_NOT_FOUND', 'One or more review submissions were not found.')

  if (input.data.decision === 'approve') {
    const { error } = await db.from('assets').update({ status: 'approved' })
      .eq('organization_id', session.user.organization_id).in('id', input.data.assetIds)
    if (error) throw databaseError('approve review assets', error)
    await Promise.all(input.data.assetIds.map(assetId => writeAuditLog(
      session.user.organization_id,
      session.user.id,
      'approve',
      'asset',
      assetId,
      { boardId: id, source: 'review' }
    )))
  }

  const reviewed = input.data.decision !== 'reopen'
  const { error } = await db.from('public_collection_assets').update({
    review_status: reviewed ? 'reviewed' : 'ready',
    reviewed_at: reviewed ? new Date().toISOString() : null,
    reviewed_by: reviewed ? session.user.id : null
  }).eq('collection_id', id).in('asset_id', input.data.assetIds)
  if (error) throw databaseError('save review decisions', error)
  return {
    data: {
      decision: input.data.decision,
      assetIds: input.data.assetIds,
      reviewStatus: reviewed ? 'reviewed' : 'ready',
      assetStatus: input.data.decision === 'approve' ? 'approved' : null
    }
  }
})
