/**
 * A browser adapter sends each accepted edit exactly once, after any native length
 * limit has applied. Positions and characters use JavaScript string units, as in
 * comparePassage. This model never reads the DOM or the clock.
 *
 * @typedef {Object} AttemptEdit
 * @property {string} input The accepted textarea value, including provisional composition.
 * @property {number|null} insertionStart Where the accepted inserted text begins.
 * @property {string} insertedText Only newly inserted characters, not shifted existing text.
 * @property {'insert'|'delete'|'history'|'unknown'} category Undo/Redo use 'history'.
 * @property {boolean} isComposing Provisional composition updates are not scored.
 * @property {number|null} timestamp Milliseconds from the attempt's single clock source.
 */

export function createAttempt(passage) {
  if (typeof passage !== 'string' || passage.length === 0) {
    throw new TypeError('A practice passage must be a nonempty string.')
  }

  return {
    passage,
    input: '',
    status: 'ready',
    startedAt: null,
    finishedAt: null,
    totalEntries: 0,
    correctEntries: 0,
    isComposing: false,
    scoringUnavailableReason: null,
  }
}

function validTimestamp(timestamp) {
  return Number.isFinite(timestamp) && timestamp >= 0
}

function validInsertion({ input, insertionStart, insertedText }) {
  return Number.isInteger(insertionStart)
    && insertionStart >= 0
    && input.slice(insertionStart, insertionStart + insertedText.length) === insertedText
}

/**
 * Apply a normalized accepted edit without changing the previous attempt.
 * A committed composition supplies its entire accepted insertion, even when the
 * last provisional update already displayed the same text. Cancellation supplies
 * no insertion. Deletion and history replay never change the historical counters.
 *
 * @param {ReturnType<typeof createAttempt>} attempt
 * @param {AttemptEdit} edit
 */
export function applyAttemptEdit(attempt, edit) {
  if (attempt.status === 'completed') {
    return attempt
  }

  let { status, startedAt, totalEntries, correctEntries, scoringUnavailableReason } = attempt

  if (status === 'ready' && edit.input.length > 0) {
    status = 'running'
    startedAt = validTimestamp(edit.timestamp) ? edit.timestamp : null
  }

  if (!edit.isComposing) {
    if (edit.category === 'unknown') {
      scoringUnavailableReason = 'untracked-edit'
    } else if (edit.category === 'insert') {
      if (edit.insertedText.length > 0 && validInsertion(edit)) {
        totalEntries += edit.insertedText.length

        for (let index = 0; index < edit.insertedText.length; index += 1) {
          if (edit.insertedText[index] === attempt.passage[edit.insertionStart + index]) {
            correctEntries += 1
          }
        }
      } else if (edit.insertedText.length > 0 || edit.input !== attempt.input) {
        // Preserve accepted text when insertion metadata cannot explain it.
        scoringUnavailableReason = 'untracked-edit'
      }
    }
  }

  const isComplete = status === 'running'
    && !edit.isComposing
    && edit.input === attempt.passage

  return {
    ...attempt,
    input: edit.input,
    status: isComplete ? 'completed' : status,
    startedAt,
    finishedAt: isComplete && validTimestamp(edit.timestamp) ? edit.timestamp : null,
    totalEntries,
    correctEntries,
    isComposing: edit.isComposing,
    scoringUnavailableReason,
  }
}

/**
 * Read measurements without advancing the attempt. Pass the current clock value
 * only for a running attempt. Completion always uses its frozen finish timestamp.
 * null means unavailable or not yet revealed; zero is a real measurement.
 */
export function getAttemptMetrics(attempt, timestamp) {
  let elapsedMs = null

  if (attempt.status === 'ready') {
    elapsedMs = 0
  } else {
    const end = attempt.status === 'completed' ? attempt.finishedAt : timestamp

    if (validTimestamp(attempt.startedAt) && validTimestamp(end) && end >= attempt.startedAt) {
      elapsedMs = end - attempt.startedAt
    }
  }

  let wpm = null
  let accuracy = null

  if (attempt.status === 'completed' && attempt.scoringUnavailableReason === null) {
    if (elapsedMs !== null && elapsedMs > 0) {
      const measuredWpm = (attempt.passage.length / 5) / (elapsedMs / 60_000)
      wpm = Number.isFinite(measuredWpm) ? measuredWpm : null
    }

    if (attempt.totalEntries > 0) {
      accuracy = (attempt.correctEntries / attempt.totalEntries) * 100
    }
  }

  return { elapsedMs, wpm, accuracy }
}
