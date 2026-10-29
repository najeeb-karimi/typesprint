import { describe, expect, it } from 'vitest'
import { applyAttemptEdit, createAttempt, getAttemptMetrics } from './practiceAttempt.js'
import { comparePassage } from './comparePassage.js'

// These are accepted edits, not key events. The browser adapter supplies their
// insertion ranges after native editing and length limits have taken effect.
function edit(attempt, changes) {
  return applyAttemptEdit(attempt, {
    input: attempt.input,
    insertionStart: 0,
    insertedText: '',
    category: 'insert',
    isComposing: false,
    timestamp: 0,
    ...changes,
  })
}

function finishPassage(passage, timing = {}) {
  const { startedAt, finishedAt } = { startedAt: 0, finishedAt: 30_000, ...timing }
  const running = edit(createAttempt(passage), {
    input: passage[0],
    insertedText: passage[0],
    timestamp: startedAt,
  })

  return edit(running, {
    input: passage,
    insertionStart: 1,
    insertedText: passage.slice(1),
    timestamp: finishedAt,
  })
}

describe('practice attempt lifecycle', () => {
  it('starts ready with no historical entries or scores', () => {
    const attempt = createAttempt('cat')

    expect(attempt).toMatchObject({
      input: '',
      status: 'ready',
      startedAt: null,
      finishedAt: null,
      totalEntries: 0,
      correctEntries: 0,
      isComposing: false,
      scoringUnavailableReason: null,
    })
    expect(getAttemptMetrics(attempt)).toEqual({ elapsedMs: 0, wpm: null, accuracy: null })

    const unchanged = edit(attempt, { timestamp: 5000 })
    expect(unchanged).toEqual(attempt)
  })

  it.each(['', null, undefined, 123])('requires a nonempty passage: %s', passage => {
    expect(() => createAttempt(passage)).toThrow(TypeError)
  })

  it('starts on the first accepted text, including a timestamp of zero', () => {
    const running = edit(createAttempt('cat'), { input: 'c', insertedText: 'c' })

    expect(running).toMatchObject({
      status: 'running',
      startedAt: 0,
      finishedAt: null,
      input: 'c',
      totalEntries: 1,
      correctEntries: 1,
    })
    expect(getAttemptMetrics(running, 1500)).toEqual({
      elapsedMs: 1500, wpm: null, accuracy: null,
    })
  })

  it('keeps the attempt running and remembers its start and errors after clearing all text', () => {
    const running = edit(createAttempt('cat'), { input: 'cx', insertedText: 'cx', timestamp: 500 })
    const cleared = edit(running, { input: '', category: 'delete', timestamp: 5000 })
    const resumed = edit(cleared, { input: 'c', insertedText: 'c', timestamp: 15_500 })

    expect(cleared).toMatchObject({
      status: 'running', input: '', startedAt: 500, totalEntries: 2, correctEntries: 1,
    })
    expect(resumed).toMatchObject({
      status: 'running', startedAt: 500, totalEntries: 3, correctEntries: 2,
    })
    expect(getAttemptMetrics(resumed, 20_500).elapsedMs).toBe(20_000)
  })

  it('requires an exact match and captures completion at the correcting edit', () => {
    const running = edit(createAttempt('cat'), { input: 'cxt', insertedText: 'cxt', timestamp: 100 })
    expect(running.status).toBe('running')

    const completed = edit(running, {
      input: 'cat', insertionStart: 1, insertedText: 'a', timestamp: 30_100,
    })
    expect(completed).toMatchObject({ status: 'completed', finishedAt: 30_100 })
    expect(getAttemptMetrics(completed, 90_000)).toEqual({
      elapsedMs: 30_000, wpm: 1.2, accuracy: 75,
    })
    expect(edit(completed, { input: '', category: 'delete', timestamp: 95_000 })).toBe(completed)
  })

  it('resets all attempt facts by creating a fresh attempt for the same passage', () => {
    const untracked = edit(createAttempt('cat'), {
      input: 'x', category: 'unknown', timestamp: 100,
    })
    const composing = edit(untracked, {
      input: 'ca', insertedText: 'ca', isComposing: true, timestamp: 200,
    })
    const reset = createAttempt(composing.passage)

    expect(reset).toEqual(createAttempt('cat'))
    expect(composing.status).toBe('running')
    expect(composing.scoringUnavailableReason).toBe('untracked-edit')
    expect(reset).not.toBe(composing)
  })

  it('also resets a completed attempt without keeping its finish or counters', () => {
    const completed = finishPassage('cat')
    const reset = createAttempt(completed.passage)

    expect(reset.status).toBe('ready')
    expect(reset.finishedAt).toBeNull()
    expect(reset.totalEntries).toBe(0)
    expect(getAttemptMetrics(reset)).toEqual({ elapsedMs: 0, wpm: null, accuracy: null })
  })

  it('is deterministic and does not mutate either supplied object', () => {
    const attempt = Object.freeze(createAttempt('cat'))
    const acceptedEdit = Object.freeze({
      input: 'cx',
      insertionStart: 0,
      insertedText: 'cx',
      category: 'insert',
      isComposing: false,
      timestamp: 50,
    })
    const first = applyAttemptEdit(attempt, acceptedEdit)

    expect(first).toEqual(applyAttemptEdit(attempt, acceptedEdit))
    expect(first).not.toBe(attempt)
    expect(attempt.input).toBe('')
    expect(attempt.totalEntries).toBe(0)
  })
})

