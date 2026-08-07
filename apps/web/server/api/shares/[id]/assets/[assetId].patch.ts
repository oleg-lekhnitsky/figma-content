import { reviewSubmissionSchema } from '@content-library/shared'
import { getRouterParam, readValidatedBody } from 'h3'
import { appError, databaseError } from '../../../../utils/app-error'
import { requireBoardRole } from '../../../../utils/boards'
import { requireTrustedMutation } from '../../../../utils/request-security'
import { requireAuth } from '../../../../utils/session'

export default defineEventHandler(async (event) => {
  requireTrustedMutation(event)
  const session = await requireAuth(event)
  const id = getRouterParam(event, 'id') ?? ''
  const assetId = getRouterParam(event, 'assetId') ?? ''
  const { collection } = await requireBoardRole(
    id,
    session.user.organization_id,
    session.user.id,
    ['owner', 'editor'],
    session.user.role
  )
  if (collection.purpose !== 'review') throw appError(409, 'NOT_REVIEW_BOARD', 'Review status is available only on monthly review boards.')
  const input = await readValidatedBody(event, value => reviewSubmissionSchema.safeParse(value))
  if (!input.success) throw appError(400, 'INVALID_REVIEW_STATUS', 'Choose a valid review status.')
  const reviewed = input.data.status === 'reviewed'
  const { data, error } = await useSupabaseAdmin().from('public_collection_assets').update({
    review_status: input.data.status,
    reviewed_at: reviewed ? new Date().toISOString() : null,
    reviewed_by: reviewed ? session.user.id : null
  }).eq('collection_id', id).eq('asset_id', assetId)
    .select('asset_id,review_status,reviewed_at').maybeSingle()
  if (error) throw databaseError('update review submission status', error)
  if (!data) throw appError(404, 'SUBMISSION_NOT_FOUND', 'Review submission not found.')
  return { data: { submission: data } }
})
