import { describe, expect, it } from 'vitest'
import { curvedGridDirection, curvedGridStep } from './curved-grid-motion'

describe('curved grid motion', () => {
  const linear = (value: number) => value
  it('finishes even the last staggered lane at the minimum duration', () => {
    expect(curvedGridStep(.1 - 1e-9, .1, 0, 1, 1, linear)).toBeCloseTo(1)
    expect(curvedGridStep(.1, .1, 0, 1, 1, linear)).toBe(1)
  })
  it('holds the completed position before the next step', () => {
    expect(curvedGridStep(.15, .1, .2, 1, 1, linear)).toBe(1)
    expect(curvedGridStep(.29, .1, .2, 1, 1, linear)).toBe(1)
  })
  it('moves later lanes later without changing the final position', () => {
    expect(curvedGridStep(.4, 1, 0, 0, 1, linear)).toBe(1)
    expect(curvedGridStep(.4, 1, 0, 1, 1, linear)).toBe(0)
    expect(curvedGridStep(1, 1, 0, 1, 1, linear)).toBe(1)
  })
  it('keeps visible horizontal travel consistent when the bend flips', () => {
    expect(curvedGridDirection('left', false)).toBe(-1)
    expect(curvedGridDirection('left', true)).toBe(1)
    expect(curvedGridDirection('right', false)).toBe(1)
    expect(curvedGridDirection('up', true)).toBe(1)
    expect(curvedGridDirection('down', false)).toBe(-1)
  })
})
