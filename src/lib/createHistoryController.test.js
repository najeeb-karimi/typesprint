import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createHistoryController, RESULTS_LOCK_NAME, RESULTS_STORAGE_KEY,
} from './createHistoryController.js'
import { appendResult, createEmptyHistory, parseHistory, serializeHistory } from './resultHistory.js'

function result(id = 'result-1', changes = {}) {
  return {
    id, completedAt: 1_800_000_000_000, passageId: 'steady-progress', category: 'short',
    characterCount: 130, elapsedMs: 30_000, wpm: 52, accuracy: 95,
    scoringUnavailableReason: null, ...changes,
  }
}

function saved(...results) {
  return serializeHistory(results.reduce(appendResult, createEmptyHistory()))
}

// A controlled queue for this one named lock, not an implementation of Web Locks.
function lockQueue() {
  let tail = Promise.resolve()
  return {
    request: vi.fn((name, options, callback) => {
      const pending = tail.then(() => callback({ name, mode: options.mode }))
      tail = pending.catch(() => {})
      return pending
    }),
  }
}

function deferred() {
  let resolve
  const promise = new Promise(complete => { resolve = complete })
  return { promise, resolve }
}

function harness(raw = null) {
  const values = new Map([['another-app', 'leave this alone']])
  if (raw !== null) values.set(RESULTS_STORAGE_KEY, raw)
  const storage = {
    getItem: vi.fn(key => values.get(key) ?? null),
    setItem: vi.fn((key, value) => { values.set(key, value) }),
    removeItem: vi.fn(key => { values.delete(key) }),
    clear: vi.fn(() => { throw new Error('Must not clear unrelated storage') }),
  }
  const locks = lockQueue()
  const events = new EventTarget()
  const getStorage = vi.fn(() => storage)
  const options = {
    getStorage, getLockManager: () => locks, eventTarget: events,
    waitForNextTask: () => Promise.resolve(),
  }
  const create = changes => createHistoryController({ ...options, ...changes })
  function change(properties = {}) {
    const event = new Event('storage')
    Object.assign(event, { key: RESULTS_STORAGE_KEY, storageArea: storage, ...properties })
    events.dispatchEvent(event)
  }
  return { values, storage, locks, events, getStorage, create, change }
}

const subscriptions = []
function subscribe(controller, callback = vi.fn()) {
  const unsubscribe = controller.subscribe(callback)
  subscriptions.push(unsubscribe)
  return { callback, unsubscribe }
}

afterEach(() => {
  subscriptions.splice(0).forEach(unsubscribe => unsubscribe())
  vi.restoreAllMocks()
})

