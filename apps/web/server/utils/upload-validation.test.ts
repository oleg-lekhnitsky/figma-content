import { describe, expect, it } from 'vitest'
import { expectedSharpFormat, isAllowedUploadMime } from './upload-validation'

describe('asset upload validation', () => {
  it('accepts only the supported image MIME types', () => {
    expect(isAllowedUploadMime('image/png')).toBe(true)
    expect(isAllowedUploadMime('image/jpeg')).toBe(true)
    expect(isAllowedUploadMime('image/svg+xml')).toBe(false)
    expect(isAllowedUploadMime('text/html')).toBe(false)
  })

  it('maps trusted MIME types to decoder formats', () => {
    expect(expectedSharpFormat('image/png')).toBe('png')
    expect(expectedSharpFormat('image/jpeg')).toBe('jpeg')
  })
})