describe('historical character entries', () => {
  it('keeps corrected errors while current comparison feedback becomes clean', () => {
    const running = edit(createAttempt('cat'), { input: 'cxt', insertedText: 'cxt' })
    const completed = edit(running, {
      input: 'cat', insertionStart: 1, insertedText: 'a', timestamp: 1000,
    })

    expect(comparePassage(completed.passage, completed.input)).toMatchObject({
      enteredCount: 3, mistakeCount: 0, isComplete: true,
    })
    expect(completed).toMatchObject({ correctEntries: 3, totalEntries: 4 })
    expect(getAttemptMetrics(completed).accuracy).toBe(75)
  })

  it('counts an accepted same-character replacement even though the input value is unchanged', () => {
    const running = edit(createAttempt('cat'), { input: 'cx', insertedText: 'cx' })
    const replacement = edit(running, { input: 'cx', insertedText: 'c', timestamp: 500 })

    expect(replacement.input).toBe(running.input)
    expect(replacement).toMatchObject({ correctEntries: 2, totalEntries: 3 })
  })

  it.each([
    [0, 2],
    [1, 1],
    [2, 1],
  ])('uses the actual insertion position %i when identical text could hide it', (position, correct) => {
    const running = edit(createAttempt('abcd'), { input: 'aa', insertedText: 'aa' })
    const inserted = edit(running, {
      input: 'aaa', insertionStart: position, insertedText: 'a', timestamp: 500,
    })

    expect(inserted).toMatchObject({ correctEntries: correct, totalEntries: 3 })
  })

  it('does not count existing suffix characters again when deletion shifts their positions', () => {
    const running = edit(createAttempt('abc'), { input: 'axc', insertedText: 'axc' })
    const deleted = edit(running, { input: 'ac', category: 'delete', timestamp: 500 })
    const completed = edit(deleted, {
      input: 'abc', insertionStart: 1, insertedText: 'b', timestamp: 1000,
    })

    expect(deleted).toMatchObject({ correctEntries: 2, totalEntries: 3 })
    expect(comparePassage('abc', deleted.input).mistakeCount).toBe(1)
    expect(completed).toMatchObject({ correctEntries: 3, totalEntries: 4 })
  })

  it('preserves counters through Undo and Redo, then counts a new correction', () => {
    const running = edit(createAttempt('cat'), { input: 'cx', insertedText: 'cx' })
    const undone = edit(running, { input: 'c', category: 'history', timestamp: 100 })
    const redone = edit(undone, { input: 'cx', category: 'history', timestamp: 200 })
    const completed = edit(redone, {
      input: 'cat', insertionStart: 1, insertedText: 'at', timestamp: 1000,
    })

    expect(undone).toMatchObject({ correctEntries: 1, totalEntries: 2 })
    expect(redone).toMatchObject({ correctEntries: 1, totalEntries: 2 })
    expect(completed).toMatchObject({ correctEntries: 3, totalEntries: 4 })
    expect(getAttemptMetrics(completed).accuracy).toBe(75)
  })

  it('does not count text rejected by the native length limit', () => {
    const running = edit(createAttempt('cat'), { input: 'cxt', insertedText: 'cxt' })
    const rejected = edit(running, { input: 'cxt', timestamp: 500 })

    expect(rejected).toEqual(running)
  })

  it('counts only an accepted portion of a longer attempted insertion', () => {
    const running = edit(createAttempt('cat'), { input: 'ca', insertedText: 'ca' })
    const completed = edit(running, {
      input: 'cat', insertionStart: 2, insertedText: 't', timestamp: 1000,
    })

    expect(completed).toMatchObject({ totalEntries: 3, correctEntries: 3 })
  })

  it('counts spaces and punctuation as entries and judges newlines without normalization', () => {
    const running = edit(createAttempt('a b.'), { input: 'a\nb!', insertedText: 'a\nb!' })
    const correctedSpace = edit(running, {
      input: 'a b!', insertionStart: 1, insertedText: ' ', timestamp: 500,
    })
    const completed = edit(correctedSpace, {
      input: 'a b.', insertionStart: 3, insertedText: '.', timestamp: 1000,
    })

    expect(running).toMatchObject({ correctEntries: 2, totalEntries: 4 })
    expect(completed).toMatchObject({ correctEntries: 4, totalEntries: 6 })
    expect(getAttemptMetrics(completed).accuracy).toBeCloseTo(100 * 4 / 6)
  })
})

