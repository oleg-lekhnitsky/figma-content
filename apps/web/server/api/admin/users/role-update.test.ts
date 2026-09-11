import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineEventHandler, type H3Event } from 'h3'

const state = vi.hoisted(() => ({ id: 'self', body: {} as Record<string, unknown> }))
vi.mock('h3', async importOriginal => ({
  ...await importOriginal<typeof import('h3')>(),
  getRouterParam: () => state.id,
  readValidatedBody: (_event: unknown, validate: (body: unknown) => unknown) => validate(state.body)
}))
vi.mock('../../../utils/session', () => ({ requireRole: vi.fn(async () => ({ user: { id: 'self', role: 'admin', organization_id: 'workspace' } })) }))
vi.mock('../../../utils/request-security', () => ({ requireTrustedMutation: vi.fn() }))
vi.mock('../../../utils/audit', () => ({ writeAuditLog: vi.fn() }))

const query = {
  update: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(),
  single: vi.fn(async () => ({ data: { id: state.id, ...state.body }, error: null }))
}
const from = vi.fn(() => query)
let handler: typeof import('./[id].patch')['default']
beforeAll(async () => {
  vi.stubGlobal('defineEventHandler', defineEventHandler)
  vi.stubGlobal('useSupabaseAdmin', () => ({ from }))
  handler = (await import('./[id].patch')).default
})
beforeEach(() => {
  vi.clearAllMocks()
  state.id = 'self'
  state.body = {}
})
afterAll(() => vi.unstubAllGlobals())

describe('workspace role updates', () => {
  it.each(['viewer', 'contributor', 'editor'])('rejects changing your own admin role to %s before writing', async role => {
    state.body = { role }
    await expect(handler({} as H3Event)).rejects.toMatchObject({ statusCode: 400, data: { error: { code: 'SELF_ROLE_CHANGE' } } })
    expect(from).not.toHaveBeenCalled()
  })

  it('allows an admin to change another member’s role within the workspace', async () => {
    state.id = 'other'
    state.body = { role: 'viewer' }
    await handler({} as H3Event)
    expect(query.update).toHaveBeenCalledWith({ role: 'viewer' })
    expect(query.eq).toHaveBeenCalledWith('id', 'other')
    expect(query.eq).toHaveBeenCalledWith('organization_id', 'workspace')
  })

  it('allows submitting your unchanged role', async () => {
    state.body = { role: 'admin' }
    await expect(handler({} as H3Event)).resolves.toBeDefined()
  })

  it('continues to reject disabling your own account', async () => {
    state.body = { isActive: false }
    await expect(handler({} as H3Event)).rejects.toMatchObject({ data: { error: { code: 'SELF_DISABLE' } } })
    expect(from).not.toHaveBeenCalled()
  })
})
