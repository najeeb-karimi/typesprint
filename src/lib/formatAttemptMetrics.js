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

/** Keep visible results and the single completion announcement in agreement. */
export function formatAttemptResults(metrics, scoringUnavailableReason = null) {
  const time = formatElapsedTime(metrics.elapsedMs, { includeTenths: true })
  const speed = formatWpm(metrics.wpm)
  const accuracy = formatAccuracy(metrics.accuracy)
  const notes = []

  if (scoringUnavailableReason) {
    if (metrics.elapsedMs === null) notes.push('Time could not be measured.')
    notes.push('Speed and accuracy are unavailable because an edit could not be measured.')
  } else {
    if (metrics.elapsedMs === null) {
      notes.push('Time and speed are unavailable because the duration could not be measured.')
    } else if (metrics.wpm === null) {
      notes.push(metrics.elapsedMs === 0
        ? 'Speed is unavailable because no positive duration was measured.'
        : 'Speed could not be calculated from this duration.')
    }
    if (metrics.accuracy === null) {
      notes.push('Accuracy is unavailable because no character entries were recorded.')
    }
  }

  let spokenTime = 'unavailable'
  if (time !== UNAVAILABLE) {
    const [minutes, seconds] = time.split(':')
    spokenTime = `${Number(minutes)} ${Number(minutes) === 1 ? 'minute' : 'minutes'} and ${Number(seconds).toFixed(1)} seconds`
  }
  const spokenSpeed = speed === UNAVAILABLE ? 'unavailable' : `${speed} words per minute`
  const spokenAccuracy = accuracy === UNAVAILABLE ? 'unavailable' : accuracy

  return {
    time,
    speed,
    accuracy,
    explanation: notes.join(' '),
    announcement: `Time: ${spokenTime}. Speed: ${spokenSpeed}. Accuracy: ${spokenAccuracy}.`,
  }
}
