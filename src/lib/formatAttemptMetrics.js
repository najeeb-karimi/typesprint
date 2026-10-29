const UNAVAILABLE = '—'

export function formatElapsedTime(elapsedMs, { includeTenths = false } = {}) {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) {
    return UNAVAILABLE
  }

  // Round the whole duration before splitting it so 59.96 s becomes 1:00.0.
  const unitsPerSecond = includeTenths ? 10 : 1
  const totalUnits = includeTenths
    ? Math.round(elapsedMs / 100)
    : Math.floor(elapsedMs / 1000)
  const minutes = Math.floor(totalUnits / (60 * unitsPerSecond))
  const seconds = Math.floor(totalUnits / unitsPerSecond) % 60
  const time = `${minutes}:${String(seconds).padStart(2, '0')}`

  return includeTenths ? `${time}.${totalUnits % 10}` : time
}

export function formatWpm(wpm) {
  return Number.isFinite(wpm) && wpm >= 0 ? String(Math.round(wpm)) : UNAVAILABLE
}

export function formatAccuracy(accuracy) {
  return Number.isFinite(accuracy) && accuracy >= 0 && accuracy <= 100
    ? `${accuracy.toFixed(1)}%`
    : UNAVAILABLE
}
