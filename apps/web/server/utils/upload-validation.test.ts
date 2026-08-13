import { describe, expect, it } from 'vitest'
import { expectedSharpFormat, isAllowedUploadMime, isValidMp4, isVideoUploadMime } from './upload-validation'

describe('asset upload validation', () => {
  it('accepts supported image and video MIME types', () => {
    expect(isAllowedUploadMime('image/png')).toBe(true)
    expect(isAllowedUploadMime('image/jpeg')).toBe(true)
    expect(isAllowedUploadMime('video/mp4')).toBe(true)
    expect(isAllowedUploadMime('image/svg+xml')).toBe(false)
    expect(isAllowedUploadMime('text/html')).toBe(false)
  })

  it('maps trusted MIME types to decoder formats', () => {
    expect(expectedSharpFormat('image/png')).toBe('png')
    expect(expectedSharpFormat('image/jpeg')).toBe('jpeg')
  })

  it('recognizes MP4 media by MIME type and file signature', () => {
    expect(isVideoUploadMime('video/mp4')).toBe(true)
    expect(isValidMp4(new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112, 105, 115, 111, 109]))).toBe(true)
    expect(isValidMp4(new Uint8Array([0, 0, 0, 24, 110, 111, 112, 101, 105, 115, 111, 109]))).toBe(false)
  })
})
