import { getRouterParam, readValidatedBody } from 'h3'
import { z } from 'zod'
import { appError, databaseError } from '../../utils/app-error'
import { slugify } from '../../utils/assets'
import { requireTrustedMutation } from '../../utils/request-security'
import { requireRole } from '../../utils/session'

const schema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  archived: z.boolean().optional()
}).strict().refine(value => value.name !== undefined || value.archived !== undefined, 'Provide a project change.')

export default defineEventHandler(async (event) => {
  requireTrustedMutation(event)
  const session = await requireRole(event, ['editor', 'admin'])
  const id = getRouterParam(event, 'id')
  if (!id) throw appError(400, 'INVALID_PROJECT_ID', 'Project ID is required.')
  const body = await readValidatedBody(event, value => schema.safeParse(value))
  if (!body.success) throw appError(400, 'INVALID_PROJECT', 'Check the project details.', body.error.flatten())
  const update = {
    ...(body.data.name !== undefined ? { name: body.data.name, slug: slugify(body.data.name) } : {}),
    ...(body.data.archived !== undefined ? { archived_at: body.data.archived ? new Date().toISOString() : null } : {})
  }
  const { data, error } = await useSupabaseAdmin().from('projects').update(update)
    .eq('id', id).eq('organization_id', session.user.organization_id)
    .select('id,name,slug,archived_at').maybeSingle()
  if (error) throw databaseError('update project', error)
  if (!data) throw appError(404, 'PROJECT_NOT_FOUND', 'Project not found.')
  return { data: { project: data } }
})
