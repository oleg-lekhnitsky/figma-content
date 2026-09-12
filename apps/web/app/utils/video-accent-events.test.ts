import { describe, expect, it } from 'vitest'
import { createVideoAccentEvents } from './video-accent-events'

describe('independent accent sounds and kicks', () => {
  const settleTimes = [.4, .9, 1.4]
  const accentSwitches = [
    { firstAccent: true, finalAccent: true },
    { firstAccent: false, finalAccent: true },
    { firstAccent: true, finalAccent: false },
    { firstAccent: false, finalAccent: false },
  ]

  it.each(accentSwitches)('keeps every kick with accent switches %o', (switches) => {
    const events = createVideoAccentEvents(settleTimes, { ...switches, kick: true })
    expect(events.filter(event => event.kind === 'kick')).toEqual([
      { time: 0, step: 0, kind: 'kick', kickKind: 'start' },
      { time: .4, step: 0, kind: 'kick', kickKind: 'settle' },
      { time: .9, step: 1, kind: 'kick', kickKind: 'settle' },
      { time: 1.4, step: 2, kind: 'kick', kickKind: 'settle' },
    ])
    expect(events.filter(event => event.kind === 'start')).toHaveLength(switches.firstAccent ? 1 : 0)
    expect(events.filter(event => event.kind === 'settle').map(event => event.time))
      .toEqual(switches.finalAccent ? settleTimes : [])
  })

  it('turns off kicks without changing the preset accent sounds', () => {
    const switches = { firstAccent: true, finalAccent: true }
    const withKicks = createVideoAccentEvents(settleTimes, { ...switches, kick: true })
    const withoutKicks = createVideoAccentEvents(settleTimes, { ...switches, kick: false })
    expect(withoutKicks).toEqual(withKicks.filter(event => event.kind !== 'kick'))
  })

  it('has no accent events when both tones and kicks are off', () => {
    expect(createVideoAccentEvents(settleTimes, { firstAccent: false, finalAccent: false, kick: false })).toEqual([])
  })
})
