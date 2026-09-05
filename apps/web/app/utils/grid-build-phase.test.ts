import { describe, expect, it } from 'vitest'
import { gridBuildPhase } from './grid-build-phase'

describe('grid build loop', () => {
  it('plays forward then reverses for an equal duration', () => {
    expect(gridBuildPhase(0, 16, true)).toBe(0)
    expect(gridBuildPhase(4, 16, true)).toBe(.5)
    expect(gridBuildPhase(8, 16, true)).toBe(1)
    expect(gridBuildPhase(12, 16, true)).toBe(.5)
    expect(gridBuildPhase(16, 16, true)).toBe(0)
  })
  it('retraces the exact forward animation at the same speed', () => {
    for (const time of [0, 1, 3.5, 7, 8]) {
      expect(gridBuildPhase(time, 16, true)).toBeCloseTo(gridBuildPhase(time, 8, false))
      expect(gridBuildPhase(16 - time, 16, true)).toBeCloseTo(gridBuildPhase(time, 16, true))
      expect(gridBuildPhase(time + 16, 16, true)).toBeCloseTo(gridBuildPhase(time, 16, true))
    }
  })
  it('keeps the final zoom for non-looping playback', () => {
    expect(gridBuildPhase(6, 8, false)).toBe(.75)
    expect(gridBuildPhase(8, 8, false)).toBe(1)
    expect(gridBuildPhase(10, 8, false)).toBe(1)
  })
})
