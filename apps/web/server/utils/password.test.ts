import { describe, expect, it } from 'vitest'
import { hashPassword, verifyPassword } from './password'

describe('password credentials', () => {
  it('stores a salted scrypt hash and verifies only the matching password', async () => {
    const hash = await hashPassword('temporary-passphrase')
    expect(hash).not.toContain('temporary-passphrase')
    expect(await verifyPassword('temporary-passphrase', hash)).toBe(true)
    expect(await verifyPassword('different-passphrase', hash)).toBe(false)
  })

  it('rejects malformed stored credentials', async () => {
    expect(await verifyPassword('temporary-passphrase', 'invalid')).toBe(false)
  })
})
