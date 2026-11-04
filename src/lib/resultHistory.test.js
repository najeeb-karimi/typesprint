import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  appendResult, createEmptyHistory, createResultRecord, HISTORY_LIMIT,
  HistoryDataError, parseHistory, serializeHistory, validateResultRecord,
} from './resultHistory.js'

function record(id = 'result-1', changes = {}) {
  return {
    id,
    completedAt: 1_800_000_000_000,
    passageId: 'steady-progress',
    category: 'short',
    characterCount: 130,
    elapsedMs: 30_000,
    wpm: 52,
    accuracy: 95,
    scoringUnavailableReason: null,
    ...changes,
  }
}

function completedAttempt(changes = {}) {
  return {
    passage: 'cat', input: 'cat', status: 'completed', startedAt: 1000, finishedAt: 31_000,
    totalEntries: 4, correctEntries: 3, isComposing: false, scoringUnavailableReason: null,
    ...changes,
  }
}

function capture(attempt) {
  return createResultRecord({
    id: 'captured', completedAt: 1_800_000_000_000, passageId: 'example', category: 'short', attempt,
  })
}

afterEach(() => vi.restoreAllMocks())

describe('completed result records', () => {
  it('captures only supplied identity, metadata and frozen raw measurements without reading outside inputs', () => {
    vi.spyOn(Date, 'now').mockImplementation(() => { throw new Error('Unexpected calendar read') })
    vi.spyOn(performance, 'now').mockImplementation(() => { throw new Error('Unexpected clock read') })
    vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('Unexpected draw') })
    const attempt = Object.freeze(completedAttempt())

    expect(capture(attempt)).toEqual({
      id: 'captured', completedAt: 1_800_000_000_000, passageId: 'example', category: 'short',
      characterCount: 3, elapsedMs: 30_000, wpm: 1.2, accuracy: 75, scoringUnavailableReason: null,
    })
    expect(Object.isFrozen(capture(attempt))).toBe(true)
  })

  it.each([
    [{ status: 'ready', input: '' }],
    [{ status: 'running', input: 'ca' }],
    [{ isComposing: true }],
    [{ input: 'car' }],
    [{ passage: '', input: '' }],
  ])('rejects an unfinished or provisional attempt: %j', changes => {
    expect(() => capture(completedAttempt(changes))).toThrow(TypeError)
  })

  it.each([
    [{ scoringUnavailableReason: 'untracked-edit' }, { elapsedMs: 30_000, wpm: null, accuracy: null }],
    [{ finishedAt: null }, { elapsedMs: null, wpm: null, accuracy: 75 }],
    [{ finishedAt: 1000 }, { elapsedMs: 0, wpm: null, accuracy: 75 }],
    [{ totalEntries: 0, correctEntries: 0 }, { elapsedMs: 30_000, wpm: 1.2, accuracy: null }],
  ])('preserves unavailable measurements independently: %j', (changes, expected) => {
    expect(capture(completedAttempt(changes))).toMatchObject(expected)
  })

  it('does not retain entered text or passage text from the completed snapshot', () => {
    const result = capture(completedAttempt())
    expect(result).not.toHaveProperty('input')
    expect(result).not.toHaveProperty('passage')
    expect(result).not.toHaveProperty('startedAt')
    expect(result).not.toHaveProperty('totalEntries')
  })

  it.each([
    { id: '' }, { passageId: ' ' }, { category: 'unknown' }, { characterCount: 0 },
    { characterCount: 2.5 }, { completedAt: -1 }, { completedAt: 8.64e15 + 1 },
    { completedAt: 1.5 }, { elapsedMs: undefined }, { elapsedMs: NaN }, { wpm: Infinity },
    { wpm: -1 }, { accuracy: -0.1 }, { accuracy: 100.1 }, { accuracy: '95' },
    { scoringUnavailableReason: 'unknown' }, { elapsedMs: 0, wpm: 1 },
    { elapsedMs: null, wpm: 1 }, { scoringUnavailableReason: 'untracked-edit' },
    { input: 'unexpected saved text' }, { passage: 'unexpected reference text' },
  ])('rejects invalid or extra record data without coercion: %j', changes => {
    expect(() => validateResultRecord(record('invalid', changes))).toThrow(HistoryDataError)
  })

  it('requires every nullable measurement field explicitly and accepts real zero accuracy', () => {
    const missing = record()
    delete missing.accuracy
    expect(() => validateResultRecord(missing)).toThrow(HistoryDataError)
    expect(validateResultRecord(record('zero', { accuracy: 0 })).accuracy).toBe(0)
  })
})

