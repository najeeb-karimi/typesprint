import { StrictMode } from 'react'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.jsx'
import { INITIAL_PASSAGE_ID, PASSAGES } from './data/passages.js'
import { createHistoryController, RESULTS_STORAGE_KEY } from './lib/createHistoryController.js'
import { appendResult, createEmptyHistory, parseHistory, serializeHistory } from './lib/resultHistory.js'

const initial = PASSAGES.find(passage => passage.id === INITIAL_PASSAGE_ID)
let clock

function result(id = 'older', changes = {}) {
  return {
    id, completedAt: 1_800_000_000_000, passageId: 'steady-progress', category: 'short',
    characterCount: 130, elapsedMs: 30_000, wpm: 52, accuracy: 95,
    scoringUnavailableReason: null, ...changes,
  }
}

function environment(records = []) {
  const values = new Map()
  if (records.length) values.set(RESULTS_STORAGE_KEY,
    serializeHistory(records.reduce(appendResult, createEmptyHistory())))
  const events = new EventTarget()
  const storage = {
    getItem: vi.fn(key => values.get(key) ?? null),
    setItem: vi.fn((key, value) => { values.set(key, value) }),
    removeItem: vi.fn(key => { values.delete(key) }),
  }
  let tail = Promise.resolve()
  const locks = {
    request: vi.fn((name, options, callback) => {
      const pending = tail.then(() => callback({ name, mode: options.mode }))
      tail = pending.catch(() => {})
      return pending
    }),
  }
  function create() {
    const controller = createHistoryController({
      getStorage: () => storage, getLockManager: () => locks, eventTarget: events,
      waitForNextTask: () => Promise.resolve(),
    })
    return { ...controller, record: vi.fn(controller.record), clear: vi.fn(controller.clear) }
  }
  function notify() {
    const event = new Event('storage')
    Object.assign(event, { key: RESULTS_STORAGE_KEY, storageArea: storage })
    events.dispatchEvent(event)
  }
  function remoteRecord(record) {
    const current = parseHistory(values.get(RESULTS_STORAGE_KEY) ?? null)
    values.set(RESULTS_STORAGE_KEY, serializeHistory(appendResult(current, record)))
    notify()
  }
  return { values, events, storage, locks, create, notify, remoteRecord }
}

beforeEach(() => {
  window.history.replaceState(null, '', '/')
  clock = 1000
  vi.spyOn(Math, 'random').mockReturnValue(0)
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
  vi.spyOn(performance, 'now').mockImplementation(() => clock)
  vi.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000)
  let sequence = 0
  vi.spyOn(crypto, 'randomUUID').mockImplementation(() => 'new-' + ++sequence)
  // Only openness is simulated here; native modality is checked in browsers.
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: { configurable: true, value() { this.open = true } },
    close: { configurable: true, value() { this.open = false } },
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.useRealTimers()
  window.history.replaceState(null, '', '/')
  delete HTMLDialogElement.prototype.showModal
  delete HTMLDialogElement.prototype.close
})

function setup(env = environment()) {
  const controller = env.create()
  const user = userEvent.setup()
  const rendered = render(<StrictMode><App historyController={controller} /></StrictMode>)
  return { ...rendered, user, controller, env }
}

function field() {
  return screen.getByRole('textbox', { name: 'Your typing' })
}

function link(name) {
  return screen.getByRole('link', { name, exact: true })
}

async function settle() {
  await act(async () => { await Promise.resolve() })
}

function insertRemainder(input, passage, remainder) {
  fireEvent(input, new InputEvent('beforeinput', {
    bubbles: true, cancelable: true, inputType: 'insertText', data: remainder,
  }))
  fireEvent.input(input, { target: { value: passage }, inputType: 'insertText', data: remainder })
}

async function complete(user, passage = initial.text, start = 1000, finish = 31_000) {
  clock = start
  const input = field()
  await user.type(input, passage[0])
  clock = finish
  insertRemainder(input, passage, passage.slice(1))
  await settle()
  return input
}

