export function curvedGridStep(time: number, duration: number, hold: number, laneFraction: number, stagger: number, ease: (value: number) => number): number {
  const stepDuration = Math.max(.1, duration)
  const span = stepDuration + Math.max(0, hold)
  const completed = Math.floor(time / span)
  const localTime = time - completed * span
  const window = Math.min(1, Math.abs(stagger)) * stepDuration * .8
  const delay = Math.max(0, Math.min(1, laneFraction)) * window
  const movingDuration = stepDuration - window
  const progress = Math.max(0, Math.min(1, (localTime - delay) / movingDuration))
  return completed + ease(progress)
}

export function curvedGridDirection(direction: string, inside: boolean): number {
  if (direction === 'up') return 1
  if (direction === 'down') return -1
  return (direction === 'left' ? -1 : 1) * (inside ? -1 : 1)
}
