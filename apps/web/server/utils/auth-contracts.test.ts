import { describe, expect, it } from 'vitest'
import { decryptSecret, encryptSecret, hashToken, pkceChallenge, randomToken } from './crypto'
import { buildFigmaAuthorizationUrl } from './figma'

describe('authentication primitives', () => {
  it('hashes session tokens without retaining the token', () => {
    const token = randomToken()
    expect(hashToken(token)).toMatch(/^[a-f0-9]{64}$/)
    expect(hashToken(token)).not.toContain(token)
  })

  it('encrypts and authenticates the PKCE verifier at rest', () => {
    const encrypted = encryptSecret('verifier', 'a sufficiently long test secret')
    expect(encrypted).not.toContain('verifier')
    expect(decryptSecret(encrypted, 'a sufficiently long test secret')).toBe('verifier')
    const [iv, tag, ciphertext] = encrypted.split('.') as [string, string, string]
    const tampered = `${iv}.${tag}.${ciphertext[0] === 'A' ? 'B' : 'A'}${ciphertext.slice(1)}`
    expect(() => decryptSecret(tampered, 'a sufficiently long test secret')).toThrow()
  })

  it('requests only Figma identity access with PKCE and state', () => {
    const verifier = randomToken(64)
    const url = new URL(buildFigmaAuthorizationUrl({
      clientId: 'client', redirectUri: 'https://library.example.com/api/auth/figma/callback',
      state: 'state', challenge: pkceChallenge(verifier)
    }))
    expect(url.origin + url.pathname).toBe('https://www.figma.com/oauth')
    expect(url.searchParams.get('scope')).toBe('current_user:read')
    expect(url.searchParams.get('code_challenge')).toBe(pkceChallenge(verifier))
    expect(url.searchParams.has('code_challenge_method')).toBe(false)
    expect(url.searchParams.get('state')).toBe('state')
  })
})