function popTo(address) {
  // Supply a changed URL and its traversal notification, not native Back/Forward.
  act(() => {
    window.history.replaceState(null, '', address)
    window.dispatchEvent(new PopStateEvent('popstate'))
  })
}

describe('one-time completion recording', () => {
  it.each(['short', 'medium', 'long'])('saves the final %s snapshot and raw measurements exactly once under Strict Mode', async category => {
    const { user, controller, env, rerender } = setup()
    let passage = initial
    if (category !== 'short') {
      await user.selectOptions(screen.getByRole('combobox'), category)
      await user.click(screen.getByRole('button', { name: 'New passage' }))
      passage = PASSAGES.find(record => record.category === category)
    }
    const input = await complete(user, passage.text)
    expect(controller.record).toHaveBeenCalledTimes(1)
    expect(crypto.randomUUID).toHaveBeenCalledTimes(1)
    const record = controller.record.mock.calls[0][0]
    expect(record).toEqual({
      id: 'new-1', completedAt: 1_800_000_000_000, passageId: passage.id, category,
      characterCount: passage.text.length, elapsedMs: 30_000,
      wpm: (passage.text.length / 5) / 0.5, accuracy: 100, scoringUnavailableReason: null,
    })
    expect(input).toHaveAttribute('readonly')
    expect(screen.getByText('Saved in this browser.')).toBeVisible()
    expect(vi.getTimerCount()).toBe(0)

    rerender(<StrictMode><App historyController={controller} /></StrictMode>)
    await user.click(link('History'))
    expect(screen.getByRole('heading', { level: 1 })).toHaveFocus()
    expect(within(screen.getByRole('list', { name: 'Recent completed attempts' })).getAllByRole('listitem')).toHaveLength(1)
    expect(within(screen.getByRole('region', { name: category[0].toUpperCase() + category.slice(1) }))
      .getByText('100.0%')).toBeVisible()
    await user.click(link('Practice'))
    expect(field()).toBe(input)
    expect(input).toHaveValue(passage.text)
    expect(controller.record).toHaveBeenCalledTimes(1)
    expect(env.storage.setItem).toHaveBeenCalledTimes(1)
  })

  it('restores saved records after remount without replaying a completion', async () => {
    const { user, controller, env, unmount } = setup()
    await complete(user)
    unmount()
    const restored = env.create()
    render(<App historyController={restored} />)
    expect(field()).toHaveValue('')
    expect(field()).not.toHaveFocus()
    expect(screen.queryByRole('region', { name: 'Your results' })).toBeNull()
    await user.click(link('History'))
    expect(screen.getByRole('list', { name: 'Recent completed attempts' }).children).toHaveLength(1)
    expect(controller.record).toHaveBeenCalledTimes(1)
    expect(restored.record).not.toHaveBeenCalled()
    expect(env.storage.setItem).toHaveBeenCalledTimes(1)
  })

  it('records an unavailable completion with its explanation and excludes it from bests', async () => {
    const { user, controller } = setup()
    await user.type(field(), initial.text[0])
    clock = 31_000
    fireEvent.change(field(), { target: { value: initial.text } })
    await settle()
    expect(controller.getSnapshot().history.recent[0]).toMatchObject({
      elapsedMs: 30_000, wpm: null, accuracy: null, scoringUnavailableReason: 'untracked-edit',
    })
    await user.click(link('History'))
    const recent = screen.getByRole('list', { name: 'Recent completed attempts' })
    expect(within(recent).getByText(/Speed and accuracy are unavailable/)).toBeVisible()
    expect(within(recent).getByText('0:30.0')).toBeVisible()
    expect(within(recent).getAllByText('—')).toHaveLength(2)
    expect(screen.getAllByText('No measured result to show.')).toHaveLength(3)
  })

  it('does not record provisional composition and delivers the committed completion once', async () => {
    const { controller } = setup()
    const input = field()
    fireEvent.compositionStart(input)
    fireEvent.input(input, {
      target: { value: initial.text }, inputType: 'insertCompositionText',
      data: initial.text, isComposing: true,
    })
    expect(controller.record).not.toHaveBeenCalled()
    clock = 31_000
    await act(async () => { fireEvent.compositionEnd(input, { data: initial.text }) })
    await settle()
    fireEvent.compositionEnd(input, { data: initial.text })
    fireEvent.change(input, { target: { value: initial.text } })
    await settle()
    expect(controller.record).toHaveBeenCalledTimes(1)
    expect(controller.getSnapshot().history.recent[0]).toMatchObject({ elapsedMs: 30_000, accuracy: 100 })
    expect(input).toHaveAttribute('readonly')
  })

  it('keeps a failed save out of history, does not retry on navigation, and saves a later new attempt', async () => {
    const env = environment([result()])
    const { user, controller, rerender } = setup(env)
    env.storage.setItem.mockImplementationOnce(() => { throw new DOMException('Full', 'QuotaExceededError') })
    const input = await complete(user)
    expect(input).toHaveAttribute('readonly')
    expect(screen.getByRole('region', { name: 'Your results' })).toBeVisible()
    expect(screen.getByText(/This result could not be saved/)).toBeVisible()
    expect(controller.getSnapshot().history.recent.map(item => item.id)).toEqual(['older'])
    await user.click(link('History'))
    expect(screen.getByRole('list', { name: 'Recent completed attempts' }).children).toHaveLength(1)
    await user.click(link('Practice'))
    rerender(<StrictMode><App historyController={controller} /></StrictMode>)
    await settle()
    expect(controller.record).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: 'Restart' }))
    await complete(user, initial.text, 40_000, 70_000)
    expect(controller.getSnapshot().history.recent.map(item => item.id)).toEqual(['new-2', 'older'])
    expect(screen.getByText('Saved in this browser.')).toBeVisible()
    expect(screen.queryByText(/This result could not be saved/)).toBeNull()
  })

  it.each(['identity', 'throw', 'reject'])('preserves the completed result when preparation or the controller fails: %s', async failure => {
    const { user, controller } = setup()
    if (failure === 'identity') {
      vi.mocked(crypto.randomUUID).mockImplementationOnce(() => { throw new Error('Unavailable') })
    } else if (failure === 'throw') {
      controller.record.mockImplementationOnce(() => { throw new Error('Unexpected') })
    } else {
      controller.record.mockRejectedValueOnce(new Error('Unexpected'))
    }
    const input = await complete(user)
    expect(input).toHaveAttribute('readonly')
    expect(screen.getByRole('region', { name: 'Your results' })).toBeVisible()
    expect(screen.getByText(/This result could not be saved/)).toBeVisible()
    expect(controller.getSnapshot().history.recent).toEqual([])
  })

  it('ignores a delayed response for an earlier completion after another attempt has finished', async () => {
    const { user, controller } = setup()
    let finishOld
    controller.record.mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve }))
    await complete(user)
    expect(screen.getByText('Saving result…')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Restart' }))
    expect(screen.queryByText('Saving result…')).toBeNull()
    await complete(user, initial.text, 40_000, 70_000)
    await act(async () => { finishOld({ ok: false, error: { message: 'Old operation failed.' } }) })
    expect(screen.getByText('Saved in this browser.')).toBeVisible()
    expect(screen.queryByText('Old operation failed.')).toBeNull()
    expect(controller.record).toHaveBeenCalledTimes(2)
  })
})

