import { afterEach, describe, expect, it, vi } from 'vitest'
import { attachPracticeInput } from './attachPracticeInput.js'
import { createAttempt, getAttemptMetrics } from './practiceAttempt.js'

const cleanups = []
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup()
})

function setup(passage = 'cat') {
  const input = document.createElement('textarea')
  input.maxLength = passage.length
  document.body.append(input)
  const onAttempt = vi.fn()
  const onRestricted = vi.fn()
  let timestamp = 0
  const now = vi.fn(() => timestamp)
  const editor = attachPracticeInput(input, { passage, onAttempt, onRestricted, now })
  cleanups.push(() => {
    editor.dispose()
    input.remove()
  })

  return {
    input, editor, onAttempt, onRestricted, now,
    read: () => onAttempt.mock.calls.at(-1)?.[0] ?? createAttempt(passage),
    time: value => { timestamp = value },
  }
}

// Dispatch an explicit accepted browser result. jsdom does not supply native
// text editing, Undo, IME, or length enforcement for these synthetic events.
function accepted(input, value, {
  start = input.value.length,
  end = start,
  data = null,
  beforeData = data,
  inputType = 'insertText',
  isComposing = false,
  withBeforeInput = true,
} = {}) {
  input.setSelectionRange(start, end)
  if (withBeforeInput) {
    const before = new InputEvent('beforeinput', {
      bubbles: true, cancelable: true, inputType, data: beforeData, isComposing,
    })
    if (!input.dispatchEvent(before)) return
  }

  input.value = value
  input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType, data, isComposing }))
}

