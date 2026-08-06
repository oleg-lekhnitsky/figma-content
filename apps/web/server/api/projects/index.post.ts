import { readValidatedBody } from 'h3'
import { z } from 'zod'
import { appError, databaseError } from '../../utils/app-error'
import { slugify } from '../../utils/assets'
import { requireRole } from '../../utils/session'
import { requireTrustedMutation } from '../../utils/request-security'

const schema = z.object({ name: z.string().trim().min(1).max(120) }).strict()
export default defineEventHandler(async (event) => {
  requireTrustedMutation(event)
  const session = await requireRole(event, ['editor', 'admin'])
  const body = await readValidatedBody(event, value => schema.safeParse(value))
  if (!body.success) throw appError(400, 'INVALID_PROJECT', 'Enter a project name.', body.error.flatten())
  const { data, error } = await useSupabaseAdmin().from('projects').insert({ organization_id: session.user.organization_id, name: body.data.name, slug: slugify(body.data.name) }).select('id,name,slug').single()
  if (error) throw databaseError('create project', error)
  return { data: { project: data } }
})