describe('history views and preservation', () => {
  it.each(['/', '/?view=practice', '/?view=unknown'])('opens Practice without autofocus or records at %s', address => {
    window.history.replaceState(null, '', address)
    const { controller } = setup()
    expect(link('Practice')).toHaveAttribute('aria-current', 'page')
    expect(field()).not.toHaveFocus()
    expect(controller.record).not.toHaveBeenCalled()
  })

  it('opens a direct History address, reads stored results, and does not autofocus or record', () => {
    window.history.replaceState(null, '', '/?view=history&sample=one')
    const { controller, env } = setup(environment([result()]))
    expect(link('History')).toHaveAttribute('aria-current', 'page')
    expect(link('Practice')).toHaveAttribute('href', '/?view=practice&sample=one')
    expect(screen.getByRole('heading', { level: 1 })).not.toHaveFocus()
    expect(screen.queryByRole('textbox')).toBeNull()
    // DOM tests check accessibility/inertness; native browsers check clipping.
    expect(screen.getByRole('textbox', { hidden: true }).closest('[inert]')).not.toBeNull()
    expect(document.title).toBe('TypeSprint — History')
    expect(controller.record).not.toHaveBeenCalled()
    expect(env.storage.setItem).not.toHaveBeenCalled()
  })

  it('preserves the running editor, selected text, preference, clock and accounting across links and traversal notifications', async () => {
    const { user, controller } = setup()
    const input = field()
    const intervals = vi.spyOn(globalThis, 'setInterval')
    await user.type(input, 'Sx')
    await user.selectOptions(screen.getByRole('combobox'), 'long')
    input.setSelectionRange(1, 2)
    const adds = vi.spyOn(input, 'addEventListener')
    const removes = vi.spyOn(input, 'removeEventListener')
    await user.click(link('History'))
    expect(window.location.search).toBe('?view=history')
    expect(input).toBeInTheDocument()
    expect(input.closest('[inert]')).not.toBeNull()
    expect(screen.queryByRole('textbox')).toBeNull()
    clock = 11_000
    act(() => vi.advanceTimersByTime(250))
    popTo('/?view=practice')
    expect(screen.getByRole('heading', { level: 1 })).toHaveFocus()
    expect(field()).toBe(input)
    expect(input).toHaveValue('Sx')
    expect([input.selectionStart, input.selectionEnd]).toEqual([1, 2])
    expect(screen.getByRole('combobox')).toHaveValue('long')
    expect(screen.getByRole('timer')).toHaveTextContent('0:10')
    popTo('/?view=history')
    expect(screen.getByRole('heading', { level: 1 })).toHaveFocus()
    await user.click(link('Practice'))
    expect(adds).not.toHaveBeenCalled()
    expect(removes).not.toHaveBeenCalled()
    expect(intervals).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(1)
    expect(controller.record).not.toHaveBeenCalled()

    await user.click(input)
    input.setSelectionRange(1, 2)
    await user.keyboard('m')
    clock = 31_000
    insertRemainder(input, initial.text, initial.text.slice(2))
    await settle()
    expect(controller.getSnapshot().history.recent[0]).toMatchObject({
      elapsedMs: 30_000, wpm: 52, accuracy: 130 / 131 * 100,
    })
  })

  it('cancels an open passage decision during traversal without reconnecting or discarding the attempt', async () => {
    const { user, controller } = setup()
    const input = field()
    await user.type(input, 'Sx')
    await user.selectOptions(screen.getByRole('combobox'), 'medium')
    await user.click(screen.getByRole('button', { name: 'New passage' }))
    const dialog = screen.getByRole('dialog')
    const close = vi.spyOn(dialog, 'close')
    popTo('/?view=history')
    expect(close).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('heading', { level: 1 })).toHaveFocus()
    popTo('/?view=practice')
    expect(field()).toBe(input)
    expect(input).toHaveValue('Sx')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('combobox')).toHaveValue('medium')
    expect(controller.record).not.toHaveBeenCalled()
  })

  it('refreshes remote history while typing without reconnecting listeners, resetting time or stealing focus', async () => {
    const { user, controller, env } = setup()
    const input = field()
    await user.type(input, 'S')
    const removes = vi.spyOn(input, 'removeEventListener')
    const adds = vi.spyOn(input, 'addEventListener')
    const announcement = screen.getByRole('status').textContent
    act(() => { env.remoteRecord(result('remote')) })
    expect(field()).toBe(input)
    expect(input).toHaveFocus()
    expect(screen.getByRole('status').textContent).toBe(announcement)
    expect(controller.record).not.toHaveBeenCalled()
    expect(removes).not.toHaveBeenCalled()
    expect(adds).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(1)
    await user.click(link('History'))
    expect(screen.getByRole('list', { name: 'Recent completed attempts' }).children).toHaveLength(1)
  })

  it('leaves a cleared completed attempt visible without saving it again on history updates or return', async () => {
    const { user, controller, env } = setup()
    const input = await complete(user)
    const announcement = screen.getByRole('status').textContent
    act(() => {
      env.values.delete(RESULTS_STORAGE_KEY)
      env.notify()
    })
    expect(field()).toBe(input)
    expect(input).toHaveAttribute('readonly')
    expect(screen.getByRole('status').textContent).toBe(announcement)
    await user.click(link('History'))
    expect(screen.queryByRole('list', { name: 'Recent completed attempts' })).toBeNull()
    await user.click(link('Practice'))
    expect(screen.getByRole('region', { name: 'Your results' })).toBeVisible()
    expect(controller.record).toHaveBeenCalledTimes(1)
    expect(env.storage.setItem).toHaveBeenCalledTimes(1)
  })
})

