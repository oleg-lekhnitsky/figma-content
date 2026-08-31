import { describe, expect, it } from 'vitest'
import { MIN_VIDEO_DURATION_SECONDS, normalizeVideoDuration } from './video-composer'

describe('video duration', () => {
  it('keeps preset duration at one second or longer', () => {
    expect(normalizeVideoDuration(0.3)).toBe(MIN_VIDEO_DURATION_SECONDS)
    expect(normalizeVideoDuration(1)).toBe(1)
    expect(normalizeVideoDuration(2.4)).toBe(2.4)
  })

  it('falls back to the minimum for invalid duration values', () => {
    expect(normalizeVideoDuration(Number.NaN)).toBe(MIN_VIDEO_DURATION_SECONDS)
  })
})
