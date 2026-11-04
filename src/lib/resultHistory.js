import { getAttemptMetrics } from './practiceAttempt.js'

export const HISTORY_VERSION = 1
export const HISTORY_LIMIT = 50
export const HISTORY_CATEGORIES = Object.freeze(['short', 'medium', 'long'])

const RESULT_FIELDS = [
  'id', 'completedAt', 'passageId', 'category', 'characterCount',
  'elapsedMs', 'wpm', 'accuracy', 'scoringUnavailableReason',
]

/** Invalid saved data is reported rather than silently repaired or overwritten. */
export class HistoryDataError extends Error {
  constructor(code = 'invalid-data') {
    super(code === 'unsupported-version'
      ? 'Saved results use an unsupported version.'
      : 'Saved results do not match the expected history format.')
    this.name = 'HistoryDataError'
    this.code = code
  }
}

function hasFields(value, fields) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === fields.length
    && fields.every(field => Object.hasOwn(value, field))
}

function nonemptyString(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function nullableNumber(value, maximum = Infinity) {
  return value === null || (Number.isFinite(value) && value >= 0 && value <= maximum)
}

/** Validate without coercion, copy only the record contract, and freeze the copy. */
export function validateResultRecord(value) {
  if (!hasFields(value, RESULT_FIELDS)
    || !nonemptyString(value.id)
    || !nonemptyString(value.passageId)
    || !HISTORY_CATEGORIES.includes(value.category)
    || !Number.isInteger(value.completedAt) || value.completedAt < 0 || value.completedAt > 8.64e15
    || !Number.isSafeInteger(value.characterCount) || value.characterCount <= 0
    || !nullableNumber(value.elapsedMs)
    || !nullableNumber(value.wpm)
    || !nullableNumber(value.accuracy, 100)
    || ![null, 'untracked-edit'].includes(value.scoringUnavailableReason)
    || (value.wpm !== null && (value.elapsedMs === null || value.elapsedMs <= 0))
    || (value.scoringUnavailableReason !== null && (value.wpm !== null || value.accuracy !== null))) {
    throw new HistoryDataError()
  }

  return Object.freeze(Object.fromEntries(RESULT_FIELDS.map(field => [field, value[field]])))
}

/**
 * Capture a completed attempt. IDs and calendar timestamps are supplied by the
 * caller once; this pure function never reads randomness, the browser, or a clock.
 * Only whitelisted metadata and frozen measurements enter saved history.
 */
export function createResultRecord({ id, completedAt, passageId, category, attempt }) {
  if (!attempt || attempt.status !== 'completed' || attempt.isComposing
    || typeof attempt.passage !== 'string' || attempt.passage.length === 0
    || attempt.input !== attempt.passage) {
    throw new TypeError('A result requires a completed, committed attempt.')
  }

  return validateResultRecord({
    id,
    completedAt,
    passageId,
    category,
    characterCount: attempt.passage.length,
    ...getAttemptMetrics(attempt),
    scoringUnavailableReason: attempt.scoringUnavailableReason,
  })
}

function eligible(result) {
  return result.scoringUnavailableReason === null && result.elapsedMs !== null
    && result.elapsedMs > 0 && result.wpm !== null && result.accuracy !== null
}

function beats(candidate, incumbent) {
  return eligible(candidate) && (incumbent === null
    || candidate.wpm > incumbent.wpm
    || (candidate.wpm === incumbent.wpm && candidate.accuracy > incumbent.accuracy))
}

function freezeHistory(recent, bests) {
  return Object.freeze({
    version: HISTORY_VERSION,
    recent: Object.freeze(recent),
    bests: Object.freeze(bests),
  })
}

export function createEmptyHistory() {
  return freezeHistory([], { short: null, medium: null, long: null })
}

function validateHistory(value) {
  if (value !== null && typeof value === 'object'
    && Number.isInteger(value.version) && value.version !== HISTORY_VERSION) {
    throw new HistoryDataError('unsupported-version')
  }
  if (!hasFields(value, ['version', 'recent', 'bests'])
    || value.version !== HISTORY_VERSION
    || !Array.isArray(value.recent) || value.recent.length > HISTORY_LIMIT
    || !hasFields(value.bests, HISTORY_CATEGORIES)) {
    throw new HistoryDataError()
  }

  const recent = value.recent.map(validateResultRecord)
  const seen = new Map(recent.map(result => [result.id, result]))
  if (seen.size !== recent.length) throw new HistoryDataError()

  const bests = {}
  for (const category of HISTORY_CATEGORIES) {
    const best = value.bests[category] === null ? null : validateResultRecord(value.bests[category])
    if (best !== null) {
      if (best.category !== category || !eligible(best)) throw new HistoryDataError()
      const existing = seen.get(best.id)
      if (existing && JSON.stringify(existing) !== JSON.stringify(best)) throw new HistoryDataError()
      seen.set(best.id, best)
    }
    // Retained recent results must not contradict the independently saved best.
    if (recent.some(result => result.category === category && beats(result, best))) {
      throw new HistoryDataError()
    }
    bests[category] = best
  }
  return freezeHistory(recent, bests)
}

/** null is the missing-key value returned by Storage.getItem, not a JSON value. */
export function parseHistory(serialized) {
  if (serialized === null) return createEmptyHistory()
  if (typeof serialized !== 'string') throw new HistoryDataError()

  let value
  try {
    value = JSON.parse(serialized)
  } catch {
    throw new HistoryDataError()
  }
  return validateHistory(value)
}

export function serializeHistory(history) {
  return JSON.stringify(validateHistory(history))
}

/** Newest additions go first; calendar clock adjustments do not reorder history. */
export function appendResult(history, result) {
  const current = validateHistory(history)
  const record = validateResultRecord(result)
  if (current.recent.some(item => item.id === record.id)
    || Object.values(current.bests).some(item => item?.id === record.id)) {
    return history
  }

  const bests = { ...current.bests }
  if (beats(record, bests[record.category])) bests[record.category] = record

  return freezeHistory([record, ...current.recent].slice(0, HISTORY_LIMIT), bests)
}