describe('bounded history and independent personal bests', () => {
  it('keeps the latest 50 additions while preserving an older winning record', () => {
    let history = appendResult(createEmptyHistory(), record('old-best', { wpm: 250 }))
    for (let index = 1; index <= HISTORY_LIMIT; index += 1) {
      history = appendResult(history, record('later-' + index))
    }
    expect(history.recent).toHaveLength(50)
    expect(history.recent[0].id).toBe('later-50')
    expect(history.recent.at(-1).id).toBe('later-1')
    expect(history.recent.some(item => item.id === 'old-best')).toBe(false)
    expect(history.bests.short.id).toBe('old-best')
    expect(parseHistory(serializeHistory(history))).toEqual(history)
  })

  it('retains separate winners by category without treating category as a score', () => {
    let history = createEmptyHistory()
    for (const [category, characterCount, wpm] of [
      ['short', 130, 52], ['medium', 247, 98.8], ['long', 436, 174.4],
    ]) {
      history = appendResult(history, record(category, { category, characterCount, wpm }))
    }
    expect(Object.values(history.bests).map(best => best.id)).toEqual(['short', 'medium', 'long'])
  })

  it('compares unrounded speed, breaks exact speed ties by accuracy, and keeps a complete tie', () => {
    let history = appendResult(createEmptyHistory(), record('first', { wpm: 52.1, accuracy: 100 }))
    history = appendResult(history, record('faster', { wpm: 52.2, accuracy: 80 }))
    expect(history.bests.short.id).toBe('faster')
    history = appendResult(history, record('more-accurate', { wpm: 52.2, accuracy: 81 }))
    expect(history.bests.short.id).toBe('more-accurate')
    history = appendResult(history, record('equal', { wpm: 52.2, accuracy: 81 }))
    expect(history.bests.short.id).toBe('more-accurate')
    history = appendResult(history, record('slower', { wpm: 52.1, accuracy: 100 }))
    expect(history.bests.short.id).toBe('more-accurate')
  })

  it('does not impose an accuracy threshold on an otherwise eligible result', () => {
    let history = appendResult(createEmptyHistory(), record('careful', { wpm: 50, accuracy: 100 }))
    history = appendResult(history, record('fast', { wpm: 60, accuracy: 0 }))
    expect(history.bests.short.id).toBe('fast')
  })

  it.each([
    { elapsedMs: 0, wpm: null },
    { elapsedMs: null, wpm: null },
    { accuracy: null },
    { wpm: null, accuracy: null, scoringUnavailableReason: 'untracked-edit' },
  ])('retains a completion with unavailable scores but does not award a best: %j', changes => {
    const history = appendResult(createEmptyHistory(), record('unavailable', changes))
    expect(history.recent[0]).toMatchObject(changes)
    expect(history.bests).toEqual({ short: null, medium: null, long: null })
  })

  it('ignores duplicate IDs in recent history and in independently retained bests', () => {
    let history = appendResult(createEmptyHistory(), record('best', { wpm: 200 }))
    expect(appendResult(history, record('best'))).toBe(history)
    for (let index = 0; index < HISTORY_LIMIT; index += 1) {
      history = appendResult(history, record('other-' + index))
    }
    expect(appendResult(history, record('best', { wpm: 300 }))).toBe(history)
  })

  it('keeps distinct attempts with identical measurements and uses insertion order, not the calendar clock', () => {
    const first = appendResult(createEmptyHistory(), record('first', { completedAt: 2000 }))
    const second = appendResult(first, record('second', { completedAt: 1000 }))
    expect(second.recent.map(result => result.id)).toEqual(['second', 'first'])
    expect(second.bests.short.id).toBe('first')
  })

  it('does not mutate inputs and freezes all exposed history data', () => {
    const previous = createEmptyHistory()
    const supplied = record()
    const original = structuredClone(supplied)
    const history = appendResult(previous, supplied)
    supplied.wpm = 999
    expect(previous.recent).toEqual([])
    expect(original.wpm).toBe(52)
    expect(history.recent[0].wpm).toBe(52)
    expect(Object.isFrozen(history)).toBe(true)
    expect(Object.isFrozen(history.recent)).toBe(true)
    expect(Object.isFrozen(history.bests)).toBe(true)
    expect(Object.isFrozen(history.bests.short)).toBe(true)
    expect(Object.isFrozen(history.recent[0])).toBe(true)
  })
})

describe('saved history decoding', () => {
  it('treats only a missing storage key as empty and round-trips raw measurements', () => {
    expect(parseHistory(null)).toEqual(createEmptyHistory())
    const history = appendResult(createEmptyHistory(), record('raw', {
      elapsedMs: 30000.25, wpm: 51.99956667027775, accuracy: 99.23076923076923,
    }))
    expect(parseHistory(serializeHistory(history))).toEqual(history)
    expect(Object.isFrozen(parseHistory(serializeHistory(history)).recent[0])).toBe(true)
  })

  it.each([undefined, '', '{', 'null', '[]', '{}', '{"version":"1"}'])(
    'rejects malformed data rather than manufacturing empty history: %s', raw => {
      expect(() => parseHistory(raw)).toThrow(HistoryDataError)
    },
  )

  it.each([0, 2, -1])('distinguishes unsupported version %s', version => {
    expect(() => parseHistory(JSON.stringify({ version }))).toThrow(
      expect.objectContaining({ code: 'unsupported-version' }),
    )
  })

  it.each([
    history => ({ ...history, unexpected: true }),
    history => ({ ...history, recent: 'not-an-array' }),
    history => ({ ...history, recent: Array(51).fill(record()) }),
    history => ({ ...history, recent: [record(), record()] }),
    history => ({ ...history, bests: {} }),
    history => ({ ...history, bests: { ...history.bests, other: null } }),
    history => ({ ...history, bests: { ...history.bests, short: null } }),
    history => ({ ...history, bests: { ...history.bests, medium: record() } }),
    history => ({ ...history, bests: { ...history.bests, short: record('different', { wpm: 1 }) } }),
    history => ({ ...history, bests: { ...history.bests, short: record('result-1', { elapsedMs: 31000 }) } }),
    history => ({ ...history, bests: { ...history.bests, long: record('unavailable', {
      category: 'long', wpm: null, accuracy: null,
    }) } }),
  ])('rejects inconsistent saved records or personal bests', corrupt => {
    const history = appendResult(createEmptyHistory(), record())
    expect(() => parseHistory(JSON.stringify(corrupt(history)))).toThrow(HistoryDataError)
  })
})