describe('composition and uncertain edits', () => {
  it('scores composition only when it commits, even if the provisional value already matches', () => {
    const composing = edit(createAttempt('cat'), {
      input: 'c', insertedText: 'c', isComposing: true,
    })
    const provisionalMatch = edit(composing, {
      input: 'cat', insertedText: 'cat', isComposing: true, timestamp: 500,
    })

    expect(composing.startedAt).toBe(0)
    expect(provisionalMatch).toMatchObject({
      status: 'running', finishedAt: null, totalEntries: 0, correctEntries: 0,
    })

    const completed = edit(provisionalMatch, {
      input: 'cat', insertedText: 'cat', timestamp: 1000,
    })
    expect(completed).toMatchObject({
      status: 'completed', finishedAt: 1000, totalEntries: 3, correctEntries: 3,
    })
    expect(getAttemptMetrics(completed).accuracy).toBe(100)
  })

  it('does not score canceled composition or reset a clock that has already started', () => {
    const composing = edit(createAttempt('cat'), {
      input: 'x', insertedText: 'x', isComposing: true, timestamp: 100,
    })
    const canceled = edit(composing, {
      input: '', category: 'delete', timestamp: 1000,
    })

    expect(canceled).toMatchObject({
      input: '', isComposing: false, status: 'running', startedAt: 100,
      totalEntries: 0, correctEntries: 0, scoringUnavailableReason: null,
    })
  })

  it('counts a committed composition replacement without erasing earlier errors', () => {
    const running = edit(createAttempt('cat'), { input: 'cx', insertedText: 'cx' })
    const composing = edit(running, {
      input: 'ca', insertionStart: 1, insertedText: 'a', isComposing: true, timestamp: 100,
    })
    const committed = edit(composing, {
      input: 'ca', insertionStart: 1, insertedText: 'a', timestamp: 200,
    })
    const completed = edit(committed, {
      input: 'cat', insertionStart: 2, insertedText: 't', timestamp: 1000,
    })

    expect(completed).toMatchObject({ totalEntries: 4, correctEntries: 3 })
    expect(getAttemptMetrics(completed).accuracy).toBe(75)
  })

  it('keeps accepted text but makes uncertain scores unavailable until Restart', () => {
    const untracked = edit(createAttempt('cat'), {
      input: 'cx', category: 'unknown', timestamp: 100,
    })
    const completed = edit(untracked, {
      input: 'cat', insertionStart: 1, insertedText: 'at', timestamp: 1100,
    })

    expect(completed).toMatchObject({
      status: 'completed', input: 'cat', scoringUnavailableReason: 'untracked-edit',
    })
    expect(getAttemptMetrics(completed)).toEqual({
      elapsedMs: 1000, wpm: null, accuracy: null,
    })
    expect(createAttempt(completed.passage).scoringUnavailableReason).toBeNull()
  })

  it.each([
    { insertionStart: -1, insertedText: 'c' },
    { insertionStart: 0.5, insertedText: 'c' },
    { insertionStart: null, insertedText: 'c' },
    { insertionStart: 10, insertedText: 'c' },
    { insertionStart: 0, insertedText: 'x' },
    { insertionStart: 0, insertedText: '' },
    { insertionStart: 0, insertedText: 'cat' },
  ])('does not invent scores from inconsistent insertion metadata: %j', metadata => {
    const attempt = edit(createAttempt('cat'), { input: 'c', ...metadata })

    expect(attempt.input).toBe('c')
    expect(attempt.totalEntries).toBe(0)
    expect(attempt.correctEntries).toBe(0)
    expect(attempt.scoringUnavailableReason).toBe('untracked-edit')
  })
})

