import {
  appendResult, createEmptyHistory, HistoryDataError, parseHistory,
  serializeHistory, validateResultRecord,
} from './resultHistory.js'

export const RESULTS_STORAGE_KEY = 'typesprint.results'
export const RESULTS_LOCK_NAME = 'typesprint.results'

const ERROR_MESSAGES = {
  'read-failed': 'Saved results could not be read. Practice is still available.',
  'invalid-data': 'Saved results could not be understood. Clear saved results to reset them.',
  'unsupported-version': 'Saved results use an unsupported version. They have not been changed.',
  'invalid-result': 'This result could not be saved because its measurements were invalid.',
  'locking-unavailable': 'Safe result saving is unavailable in this browser. Saved results have not been changed.',
  'locking-failed': 'The saved-results operation could not obtain a browser lock. Try again with a new operation.',
  'write-failed': 'This result could not be saved. Previously saved results have not been changed.',
  'clear-failed': 'Saved results could not be cleared. Previously saved results have not been changed.',
}

/**
 * One controller per app lifetime, outside the replaceable practice session.
 * Construction and subscription only read; getSnapshot is a cached, read-only
 * operation suitable for useSyncExternalStore. Mutations return a Promise of
 * { ok, outcome } or { ok: false, error }; failed records are never queued again.
 */
export function createHistoryController({
  getStorage = () => window.localStorage,
  getLockManager = () => navigator.locks,
  eventTarget = window,
} = {}) {
  const subscribers = new Set()
  let history = createEmptyHistory()
  let historyJson = JSON.stringify(history)
  let snapshot = Object.freeze({ history, error: null })

  function publish(nextHistory, error) {
    const serialized = JSON.stringify(nextHistory)
    if (serialized === historyJson
      && error?.code === snapshot.error?.code
      && error?.operation === snapshot.error?.operation) return

    if (serialized !== historyJson) {
      history = nextHistory
      historyJson = serialized
    }
    snapshot = Object.freeze({ history, error })
    for (const subscriber of [...subscribers]) {
      try {
        subscriber()
      } catch (cause) {
        // A consumer's exception must not turn a committed save into a failure
        // or prevent other subscribers from seeing the new snapshot.
        queueMicrotask(() => { throw cause })
      }
    }
  }

  function fail(code, operation) {
    const error = Object.freeze({ code, operation, message: ERROR_MESSAGES[code] })
    publish(history, error)
    return Object.freeze({ ok: false, error })
  }

  function refresh(storageArea) {
    let next
    try {
      const storage = getStorage()
      if (storageArea && storageArea !== storage) return
      next = parseHistory(storage.getItem(RESULTS_STORAGE_KEY))
    } catch (cause) {
      fail(cause instanceof HistoryDataError ? cause.code : 'read-failed', 'load')
      return
    }
    // A remote success must not conceal that this tab's own result failed.
    publish(next, snapshot.error?.operation === 'load' ? null : snapshot.error)
  }

  function handleStorage(event) {
    if (event.key === RESULTS_STORAGE_KEY || event.key === null) {
      // Reread current storage rather than replaying a possibly delayed newValue.
      refresh(event.storageArea)
    }
  }

  function subscribe(listener) {
    // Distinct subscriptions can legitimately use the same callback.
    const subscriber = () => listener()
    subscribers.add(subscriber)
    if (subscribers.size === 1) {
      eventTarget.addEventListener('storage', handleStorage)
      refresh()
    }
    return () => {
      if (!subscribers.delete(subscriber)) return
      if (subscribers.size === 0) eventTarget.removeEventListener('storage', handleStorage)
    }
  }

  async function mutate(operation, result) {
    let locks
    try {
      locks = getLockManager()
      if (typeof locks?.request !== 'function') return fail('locking-unavailable', operation)
    } catch {
      return fail('locking-unavailable', operation)
    }

    try {
      return await locks.request(RESULTS_LOCK_NAME, { mode: 'exclusive' }, () => {
        let next
        let outcome
        try {
          const storage = getStorage()
          const raw = storage.getItem(RESULTS_STORAGE_KEY)
          if (operation === 'clear') {
            // Explicit reset can remove malformed or future-version data too.
            // Do not call Storage.clear: other same-origin data is not ours.
            storage.removeItem(RESULTS_STORAGE_KEY)
            next = createEmptyHistory()
            outcome = 'cleared'
          } else {
            const current = parseHistory(raw)
            next = appendResult(current, result)
            outcome = next === current ? 'duplicate' : 'saved'
            if (outcome === 'saved') storage.setItem(RESULTS_STORAGE_KEY, serializeHistory(next))
          }
        } catch (cause) {
          const code = cause instanceof HistoryDataError ? cause.code
            : operation === 'clear' ? 'clear-failed' : 'write-failed'
          return fail(code, operation)
        }
        // Publish inside the lock, only after the persistent operation succeeds.
        publish(next, null)
        return Object.freeze({ ok: true, outcome })
      })
    } catch {
      return fail('locking-failed', operation)
    }
  }

  async function record(result) {
    let captured
    try {
      // Capture before waiting for a lock; the caller cannot change queued data.
      captured = validateResultRecord(result)
    } catch {
      return fail('invalid-result', 'record')
    }
    return mutate('record', captured)
  }

  refresh()

  return Object.freeze({
    getSnapshot: () => snapshot,
    subscribe,
    record,
    clear: () => mutate('clear'),
  })
}
