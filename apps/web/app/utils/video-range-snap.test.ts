import { describe, expect, it } from 'vitest'
import { snapVideoRange } from './video-range-snap'

describe('video range snapping', () => {
  it('attracts nearby round percentages without quantizing the entire range', () => {
    expect(snapVideoRange(49, 0, 100, 1, 10)).toBe(50)
    expect(snapVideoRange(47, 0, 100, 1, 10)).toBe(47)
  })
  it('snaps signed offsets to zero', () => {
    expect(snapVideoRange(-3, -100, 100, 1, 50, [0])).toBe(0)
  })
  it('supports fractional timing steps', () => {
    expect(snapVideoRange(1.45, 0, 5, .05, .5)).toBe(1.5)
  })
  it('does not snap outside the range or to a value excluded by the native step', () => {
    expect(snapVideoRange(96, 1, 99, 5, 10)).toBe(96)
    expect(snapVideoRange(9, 0, 9, 1, 10)).toBe(9)
  })
  it('supports explicit angles and leaves unconfigured inputs alone', () => {
    expect(snapVideoRange(89, 0, 360, 1, undefined, [0, 90, 180, 270, 360])).toBe(90)
    expect(snapVideoRange(7, 0, 20, 1)).toBe(7)
  })
})
