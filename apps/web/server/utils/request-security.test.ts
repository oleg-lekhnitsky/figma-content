import { describe, expect, it } from 'vitest'
import { isBearerAuthorization } from './request-security'

describe('mutation request security', () => {
  it('recognizes explicit application bearer credentials', () => {
    expect(isBearerAuthorization('Bearer plugin-session-token')).toBe(true)
  })

  it('does not exempt missing, empty, or other authorization schemes from CSRF checks', () => {
    expect(isBearerAuthorization(undefined)).toBe(false)
    expect(isBearerAuthorization('Bearer ')).toBe(false)
    expect(isBearerAuthorization('Basic abc')).toBe(false)
  })
})