function rows() {
  return within(screen.getByRole('list', { name: 'Recent completed attempts' })).getAllByRole('listitem')
}

function clearButton() {
  return screen.getByRole('button', { name: 'Clear saved results', exact: true })
}

async function acceptClear(user) {
  await user.click(clearButton())
  const dialog = screen.getByRole('dialog', { name: 'Clear saved results?' })
  await user.click(within(dialog).getByRole('button', { name: 'Clear saved results', exact: true }))
  await settle()
}

describe('history management', () => {
  it('paginates the latest 50 additions in tens while an older all-time best survives pruning', async () => {
    const records = Array.from({ length: 51 }, (_, index) => result('record-' + index, {
      characterCount: 100 + index, wpm: index === 0 ? 200 : 50,
    }))
    const { user, env } = setup(environment(records))
    await user.click(link('History'))
    expect(rows()).toHaveLength(10)
    expect(within(rows()[0]).getByText('Short · 150 characters')).toBeVisible()
    expect(screen.getByText('Showing 1–10 of 50 results')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled()
    expect(within(screen.getByRole('region', { name: 'Short' })).getByText(/100 characters/)).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Recent results' })).not.toHaveFocus()

    for (let page = 2; page <= 5; page++) {
      await user.click(screen.getByRole('button', { name: 'Next page' }))
      expect(screen.getByText('Page ' + page + ' of 5')).toBeVisible()
      expect(rows()).toHaveLength(10)
      expect(screen.getByRole('heading', { name: 'Recent results' })).toHaveFocus()
    }
    expect(within(rows()[9]).getByText('Short · 101 characters')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Previous page' }))
    expect(screen.getByText('Showing 31–40 of 50 results')).toBeVisible()
    expect(env.storage.setItem).not.toHaveBeenCalled()
    expect(env.storage.removeItem).not.toHaveBeenCalled()
  })

  it('keeps a partial final page valid and remote updates quiet without stealing focus', async () => {
    const { user, env } = setup(environment(Array.from({ length: 11 }, (_, index) => result('r-' + index))))
    await user.click(link('History'))
    await user.click(screen.getByRole('button', { name: 'Next page' }))
    expect(rows()).toHaveLength(1)
    expect(screen.getByText('Showing 11–11 of 11 results')).toBeVisible()
    clearButton().focus()
    const feedback = screen.getByRole('status').textContent
    act(() => { env.remoteRecord(result('remote')) })
    expect(screen.getByText('Showing 11–12 of 12 results')).toBeVisible()
    expect(rows()).toHaveLength(2)
    expect(clearButton()).toHaveFocus()
    expect(screen.getByRole('status').textContent).toBe(feedback)
  })

  it('clamps a removed page without moving focus and does not revive it when records return', async () => {
    const { user, env } = setup(environment(Array.from({ length: 21 }, (_, index) => result('r-' + index))))
    await user.click(link('History'))
    await user.click(screen.getByRole('button', { name: 'Next page' }))
    await user.click(screen.getByRole('button', { name: 'Next page' }))
    link('History').focus()
    act(() => {
      const smaller = [result('newer'), result('newest')].reduce(appendResult, createEmptyHistory())
      env.values.set(RESULTS_STORAGE_KEY, serializeHistory(smaller))
      env.notify()
    })
    expect(rows()).toHaveLength(2)
    expect(screen.getByText('Page 1 of 1')).toBeVisible()
    expect(link('History')).toHaveFocus()
    act(() => {
      for (let index = 0; index < 20; index++) env.remoteRecord(result('later-' + index))
    })
    expect(screen.getByText('Page 1 of 3')).toBeVisible()
    expect(link('History')).toHaveFocus()
  })

  it('shows an honest empty state with clearing disabled and no page controls', async () => {
    const { user } = setup()
    await user.click(link('History'))
    expect(screen.getByRole('heading', { name: 'A fresh start' })).toBeVisible()
    expect(clearButton()).toBeDisabled()
    expect(screen.queryByRole('navigation', { name: 'Result pages' })).toBeNull()
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  it('focuses Cancel and leaves storage untouched on Cancel, Escape, and backdrop clicks', async () => {
    const { user, controller, env } = setup(environment([result()]))
    await user.click(link('History'))
    await user.click(clearButton())
    let dialog = screen.getByRole('dialog', { name: 'Clear saved results?' })
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus()
    expect(dialog).toHaveAccessibleDescription(/all personal bests.*other open TypeSprint tabs.*current attempt/)
    fireEvent.click(dialog)
    expect(dialog).toHaveAttribute('open')
    expect(controller.clear).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(clearButton()).toHaveFocus()
    await user.click(clearButton())
    dialog = screen.getByRole('dialog')
    fireEvent(dialog, new Event('cancel', { bubbles: false, cancelable: true }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(clearButton()).toHaveFocus()
    expect(env.storage.removeItem).not.toHaveBeenCalled()
    expect(env.storage.setItem).not.toHaveBeenCalled()
  })

  it('clears the latest remote additions and all bests once, retaining unrelated storage and the completed attempt', async () => {
    const { user, controller, env } = setup(environment([result()]))
    env.values.set('unrelated', 'keep me')
    const input = await complete(user)
    await user.click(link('History'))
    await user.click(clearButton())
    const dialog = screen.getByRole('dialog')
    act(() => { env.remoteRecord(result('remote', { category: 'long', wpm: 200 })) })
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus()
    const confirm = within(dialog).getByRole('button', { name: 'Clear saved results', exact: true })
    await act(async () => {
      fireEvent.click(confirm)
      fireEvent.click(confirm)
    })
    await settle()
    expect(controller.clear).toHaveBeenCalledTimes(1)
    expect(controller.getSnapshot().history).toEqual(createEmptyHistory())
    expect(env.values.has(RESULTS_STORAGE_KEY)).toBe(false)
    expect(env.values.get('unrelated')).toBe('keep me')
    expect(screen.getByRole('status')).toHaveTextContent('Saved results cleared.')
    expect(screen.getByRole('heading', { name: 'Recent results' })).toHaveFocus()
    expect(clearButton()).toBeDisabled()
    await user.click(link('Practice'))
    expect(field()).toBe(input)
    expect(input).toHaveValue(initial.text)
    expect(input).toHaveAttribute('readonly')
    expect(screen.getByRole('region', { name: 'Your results' })).toBeVisible()
    expect(controller.record).toHaveBeenCalledTimes(1)
    expect(env.storage.setItem).toHaveBeenCalledTimes(1)
  })

  it('keeps a running attempt and native listeners intact when clearing history', async () => {
    const { user, controller } = setup(environment([result()]))
    await user.type(field(), 'Sx')
    const input = field()
    input.setSelectionRange(1, 2)
    const add = vi.spyOn(input, 'addEventListener')
    const remove = vi.spyOn(input, 'removeEventListener')
    await user.click(link('History'))
    await acceptClear(user)
    clock = 11_000
    act(() => vi.advanceTimersByTime(250))
    await user.click(link('Practice'))
    expect(field()).toBe(input)
    expect(input).toHaveValue('Sx')
    expect([input.selectionStart, input.selectionEnd]).toEqual([1, 2])
    expect(screen.getByRole('timer')).toHaveTextContent('0:10')
    expect(vi.getTimerCount()).toBe(1)
    expect(add).not.toHaveBeenCalled()
    expect(remove).not.toHaveBeenCalled()
    expect(controller.record).not.toHaveBeenCalled()
  })

  it.each(['malformed', 'future'])('preserves %s stored data until explicit confirmation resets it', async type => {
    const env = environment()
    const original = type === 'malformed' ? '{bad-json' : JSON.stringify({ version: 99 })
    env.values.set(RESULTS_STORAGE_KEY, original)
    const { user } = setup(env)
    await user.click(link('History'))
    expect(screen.getByRole('heading', { name: 'Saved results unavailable' })).toBeVisible()
    expect(clearButton()).toBeEnabled()
    expect(screen.getAllByText('Saved best could not be read.')).toHaveLength(3)
    await user.click(clearButton())
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(env.values.get(RESULTS_STORAGE_KEY)).toBe(original)
    expect(env.storage.removeItem).not.toHaveBeenCalled()
    await acceptClear(user)
    expect(env.values.has(RESULTS_STORAGE_KEY)).toBe(false)
    expect(screen.getByRole('heading', { name: 'A fresh start' })).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent('Saved results cleared.')
  })

  it('labels cached results honestly after a remote document becomes unreadable', async () => {
    const { user, env } = setup(environment([result()]))
    await user.click(link('History'))
    act(() => {
      env.values.set(RESULTS_STORAGE_KEY, '{bad')
      env.notify()
    })
    expect(rows()).toHaveLength(1)
    expect(screen.getByText(/Showing the last successfully read results below/)).toBeVisible()
    expect(env.storage.setItem).not.toHaveBeenCalled()
  })

  it.each(['remove', 'read', 'lock', 'reject', 'throw'])('reports a clear failure without losing records or the practice session: %s', async failure => {
    const { user, env, controller } = setup(environment([result()]))
    const input = field()
    await user.click(link('History'))
    if (failure === 'remove') env.storage.removeItem.mockImplementationOnce(() => { throw new Error('Denied') })
    if (failure === 'read') env.storage.getItem.mockImplementationOnce(() => { throw new Error('Denied') })
    if (failure === 'lock') env.locks.request.mockRejectedValueOnce(new Error('Denied'))
    if (failure === 'reject') controller.clear.mockRejectedValueOnce(new Error('Unexpected'))
    if (failure === 'throw') controller.clear.mockImplementationOnce(() => { throw new Error('Unexpected') })
    await acceptClear(user)
    expect(rows()).toHaveLength(1)
    expect(screen.getByRole('status').textContent).toMatch(/could not/)
    expect(screen.queryByText('Saved results cleared.')).toBeNull()
    expect(env.values.has(RESULTS_STORAGE_KEY)).toBe(true)
    expect(clearButton()).toBeEnabled()
    await user.click(link('Practice'))
    expect(field()).toBe(input)
    expect(input).toHaveValue('')
    await user.click(link('History'))
    await acceptClear(user)
    expect(env.values.has(RESULTS_STORAGE_KEY)).toBe(false)
  })

  it('explains blocked reads and missing locks without disrupting Practice', async () => {
    const env = environment([result()])
    env.storage.getItem.mockImplementation(() => { throw new DOMException('Denied', 'SecurityError') })
    const { user } = setup(env)
    await user.type(field(), 'S')
    await user.click(link('History'))
    expect(screen.getByRole('status')).toHaveTextContent('Saved results could not be read')
    expect(clearButton()).toBeEnabled()
    env.storage.getItem.mockImplementation(key => env.values.get(key) ?? null)
    env.locks.request.mockImplementationOnce(() => { throw new Error('Unavailable') })
    await acceptClear(user)
    expect(env.values.has(RESULTS_STORAGE_KEY)).toBe(true)
    await user.click(link('Practice'))
    expect(field()).toHaveValue('S')
  })

  it('cancels an undecided clear on traversal and does not reopen or clear on return', async () => {
    const { user, controller } = setup(environment([result()]))
    await user.click(link('History'))
    await user.click(clearButton())
    const dialog = screen.getByRole('dialog')
    const close = vi.spyOn(dialog, 'close')
    popTo('/?view=practice')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(close).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('heading', { level: 1 })).toHaveFocus()
    popTo('/?view=history')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(controller.clear).not.toHaveBeenCalled()
    expect(rows()).toHaveLength(1)
  })

  it('falls back to the recent heading when another tab empties history before cancellation', async () => {
    const { user, env } = setup(environment([result()]))
    await user.click(link('History'))
    await user.click(clearButton())
    act(() => {
      env.values.delete(RESULTS_STORAGE_KEY)
      env.notify()
    })
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(clearButton()).toBeDisabled()
    expect(screen.getByRole('heading', { name: 'Recent results' })).toHaveFocus()
  })

  it('keeps one pending clear across navigation and does not steal focus when it finishes', async () => {
    const { user, controller } = setup(environment([result()]))
    let finish
    const clear = controller.clear.getMockImplementation()
    controller.clear.mockImplementationOnce(() => new Promise(resolve => { finish = () => clear().then(resolve) }))
    await user.click(link('History'))
    await acceptClear(user)
    expect(screen.getByRole('status')).toHaveTextContent('Clearing saved results…')
    expect(clearButton()).toBeDisabled()
    await user.click(link('Practice'))
    await user.type(field(), 'S')
    await user.click(link('History'))
    expect(clearButton()).toBeDisabled()
    await user.click(link('Practice'))
    field().focus()
    await act(async () => { await finish() })
    expect(field()).toHaveFocus()
    expect(field()).toHaveValue('S')
    expect(controller.clear).toHaveBeenCalledTimes(1)
    await user.click(link('History'))
    expect(screen.getByRole('status')).toHaveTextContent('Saved results cleared.')
  })
})

describe('history recovery boundaries', () => {
  it('does not claim a fresh history when resetting malformed data fails', async () => {
    const env = environment()
    env.values.set(RESULTS_STORAGE_KEY, '{bad')
    const { user } = setup(env)
    await user.click(link('History'))
    env.storage.removeItem.mockImplementationOnce(() => { throw new Error('Denied') })
    await acceptClear(user)
    expect(env.values.get(RESULTS_STORAGE_KEY)).toBe('{bad')
    expect(screen.getByRole('heading', { name: 'Saved results unavailable' })).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'A fresh start' })).toBeNull()
    expect(screen.getByRole('status')).toHaveTextContent('could not be cleared')
  })

  it('explains unavailable browser locking and leaves saved data unchanged', async () => {
    const env = environment([result()])
    const { user } = setup(env)
    env.locks.request = undefined
    await user.click(link('History'))
    await acceptClear(user)
    expect(screen.getByRole('status')).toHaveTextContent('Safe result saving is unavailable')
    expect(screen.getByText(/Use a current browser over HTTPS or localhost/)).toBeVisible()
    expect(env.values.has(RESULTS_STORAGE_KEY)).toBe(true)
    expect(env.storage.removeItem).not.toHaveBeenCalled()
    await user.click(link('Practice'))
    await user.type(field(), 'S')
    expect(field()).toHaveValue('S')
  })
})
