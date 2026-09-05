export function snapVideoRange(value: number, min: number, max: number, step: number, interval?: number, points: readonly number[] = []) {
  const candidates = [...points]
  if (interval && interval > 0) candidates.push(Math.round(value / interval) * interval)
  const threshold = Math.min((max - min) * .015, interval ? interval * .15 : Infinity)
  let result = value
  let distance = threshold
  for (const point of candidates) {
    if (point < min || point > max) continue
    const aligned = min + Math.round((point - min) / step) * step
    if (Math.abs(aligned - point) > 1e-7) continue
    const delta = Math.abs(point - value)
    if (delta <= distance) { result = point; distance = delta }
  }
  return Number(result.toFixed(8))
}