describe('history controller snapshots and persistence', () => {
  it('loads without writing and returns the same immutable snapshot until observable data changes', () => {
    const { create, storage } = harness(saved(result()))
    const controller = create()
    const snapshot = controller.getSnapshot()
    const reads = storage.getItem.mock.calls.length
    expect(snapshot.history.recent[0].id).toBe('result-1')
    expect(snapshot.error).toBeNull()
    expect(controller.getSnapshot()).toBe(snapshot)
    expect(Object.isFrozen(snapshot)).toBe(true)
    expect(Object.isFrozen(snapshot.history.recent[0])).toBe(true)
    expect(storage.getItem).toHaveBeenCalledTimes(reads)
    expect(storage.setItem).not.toHaveBeenCalled()
    expect(storage.removeItem).not.toHaveBeenCalled()
  })

  it('publishes to the writing tab after saving, restores on a new controller, and ignores a duplicate', async () => {
    const { create, storage, locks } = harness()
    const controller = create()
    const { callback } = subscribe(controller)
    const before = controller.getSnapshot()
    expect(await controller.record(result())).toEqual({ ok: true, outcome: 'saved' })
    expect(controller.getSnapshot()).not.toBe(before)
    expect(controller.getSnapshot().history.recent).toHaveLength(1)
    expect(callback).toHaveBeenCalledTimes(1)
    expect(locks.request).toHaveBeenCalledWith(
      RESULTS_LOCK_NAME, { mode: 'exclusive' }, expect.any(Function),
    )
    expect(create().getSnapshot().history).toEqual(controller.getSnapshot().history)
    const after = controller.getSnapshot()
    expect(await controller.record(result())).toEqual({ ok: true, outcome: 'duplicate' })
    expect(controller.getSnapshot()).toBe(after)
    expect(storage.setItem).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('records nullable values and preserves an independently retained best beyond pruning', async () => {
    const { create } = harness()
    const controller = create()
    await controller.record(result('old-best', { wpm: 200 }))
    for (let index = 0; index < 50; index += 1) {
      expect((await controller.record(result('next-' + index, {
        wpm: null, accuracy: null, scoringUnavailableReason: 'untracked-edit',
      }))).ok).toBe(true)
    }
    const history = create().getSnapshot().history
    expect(history.recent).toHaveLength(50)
    expect(history.recent[0].wpm).toBeNull()
    expect(history.bests.short.id).toBe('old-best')
  })

  it('rejects an invalid supplied record without requesting a lock or touching storage', async () => {
    const { create, storage, locks } = harness()
    const controller = create()
    const before = controller.getSnapshot().history
    expect(await controller.record(result('invalid', { wpm: NaN }))).toMatchObject({
      ok: false, error: { code: 'invalid-result', operation: 'record' },
    })
    expect(controller.getSnapshot().history).toBe(before)
    expect(storage.setItem).not.toHaveBeenCalled()
    expect(locks.request).not.toHaveBeenCalled()
  })

  it('clears only its key and does not resurrect results when read, subscribed, or reloaded', async () => {
    const h = harness(saved(result()))
    const controller = h.create()
    expect(await controller.clear()).toEqual({ ok: true, outcome: 'cleared' })
    subscribe(controller)
    expect(h.create().getSnapshot().history).toEqual(createEmptyHistory())
    expect(controller.getSnapshot().history).toEqual(createEmptyHistory())
    expect(h.values.get('another-app')).toBe('leave this alone')
    expect(h.storage.removeItem).toHaveBeenCalledWith(RESULTS_STORAGE_KEY)
    expect(h.storage.clear).not.toHaveBeenCalled()
    expect(h.storage.setItem).not.toHaveBeenCalled()
  })
})

describe('history controller failures', () => {
  it('reports blocked access at construction without throwing or writing', () => {
    const h = harness()
    const controller = h.create({ getStorage: () => { throw new DOMException('Blocked', 'SecurityError') } })
    expect(controller.getSnapshot()).toMatchObject({
      history: createEmptyHistory(), error: { code: 'read-failed', operation: 'load' },
    })
    expect(h.storage.setItem).not.toHaveBeenCalled()
  })

  it.each([
    ['getItem', 'record', 'write-failed'],
    ['setItem', 'record', 'write-failed'],
    ['removeItem', 'clear', 'clear-failed'],
    ['getItem', 'clear', 'clear-failed'],
  ])('preserves saved data and cached history after a failed %s during %s', async (method, operation, code) => {
    const raw = saved(result('existing'))
    const h = harness(raw)
    const controller = h.create()
    const history = controller.getSnapshot().history
    h.storage[method].mockImplementation(() => { throw new DOMException('Unavailable', 'QuotaExceededError') })
    const response = operation === 'clear' ? await controller.clear() : await controller.record(result('failed'))
    expect(response).toMatchObject({ ok: false, error: { code, operation } })
    expect(controller.getSnapshot().history).toBe(history)
    expect(h.values.get(RESULTS_STORAGE_KEY)).toBe(raw)
  })

  it('does not retry a failed completion and lets a later distinct result succeed', async () => {
    const h = harness(saved(result('existing')))
    const controller = h.create()
    h.storage.setItem.mockImplementationOnce(() => { throw new Error('Full') })
    expect((await controller.record(result('failed'))).ok).toBe(false)
    subscribe(controller)
    controller.getSnapshot()
    h.change()
    expect(h.storage.setItem).toHaveBeenCalledTimes(1)
    expect(controller.getSnapshot().error.code).toBe('write-failed')
    expect((await controller.record(result('later'))).ok).toBe(true)
    expect(controller.getSnapshot().error).toBeNull()
    expect(controller.getSnapshot().history.recent.map(item => item.id)).toEqual(['later', 'existing'])
  })

  it.each(['{', 'null', '{"version":2}', JSON.stringify({
    version: 1, recent: [], bests: {},
  })])('preserves unreadable or unsupported data until an explicit clear: %s', async raw => {
    const h = harness(raw)
    const controller = h.create()
    expect(controller.getSnapshot().error).not.toBeNull()
    expect((await controller.record(result())).ok).toBe(false)
    expect(h.storage.setItem).not.toHaveBeenCalled()
    expect(h.values.get(RESULTS_STORAGE_KEY)).toBe(raw)
    expect(await controller.clear()).toEqual({ ok: true, outcome: 'cleared' })
    expect(controller.getSnapshot()).toEqual({ history: createEmptyHistory(), error: null })
    expect((await controller.record(result('after-reset'))).ok).toBe(true)
  })

  it.each([
    () => undefined,
    () => ({}),
    () => { throw new Error('Lock manager access blocked') },
  ])('does not fall back to unsafe writes when locking is unavailable', async getLockManager => {
    const h = harness(saved(result('existing')))
    const controller = h.create({ getLockManager })
    expect(await controller.record(result('unsaved'))).toMatchObject({
      ok: false, error: { code: 'locking-unavailable' },
    })
    expect(await controller.clear()).toMatchObject({ ok: false, error: { code: 'locking-unavailable' } })
    expect(h.storage.setItem).not.toHaveBeenCalled()
    expect(h.storage.removeItem).not.toHaveBeenCalled()
    expect(controller.getSnapshot().history.recent[0].id).toBe('existing')
  })

  it('reports a rejected lock request without performing storage operations', async () => {
    const h = harness()
    const controller = h.create({
      getLockManager: () => ({ request: vi.fn().mockRejectedValue(new Error('Denied')) }),
    })
    h.storage.getItem.mockClear()
    expect(await controller.record(result())).toMatchObject({ ok: false, error: { code: 'locking-failed' } })
    expect(h.storage.getItem).not.toHaveBeenCalled()
    expect(h.storage.setItem).not.toHaveBeenCalled()
  })
})

describe('cross-tab refresh and subscription ownership', () => {
  it('listens once, cleans up the last subscription, and reads missed changes on resubscription', async () => {
    const h = harness()
    const add = vi.spyOn(h.events, 'addEventListener')
    const remove = vi.spyOn(h.events, 'removeEventListener')
    const controller = h.create()
    const first = subscribe(controller)
    const second = subscribe(controller)
    expect(add).toHaveBeenCalledTimes(1)
    h.values.set(RESULTS_STORAGE_KEY, saved(result('remote')))
    h.change()
    expect(first.callback).toHaveBeenCalledTimes(1)
    expect(second.callback).toHaveBeenCalledTimes(1)
    const after = controller.getSnapshot()
    h.change()
    expect(controller.getSnapshot()).toBe(after)
    first.unsubscribe()
    expect(remove).not.toHaveBeenCalled()
    second.unsubscribe()
    second.unsubscribe()
    expect(remove).toHaveBeenCalledTimes(1)
    h.values.set(RESULTS_STORAGE_KEY, saved(result('while-unsubscribed')))
    h.change()
    expect(controller.getSnapshot()).toBe(after)
    subscribe(controller)
    expect(add).toHaveBeenCalledTimes(2)
    expect(controller.getSnapshot().history.recent[0].id).toBe('while-unsubscribed')
    expect(h.storage.setItem).not.toHaveBeenCalled()
  })

  it('treats two subscriptions with the same function as independent', async () => {
    const h = harness()
    const controller = h.create()
    const listener = vi.fn()
    const first = subscribe(controller, listener)
    subscribe(controller, listener)
    await controller.record(result('one'))
    expect(listener).toHaveBeenCalledTimes(2)
    first.unsubscribe()
    await controller.record(result('two'))
    expect(listener).toHaveBeenCalledTimes(3)
  })

  it('ignores other keys and storage areas and rereads current data instead of a delayed event payload', () => {
    const h = harness(saved(result('old')))
    const controller = h.create()
    subscribe(controller)
    const before = controller.getSnapshot()
    h.values.set(RESULTS_STORAGE_KEY, saved(result('latest')))
    h.change({ key: 'another-app' })
    h.change({ storageArea: {} })
    expect(controller.getSnapshot()).toBe(before)
    h.change({ newValue: saved(result('stale')) })
    expect(controller.getSnapshot().history.recent[0].id).toBe('latest')
    h.values.delete(RESULTS_STORAGE_KEY)
    h.change({ key: null, newValue: saved(result('stale')) })
    expect(controller.getSnapshot().history).toEqual(createEmptyHistory())
    expect(h.storage.setItem).not.toHaveBeenCalled()
  })

  it('keeps the last valid snapshot when remote data becomes unreadable and recovers on a valid refresh', () => {
    const h = harness(saved(result()))
    const controller = h.create()
    const { callback } = subscribe(controller)
    const history = controller.getSnapshot().history
    h.values.set(RESULTS_STORAGE_KEY, '{')
    h.change()
    expect(controller.getSnapshot()).toMatchObject({ history, error: { code: 'invalid-data' } })
    h.values.delete(RESULTS_STORAGE_KEY)
    h.change()
    expect(controller.getSnapshot()).toEqual({ history: createEmptyHistory(), error: null })
    expect(callback).toHaveBeenCalledTimes(2)
  })

  it('does not hide a failed local save when another tab successfully updates history', async () => {
    const h = harness()
    const controller = h.create()
    subscribe(controller)
    h.storage.setItem.mockImplementationOnce(() => { throw new Error('Full') })
    await controller.record(result('failed'))
    h.values.set(RESULTS_STORAGE_KEY, saved(result('remote')))
    h.change()
    expect(controller.getSnapshot().history.recent[0].id).toBe('remote')
    expect(controller.getSnapshot().error.code).toBe('write-failed')
  })

  it('does not let a broken subscriber change the operation outcome or prevent other notifications', async () => {
    const h = harness()
    const controller = h.create()
    const queued = []
    vi.spyOn(globalThis, 'queueMicrotask').mockImplementation(callback => { queued.push(callback) })
    subscribe(controller, () => { throw new Error('Consumer bug') })
    const { callback } = subscribe(controller)
    expect(await controller.record(result())).toEqual({ ok: true, outcome: 'saved' })
    expect(callback).toHaveBeenCalledTimes(1)
    expect(queued).toHaveLength(1)
    expect(queued[0]).toThrow('Consumer bug')
    expect(parseHistory(h.values.get(RESULTS_STORAGE_KEY)).recent[0].id).toBe('result-1')
  })
})

describe('serialized history operations', () => {
  it('preserves simultaneous additions from controllers that both loaded an empty history', async () => {
    const h = harness()
    const first = h.create()
    const second = h.create()
    subscribe(first)
    expect(await Promise.all([
      first.record(result('one', { wpm: 100 })),
      second.record(result('two', { wpm: 80 })),
    ])).toEqual([{ ok: true, outcome: 'saved' }, { ok: true, outcome: 'saved' }])
    const history = parseHistory(h.values.get(RESULTS_STORAGE_KEY))
    expect(history.recent.map(item => item.id)).toEqual(['two', 'one'])
    expect(history.bests.short.id).toBe('one')
    h.change()
    expect(first.getSnapshot().history).toEqual(second.getSnapshot().history)
  })

  it('reads inside a queued lock and captures the supplied result before waiting', async () => {
    const h = harness()
    const controller = h.create()
    const gate = deferred()
    const held = h.locks.request(RESULTS_LOCK_NAME, { mode: 'exclusive' }, async () => {
      await gate.promise
      h.storage.setItem(RESULTS_STORAGE_KEY, saved(result('earlier-writer')))
    })
    const supplied = result('queued', { wpm: 120 })
    h.storage.getItem.mockClear()
    const pending = controller.record(supplied)
    supplied.id = 'changed-after-request'
    supplied.wpm = 999
    expect(h.storage.getItem).not.toHaveBeenCalled()
    expect(controller.getSnapshot().history.recent).toEqual([])
    gate.resolve()
    await held
    expect(await pending).toEqual({ ok: true, outcome: 'saved' })
    expect(controller.getSnapshot().history.recent.map(item => item.id)).toEqual(['queued', 'earlier-writer'])
    expect(controller.getSnapshot().history.bests.short.wpm).toBe(120)
  })

  it.each([
    ['save-then-clear', []],
    ['clear-then-save', ['new']],
  ])('orders %s without resurrecting a removed result', async (order, expected) => {
    const h = harness(saved(result('existing', { wpm: 200 })))
    const first = h.create()
    const second = h.create()
    const operations = order === 'save-then-clear'
      ? [first.record(result('new')), second.clear()]
      : [first.clear(), second.record(result('new'))]
    expect((await Promise.all(operations)).every(response => response.ok)).toBe(true)
    const history = parseHistory(h.values.get(RESULTS_STORAGE_KEY) ?? null)
    expect(history.recent.map(item => item.id)).toEqual(expected)
    expect(history.bests.short?.id ?? null).toBe(expected[0] ?? null)
  })

  it('can finish an explicit queued operation after the last subscriber leaves without notifying it', async () => {
    const h = harness()
    const controller = h.create()
    const { callback, unsubscribe } = subscribe(controller)
    const gate = deferred()
    const held = h.locks.request(RESULTS_LOCK_NAME, { mode: 'exclusive' }, () => gate.promise)
    const pending = controller.record(result())
    unsubscribe()
    gate.resolve()
    await held
    expect((await pending).ok).toBe(true)
    expect(callback).not.toHaveBeenCalled()
    expect(controller.getSnapshot().history.recent[0].id).toBe('result-1')
  })
})

describe('storage visibility before releasing the lock', () => {
  function bufferedStorage(raw = null) {
    const h = harness(raw)
    const gate = deferred()
    let staged = null
    // Model browser writes that are not visible to another tab until task end.
    h.storage.setItem.mockImplementation((key, value) => { staged = { key, value } })
    h.storage.removeItem.mockImplementation(key => { staged = { key, value: null } })
    const boundary = vi.fn(async () => {
      if (boundary.mock.calls.length === 1) await gate.promise
      if (staged.value === null) h.values.delete(staged.key)
      else h.values.set(staged.key, staged.value)
      staged = null
    })
    return { ...h, gate, boundary, createBuffered: () => h.create({ waitForNextTask: boundary }) }
  }

  it('keeps another save queued and success unpublished until the buffered write is visible', async () => {
    const h = bufferedStorage()
    const first = h.createBuffered()
    const second = h.createBuffered()
    const { callback } = subscribe(first)
    h.storage.getItem.mockClear()
    const operations = [first.record(result('one')), second.record(result('two'))]
    await Promise.resolve()
    expect(h.boundary).toHaveBeenCalledTimes(1)
    expect(h.storage.getItem).toHaveBeenCalledTimes(1)
    expect(h.values.has(RESULTS_STORAGE_KEY)).toBe(false)
    expect(first.getSnapshot().history.recent).toEqual([])
    expect(callback).not.toHaveBeenCalled()
    h.gate.resolve()
    expect((await Promise.all(operations)).every(response => response.ok)).toBe(true)
    expect(parseHistory(h.values.get(RESULTS_STORAGE_KEY)).recent.map(item => item.id)).toEqual(['two', 'one'])
    expect(h.boundary).toHaveBeenCalledTimes(2)
  })

  it.each([
    ['save-then-clear', []],
    ['clear-then-save', ['new']],
  ])('preserves %s ordering when each mutation is buffered until the task boundary', async (order, expected) => {
    const raw = saved(result('existing', { wpm: 200 }))
    const h = bufferedStorage(raw)
    const first = h.createBuffered()
    const second = h.createBuffered()
    const operations = order === 'save-then-clear'
      ? [first.record(result('new')), second.clear()]
      : [first.clear(), second.record(result('new'))]
    await Promise.resolve()
    expect(h.values.get(RESULTS_STORAGE_KEY)).toBe(raw)
    expect(first.getSnapshot().history.recent[0].id).toBe('existing')
    h.gate.resolve()
    expect((await Promise.all(operations)).every(response => response.ok)).toBe(true)
    const history = parseHistory(h.values.get(RESULTS_STORAGE_KEY) ?? null)
    expect(history.recent.map(item => item.id)).toEqual(expected)
    expect(history.bests.short?.id ?? null).toBe(expected[0] ?? null)
    expect(h.values.get('another-app')).toBe('leave this alone')
  })

  it('uses a browser task by default rather than releasing after only a microtask', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    try {
      const h = harness()
      const controller = h.create({ waitForNextTask: undefined })
      const pending = controller.record(result())
      await Promise.resolve()
      expect(vi.getTimerCount()).toBe(1)
      expect(controller.getSnapshot().history.recent).toEqual([])
      await vi.runAllTimersAsync()
      expect(await pending).toEqual({ ok: true, outcome: 'saved' })
      expect(controller.getSnapshot().history.recent[0].id).toBe('result-1')
    } finally {
      vi.useRealTimers()
    }
  })
})
