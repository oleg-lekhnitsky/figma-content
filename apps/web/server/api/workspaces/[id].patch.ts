import { workspaceUpdateSchema } from '@content-library/shared'
import { getRouterParam, readValidatedBody } from 'h3'
import { appError, databaseError } from '../../utils/app-error'
import { requireTrustedMutation } from '../../utils/request-security'
import { requireRole } from '../../utils/session'

export default defineEventHandler(async (event) => {
  requireTrustedMutation(event)
  const session = await requireRole(event, ['admin'])
  const id = getRouterParam(event, 'id')
  if (!id) throw appError(400, 'INVALID_WORKSPACE_ID', 'Workspace ID is required.')
  if (id !== session.user.organization_id) throw appError(403, 'FORBIDDEN', 'Switch to this workspace before renaming it.')

  const input = await readValidatedBody(event, body => workspaceUpdateSchema.safeParse(body))
  if (!input.success) throw appError(400, 'INVALID_WORKSPACE', 'Enter a workspace name.', input.error.flatten())

  const { data, error } = await useSupabaseAdmin().from('organizations')
    .update({ name: input.data.name })
    .eq('id', id)
    .select('id,name,slug')
    .single()
  if (error) throw databaseError('rename workspace', error)
  return { data: { workspace: data } }
})