describe('native practice input adapter', () => {
  it('starts only on accepted text and delivers a correction exactly once', () => {
    const h = setup()
    h.input.focus()
    expect(h.now).not.toHaveBeenCalled()
    expect(h.onAttempt).not.toHaveBeenCalled()

    accepted(h.input, 'cxt', { data: 'cxt' })
    expect(h.read()).toMatchObject({
      status: 'running', startedAt: 0, correctEntries: 2, totalEntries: 3,
    })

    h.time(3000)
    accepted(h.input, 'cat', { start: 1, end: 2, data: 'a' })
    expect(h.onAttempt).toHaveBeenCalledTimes(2)
    expect(h.read()).toMatchObject({ status: 'completed', finishedAt: 3000 })
    expect(getAttemptMetrics(h.read())).toMatchObject({ elapsedMs: 3000, accuracy: 75 })
    expect(getAttemptMetrics(h.read()).wpm).toBeCloseTo(12)
  })

  it('counts a same-character replacement with no whole-value change', () => {
    const h = setup()
    accepted(h.input, 'cx', { data: 'cx' })
    accepted(h.input, 'cx', { start: 0, end: 1, data: 'c' })

    expect(h.read()).toMatchObject({ correctEntries: 2, totalEntries: 3 })
    expect(h.onAttempt).toHaveBeenCalledTimes(2)
  })

  it.each([[0, 2], [1, 1]])('uses the actual selection for repeated characters at %i', (start, correctEntries) => {
    const h = setup('abcd')
    accepted(h.input, 'aa', { data: 'aa' })
    accepted(h.input, 'aaa', { start, data: 'a' })

    expect(h.read()).toMatchObject({ correctEntries, totalEntries: 3 })
  })

  it('does not recount shifted suffixes, and keeps its start after clearing', () => {
    const h = setup('abc')
    h.time(100)
    accepted(h.input, 'axc', { data: 'axc' })
    accepted(h.input, 'ac', { start: 1, end: 2, inputType: 'deleteContentBackward' })
    expect(h.read()).toMatchObject({ correctEntries: 2, totalEntries: 3 })

    accepted(h.input, '', { start: 0, end: 2, inputType: 'deleteByCut' })
    h.time(10_000)
    accepted(h.input, 'a', { data: 'a' })
    expect(h.read()).toMatchObject({ status: 'running', startedAt: 100, totalEntries: 4 })
  })

  it('preserves entry history through Undo and Redo', () => {
    const h = setup()
    accepted(h.input, 'cx', { data: 'cx' })
    accepted(h.input, 'c', { inputType: 'historyUndo' })
    accepted(h.input, 'cx', { inputType: 'historyRedo' })
    accepted(h.input, 'cat', { start: 1, end: 2, data: 'at' })

    expect(h.read()).toMatchObject({ status: 'completed', totalEntries: 4, correctEntries: 3 })
  })

  it('counts only the accepted part of a length-limited insertion', () => {
    const h = setup('abcde')
    accepted(h.input, 'abXd', { data: 'abXd' })
    accepted(h.input, 'abcZd', { start: 2, end: 3, data: 'cZ', beforeData: 'cZZZ' })

    expect(h.read()).toMatchObject({ input: 'abcZd', totalEntries: 6, correctEntries: 4 })
  })

  it('accepts line breaks as actual newline entries', () => {
    const h = setup('a b')
    accepted(h.input, 'a', { data: 'a' })
    accepted(h.input, 'a\n', { inputType: 'insertLineBreak' })
    accepted(h.input, 'a\nb', { data: 'b' })

    expect(h.read()).toMatchObject({ status: 'running', totalEntries: 3, correctEntries: 2 })
  })

  it('keeps editing but suppresses scores when a before-edit snapshot is missing', () => {
    const h = setup()
    accepted(h.input, 'cx', { data: 'cx', withBeforeInput: false })
    h.time(1000)
    accepted(h.input, 'cat', { start: 1, end: 2, data: 'at' })

    expect(h.read()).toMatchObject({ input: 'cat', scoringUnavailableReason: 'untracked-edit' })
    expect(getAttemptMetrics(h.read())).toEqual({ elapsedMs: 1000, wpm: null, accuracy: null })
  })

  it('does not guess an autocorrection range that differs from the reported selection', () => {
    const h = setup()
    accepted(h.input, 'cxt', { data: 'cxt' })
    accepted(h.input, 'cat', { start: 3, data: 'cat', inputType: 'insertReplacementText' })

    expect(h.input.value).toBe('cat')
    expect(h.read().scoringUnavailableReason).toBe('untracked-edit')
  })

  it.each(['paste', 'drop'])('blocks %s without starting or changing an attempt', type => {
    const h = setup()
    const readyEvent = new Event(type, { bubbles: true, cancelable: true })
    h.input.dispatchEvent(readyEvent)
    expect(readyEvent.defaultPrevented).toBe(true)
    expect(h.input.value).toBe('')
    expect(h.now).not.toHaveBeenCalled()
    expect(h.onAttempt).not.toHaveBeenCalled()

    accepted(h.input, 'cx', { data: 'cx' })
    const previous = h.read()
    h.input.setSelectionRange(1, 2)
    const runningEvent = new Event(type, { bubbles: true, cancelable: true })
    h.input.dispatchEvent(runningEvent)

    expect(runningEvent.defaultPrevented).toBe(true)
    expect(h.input.value).toBe('cx')
    expect(h.input.selectionStart).toBe(1)
    expect(h.input.selectionEnd).toBe(2)
    expect(h.read()).toBe(previous)
    expect(h.now).toHaveBeenCalledTimes(1)
    expect(h.onRestricted).toHaveBeenLastCalledWith(type)
  })

  it('preserves an unrelated untracked edit after a canceled paste', () => {
    const h = setup()
    h.input.dispatchEvent(new Event('paste', { bubbles: true, cancelable: true }))
    accepted(h.input, 'cx', { data: 'cx', withBeforeInput: false })

    expect(h.input.value).toBe('cx')
    expect(h.read()).toMatchObject({
      status: 'running', input: 'cx', scoringUnavailableReason: 'untracked-edit',
    })
  })

  it('also prevents insertion-specific paste/drop events and reverts an uncancelable insertion', () => {
    const h = setup()
    accepted(h.input, 'cx', { data: 'cx' })
    const previous = h.read()
    h.input.setSelectionRange(1, 2)

    const before = new InputEvent('beforeinput', {
      bubbles: true, cancelable: false, inputType: 'insertFromPaste', data: 'a',
    })
    h.input.dispatchEvent(before)
    h.input.value = 'cat'
    h.input.dispatchEvent(new InputEvent('input', {
      bubbles: true, inputType: 'insertFromPaste', data: 'at',
    }))

    expect(h.input.value).toBe('cx')
    expect([h.input.selectionStart, h.input.selectionEnd]).toEqual([1, 2])
    expect(h.read()).toBe(previous)
    expect(h.now).toHaveBeenCalledTimes(1)

    const drop = new InputEvent('beforeinput', {
      bubbles: true, cancelable: true, inputType: 'insertFromDrop', data: 'a',
    })
    h.input.dispatchEvent(drop)
    expect(drop.defaultPrevented).toBe(true)
  })

  it('keeps matching provisional text editable and scores it only at composition commit', async () => {
    const h = setup()
    h.input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
    accepted(h.input, 'c', { inputType: 'insertCompositionText', data: 'c', isComposing: true })
    accepted(h.input, 'cat', { inputType: 'insertCompositionText', data: 'cat', isComposing: true })
    expect(h.read()).toMatchObject({ status: 'running', isComposing: true, totalEntries: 0 })

    h.time(1000)
    h.input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: 'cat' }))
    await Promise.resolve()

    expect(h.read()).toMatchObject({
      status: 'completed', isComposing: false, totalEntries: 3, correctEntries: 3, finishedAt: 1000,
    })
    expect(h.onAttempt).toHaveBeenCalledTimes(3)
  })

  it('handles compositionend before the final input without counting twice', async () => {
    const h = setup('cats')
    h.input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
    accepted(h.input, 'ca', { inputType: 'insertCompositionText', data: 'ca', isComposing: true })
    h.input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: 'cat' }))
    accepted(h.input, 'cat', { inputType: 'insertFromComposition', data: 'cat' })
    await Promise.resolve()

    expect(h.read()).toMatchObject({ status: 'running', totalEntries: 3, correctEntries: 3 })
    expect(h.onAttempt).toHaveBeenCalledTimes(2)
  })

  it('ignores a trailing unchanged-value composition input notification', async () => {
    const h = setup('cats')
    h.input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
    accepted(h.input, 'cat', { inputType: 'insertCompositionText', data: 'cat', isComposing: true })
    h.input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: 'cat' }))
    await Promise.resolve()
    accepted(h.input, 'cat', { inputType: 'insertFromComposition', data: 'cat' })

    expect(h.read()).toMatchObject({
      totalEntries: 3, correctEntries: 3, scoringUnavailableReason: null,
    })
    expect(h.onAttempt).toHaveBeenCalledTimes(2)
  })

  it('does not count canceled composition or reset a start that has already occurred', async () => {
    const h = setup()
    h.input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
    h.time(100)
    accepted(h.input, 'x', { inputType: 'insertCompositionText', data: 'x', isComposing: true })
    h.input.value = ''
    h.input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '' }))
    await Promise.resolve()

    expect(h.read()).toMatchObject({
      input: '', status: 'running', startedAt: 100, totalEntries: 0, correctEntries: 0,
      isComposing: false, scoringUnavailableReason: null,
    })
  })

  it('counts a composition replacing an existing selection only once', async () => {
    const h = setup()
    accepted(h.input, 'cxt', { data: 'cxt' })
    h.input.setSelectionRange(1, 2)
    h.input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
    accepted(h.input, 'cat', {
      start: 1, end: 2, inputType: 'insertCompositionText', data: 'a', isComposing: true,
    })
    h.input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: 'a' }))
    await Promise.resolve()

    expect(h.read()).toMatchObject({ status: 'completed', totalEntries: 4, correctEntries: 3 })
  })

  it('preserves a change-only fallback as unscored and does not deliver it twice', () => {
    const h = setup()
    h.input.value = 'cx'
    h.editor.reconcileChange()
    h.editor.reconcileChange()

    expect(h.read()).toMatchObject({ input: 'cx', scoringUnavailableReason: 'untracked-edit' })
    expect(h.onAttempt).toHaveBeenCalledTimes(1)
  })

  it('invalidates queued composition work and detaches all listeners on disposal', async () => {
    const h = setup()
    h.input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
    accepted(h.input, 'cat', { inputType: 'insertCompositionText', data: 'cat', isComposing: true })
    h.input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: 'cat' }))
    h.editor.dispose()
    h.onAttempt.mockClear()
    await Promise.resolve()
    accepted(h.input, 'x', { data: 'x' })
    h.editor.reconcileChange()

    expect(h.onAttempt).not.toHaveBeenCalled()
  })
})