describe('attempt measurements', () => {
  it('measures 130 characters in 30 seconds as 52 WPM', () => {
    const completed = finishPassage('a'.repeat(130), { startedAt: 500, finishedAt: 30_500 })

    expect(getAttemptMetrics(completed)).toEqual({
      elapsedMs: 30_000, wpm: 52, accuracy: 100,
    })
  })

  it('uses passage output, including spaces and punctuation, rather than a count of typed words', () => {
    const completed = finishPassage('Go, go.', { finishedAt: 12_000 })

    expect(getAttemptMetrics(completed).wpm).toBeCloseTo(7)
  })

  it('keeps raw precision until presentation and does not inflate WPM with correction entries', () => {
    const running = edit(createAttempt('ab'), { input: 'xb', insertedText: 'xb' })
    const completed = edit(running, { input: 'ab', insertedText: 'a', timestamp: 12_345 })
    const metrics = getAttemptMetrics(completed)

    expect(metrics.elapsedMs).toBe(12_345)
    expect(metrics.wpm).toBeCloseTo((2 / 5) / (12_345 / 60_000))
    expect(metrics.accuracy).toBeCloseTo(100 * 2 / 3)
  })

  it('does not reveal scores until completion', () => {
    const running = edit(createAttempt('cat'), { input: 'cx', insertedText: 'cx' })

    expect(getAttemptMetrics(running, 3000)).toEqual({
      elapsedMs: 3000, wpm: null, accuracy: null,
    })
  })

  it('never substitutes the current clock for a missing finish timestamp', () => {
    const completed = finishPassage('cat', { finishedAt: null })

    expect(completed.status).toBe('completed')
    expect(getAttemptMetrics(completed, 30_000)).toEqual({
      elapsedMs: null, wpm: null, accuracy: 100,
    })
  })

  it.each([null, undefined, NaN, Infinity, -1])('handles an unavailable starting timestamp: %s', startedAt => {
    const completed = finishPassage('cat', { startedAt })

    expect(getAttemptMetrics(completed)).toEqual({
      elapsedMs: null, wpm: null, accuracy: 100,
    })
  })

  it('does not restart measurement on a later valid edit after a missing start', () => {
    const running = edit(createAttempt('cat'), {
      input: 'c', insertedText: 'c', timestamp: null,
    })
    const resumed = edit(running, {
      input: 'ca', insertionStart: 1, insertedText: 'a', timestamp: 1000,
    })

    expect(resumed.startedAt).toBeNull()
    expect(getAttemptMetrics(resumed, 2000).elapsedMs).toBeNull()
  })

  it('returns no speed for zero duration without losing valid accuracy', () => {
    const completed = finishPassage('cat', { startedAt: 100, finishedAt: 100 })

    expect(getAttemptMetrics(completed)).toEqual({
      elapsedMs: 0, wpm: null, accuracy: 100,
    })
  })

  it('returns no negative elapsed time or speed from a finish before the start', () => {
    const completed = finishPassage('cat', { startedAt: 1000, finishedAt: 500 })

    expect(getAttemptMetrics(completed)).toEqual({
      elapsedMs: null, wpm: null, accuracy: 100,
    })
  })

  it('does not invent an accuracy percentage when no entries were recorded', () => {
    const completed = edit(createAttempt('cat'), { input: 'cat', category: 'history' })

    expect(getAttemptMetrics(completed).accuracy).toBeNull()
  })
})
