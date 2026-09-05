export function gridBuildPhase(time: number, duration: number, loop: boolean): number {
  const progress = time / Math.max(.001, duration)
  if (!loop) return Math.max(0, Math.min(1, progress))
  const phase = ((progress % 1) + 1) % 1
  return phase <= .5 ? phase * 2 : (1 - phase) * 2
}
