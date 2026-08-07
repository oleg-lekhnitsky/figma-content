import { workspaceCreateSchema } from '@content-library/shared'
import { readValidatedBody } from 'h3'
import { appError, databaseError } from '../../utils/app-error'
import { requireTrustedMutation } from '../../utils/request-security'
import { requireAuth } from '../../utils/session'

const slugify = (value:string) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,80) || 'workspace'

export default defineEventHandler(async (event) => {
  requireTrustedMutation(event)
  const session = await requireAuth(event)
  const input = await readValidatedBody(event, body => workspaceCreateSchema.safeParse(body))
  if (!input.success) throw appError(400,'INVALID_WORKSPACE','Enter a workspace name.',input.error.flatten())
  const db = useSupabaseAdmin()
  const slug = `${slugify(input.data.name)}-${crypto.randomUUID().slice(0,8)}`
  const created = await db.from('organizations').insert({ name:input.data.name, slug, created_by:session.user.account_id }).select('id,name,slug').single()
  if (created.error) throw databaseError('create workspace',created.error)
  const membership = await db.from('allowed_users').insert({ organization_id:created.data.id, account_id:session.user.account_id, email:session.user.email, figma_handle:session.user.figma_handle, avatar_url:session.user.avatar_url, role:'admin' }).select('id,role').single()
  if (membership.error) { await db.from('organizations').delete().eq('id',created.data.id); throw databaseError('create workspace membership',membership.error) }
  return { data:{ workspace:{...created.data,role:membership.data.role} } }
})
