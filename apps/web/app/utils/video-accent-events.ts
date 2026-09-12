export type VideoMainSoundKind = 'start' | 'transition' | 'settle'
export type VideoKickKind = 'start' | 'settle' | 'rhythm'
export type VideoSoundEvent = { time: number, step: number } & (
  { kind: VideoMainSoundKind } | { kind: 'kick', kickKind: VideoKickKind }
)

export const createVideoAccentEvents = (
  settleTimes: readonly number[],
  options: { firstAccent: boolean, finalAccent: boolean, kick: boolean },
) => {
  const events: VideoSoundEvent[] = []
  const addAccent = (time: number, step: number, kind: 'start' | 'settle', toneEnabled: boolean) => {
    if (toneEnabled) events.push({ time, step, kind })
    // Kicks follow the animation's accent times, independently of preset tones.
    if (options.kick) events.push({ time, step, kind: 'kick', kickKind: kind })
  }
  addAccent(0, 0, 'start', options.firstAccent)
  settleTimes.forEach((time, step) => addAccent(time, step, 'settle', options.finalAccent))
  return events
}
