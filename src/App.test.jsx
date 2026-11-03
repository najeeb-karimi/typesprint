import { StrictMode } from 'react'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.jsx'
import { INITIAL_PASSAGE_ID, PASSAGES } from './data/passages.js'

const initial = PASSAGES.find(passage => passage.id === INITIAL_PASSAGE_ID)
let clock
let random

// React lazily initializes its async act scheduler with its own Math.random
// call. Initialize it before spying so these counts measure application draws.
beforeAll(async () => {
  await act(async () => {})
})

beforeEach(() => {
  clock = 1000
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
  vi.spyOn(performance, 'now').mockImplementation(() => clock)
  random = vi.spyOn(Math, 'random').mockReturnValue(0)

  // jsdom has no native modality. Model open/close only; browser checks must
  // establish actual inertness, keyboard containment, Escape, and Undo.
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: { configurable: true, value() { this.open = true } },
    close: { configurable: true, value() { this.open = false } },
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.useRealTimers()
  delete HTMLDialogElement.prototype.showModal
  delete HTMLDialogElement.prototype.close
})

function setup() {
  const user = userEvent.setup({ delay: null })
  const view = render(<StrictMode><App /></StrictMode>)
  return { user, ...view }
}

function input() {
  return screen.getByRole('textbox', { name: 'Your typing' })
}

function lengthChoice() {
  return screen.getByRole('combobox', { name: 'Next passage length' })
}

function newPassage() {
  return screen.getByRole('button', { name: 'New passage' })
}

function refreshAt(timestamp) {
  clock = timestamp
  act(() => vi.advanceTimersByTime(250))
}

describe('passage controls and safe switching', () => {
  it('preserves ready practice on a preference change, then draws once and focuses a fresh matching passage', async () => {
    const { user, unmount } = setup()
    const originalInput = input()
    expect(screen.getByText('Short · 130 characters')).toBeVisible()
    expect(originalInput).not.toHaveFocus()
    expect(random).not.toHaveBeenCalled()

    await user.selectOptions(lengthChoice(), 'medium')
    expect(lengthChoice()).toHaveFocus()
    expect(input()).toBe(originalInput)
    expect(screen.getByText('Short · 130 characters')).toBeVisible()
    expect(screen.getByRole('timer')).toHaveTextContent('0:00')
    expect(random).not.toHaveBeenCalled()

    await user.click(newPassage())
    const chosen = PASSAGES.find(passage => passage.category === 'medium')
    expect(random).toHaveBeenCalledTimes(1)
    expect(input()).not.toBe(originalInput)
    expect(input()).toHaveValue('')
    expect(input()).toHaveFocus()
    expect(input()).toHaveAttribute('maxlength', String(chosen.text.length))
    expect(screen.getByRole('progressbar')).toHaveAttribute('max', String(chosen.text.length))
    expect(screen.getByText('Medium · ' + chosen.text.length + ' characters')).toBeVisible()
    expect(lengthChoice()).toHaveValue('medium')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(vi.getTimerCount()).toBe(0)

    unmount()
    render(<App />)
    expect(screen.getByText('Short · 130 characters')).toBeVisible()
    expect(lengthChoice()).toHaveValue('short')
    expect(input()).not.toHaveFocus()
    expect(random).toHaveBeenCalledTimes(1)
  })

  it('restarts the same passage while retaining the requested length and drawing nothing', async () => {
    const { user } = setup()
    await user.type(input(), 'Sx')
    await user.selectOptions(lengthChoice(), 'long')
    await user.click(screen.getByRole('button', { name: 'Restart' }))
    expect(input()).toHaveValue('')
    expect(input()).toHaveFocus()
    expect(lengthChoice()).toHaveValue('long')
    expect(screen.getByText('Short · 130 characters')).toBeVisible()
    expect(screen.getByRole('timer')).toHaveTextContent('0:00')
    expect(vi.getTimerCount()).toBe(0)
    expect(random).not.toHaveBeenCalled()
  })

  it.each(['button', 'Escape'])('preserves the field, selection, history, and running clock when canceled by %s', async method => {
    const { user } = setup()
    const originalInput = input()
    const intervals = vi.spyOn(globalThis, 'setInterval')
    await user.type(originalInput, 'Sx')
    const removes = vi.spyOn(originalInput, 'removeEventListener')
    const adds = vi.spyOn(originalInput, 'addEventListener')
    originalInput.setSelectionRange(1, 2)

    await user.selectOptions(lengthChoice(), 'medium')
    expect(input()).toBe(originalInput)
    expect(lengthChoice()).toHaveFocus()
    await user.click(newPassage())
    const dialog = screen.getByRole('dialog', { name: 'Change passage?' })
    expect(dialog).toHaveAccessibleDescription(
      'Changing passages discards your current attempt. Elapsed time continues while you decide.',
    )
    expect(within(dialog).getByRole('button', { name: 'Keep current attempt' })).toHaveFocus()
    expect(random).not.toHaveBeenCalled()
    refreshAt(11_000)
    expect(screen.getByRole('timer')).toHaveTextContent('0:10')
    expect(intervals).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(1)
    expect(input()).toBe(originalInput)
    expect([originalInput.selectionStart, originalInput.selectionEnd]).toEqual([1, 2])

    if (method === 'button') {
      await user.click(within(dialog).getByRole('button', { name: 'Keep current attempt' }))
    } else {
      // Dispatch the browser's cancel event; this does not test native Escape.
      expect(fireEvent(dialog, new Event('cancel', { cancelable: true }))).toBe(false)
    }
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(newPassage()).toHaveFocus()
    expect(input()).toBe(originalInput)
    expect(input()).toHaveValue('Sx')
    expect([originalInput.selectionStart, originalInput.selectionEnd]).toEqual([1, 2])
    expect(lengthChoice()).toHaveValue('medium')
    expect(random).not.toHaveBeenCalled()
    expect(removes).not.toHaveBeenCalled()
    expect(adds).not.toHaveBeenCalled()

    await user.click(originalInput)
    originalInput.setSelectionRange(1, 2)
    await user.keyboard('m')
    clock = 31_000
    await user.type(originalInput, initial.text.slice(2))
    const results = within(screen.getByRole('region', { name: 'Your results' }))
    expect(results.getByText('0:30.0')).toBeVisible()
    expect(results.getByText('52')).toBeVisible()
    expect(results.getByText('99.2%')).toBeVisible()
    expect(random).not.toHaveBeenCalled()
  })

  it('confirms a cleared running attempt, closes before replacing, and rejects obsolete editor and timer work', async () => {
    const { user } = setup()
    const originalInput = input()
    const intervals = vi.spyOn(globalThis, 'setInterval')
    await user.type(originalInput, 'Sx')
    const oldTick = intervals.mock.calls[0][0]
    await user.clear(originalInput)
    expect(screen.getByRole('status')).toHaveTextContent('Your attempt is still running.')
    await user.selectOptions(lengthChoice(), 'long')
    await user.click(newPassage())
    const dialog = screen.getByRole('dialog')
    const close = vi.spyOn(dialog, 'close')
    random.mockImplementation(() => {
      expect(dialog.open).toBe(false)
      return 0
    })
    const confirm = within(dialog).getByRole('button', { name: 'Discard and change' })
    act(() => {
      fireEvent.click(confirm)
      fireEvent.click(confirm)
    })
    const chosen = PASSAGES.find(passage => passage.category === 'long')
    expect(close).toHaveBeenCalledTimes(1)
    expect(random).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(originalInput.isConnected).toBe(false)
    expect(input()).toHaveFocus()
    expect(input()).toHaveValue('')
    expect(screen.getByText('Long · ' + chosen.text.length + ' characters')).toBeVisible()
    expect(vi.getTimerCount()).toBe(0)

    vi.mocked(performance.now).mockClear()
    act(() => {
      oldTick()
      fireEvent.input(originalInput, { target: { value: initial.text }, inputType: 'insertText' })
      fireEvent.compositionEnd(originalInput, { data: initial.text })
    })
    expect(performance.now).not.toHaveBeenCalled()
    expect(input()).toHaveValue('')
    expect(screen.getByRole('timer')).toHaveTextContent('0:00')
    expect(screen.queryByRole('region', { name: 'Your results' })).toBeNull()

    clock = 50_000
    await user.type(input(), chosen.text[0])
    refreshAt(51_000)
    expect(screen.getByRole('timer')).toHaveTextContent('0:01')
    expect(vi.getTimerCount()).toBe(1)
  })

  it('uses the captured request and ignores backdrop clicks', async () => {
    const { user } = setup()
    await user.type(input(), 'S')
    await user.selectOptions(lengthChoice(), 'medium')
    await user.click(newPassage())
    const dialog = screen.getByRole('dialog')
    await user.click(dialog)
    expect(screen.getByRole('dialog')).toBe(dialog)
    expect(random).not.toHaveBeenCalled()

    // Native modality prevents this outside interaction. Simulate a state change
    // to prove confirmation uses its captured request rather than a live value.
    fireEvent.change(lengthChoice(), { target: { value: 'long' } })
    await user.click(within(dialog).getByRole('button', { name: 'Discard and change' }))
    const chosen = PASSAGES.find(passage => passage.category === 'medium')
    expect(screen.getByText('Medium · ' + chosen.text.length + ' characters')).toBeVisible()
    expect(lengthChoice()).toHaveValue('long')
    expect(random).toHaveBeenCalledTimes(1)
  })

  it('replaces completed unavailable results immediately and clears restrictions for a scoreable attempt', async () => {
    const { user } = setup()
    fireEvent.change(input(), { target: { value: initial.text } })
    expect(screen.getByRole('region', { name: 'Your results' })).toHaveTextContent('unavailable')
    await user.selectOptions(lengthChoice(), 'short')
    expect(screen.getByRole('region', { name: 'Your results' })).toBeVisible()
    await user.click(newPassage())
    const chosen = PASSAGES.filter(passage =>
      passage.category === 'short' && passage.id !== INITIAL_PASSAGE_ID)[0]
    expect(random).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByRole('region', { name: 'Your results' })).toBeNull()
    expect(input()).toHaveValue('')
    expect(input()).toHaveFocus()
    expect(screen.getByRole('status')).not.toHaveTextContent('unavailable')
    expect(screen.getByText('Short · ' + chosen.text.length + ' characters')).toBeVisible()

    await user.paste('blocked')
    expect(screen.getByRole('status')).toHaveTextContent('Paste is unavailable.')
    await user.click(newPassage())
    expect(screen.getByRole('status')).not.toHaveTextContent('Paste is unavailable.')
    expect(input()).toHaveValue('')
    const nextText = initial.text
    clock = 10_000
    await user.type(input(), nextText[0])
    clock = 40_000
    await user.type(input(), nextText.slice(1))
    const results = within(screen.getByRole('region', { name: 'Your results' }))
    expect(results.getByText('52')).toBeVisible()
    expect(results.getByText('100.0%')).toBeVisible()
  })

  it('disables passage changes at composition start, including before text, and recovers after cancellation or commit', async () => {
    const { user } = setup()
    const originalInput = input()
    fireEvent.compositionStart(originalInput)
    expect(newPassage()).toBeDisabled()
    expect(newPassage()).toHaveAccessibleDescription(
      'Finish composing the current text before changing passages.',
    )
    expect(screen.getByRole('timer')).toHaveTextContent('0:00')
    expect(vi.getTimerCount()).toBe(0)
    await user.click(newPassage())
    expect(input()).toBe(originalInput)
    expect(random).not.toHaveBeenCalled()
    await act(async () => {
      fireEvent.compositionEnd(originalInput, { data: '' })
      await Promise.resolve()
    })
    expect(newPassage()).toBeEnabled()
    expect(screen.queryByText(/before changing passages/)).toBeNull()

    fireEvent.compositionStart(originalInput)
    fireEvent.input(originalInput, {
      target: { value: 'S' }, inputType: 'insertCompositionText', data: 'S', isComposing: true,
    })
    expect(newPassage()).toBeDisabled()
    expect(vi.getTimerCount()).toBe(1)
    await act(async () => {
      fireEvent.compositionEnd(originalInput, { data: 'S' })
      await Promise.resolve()
    })
    expect(newPassage()).toBeEnabled()
    await user.click(newPassage())
    expect(screen.getByRole('dialog')).toBeVisible()
    expect(random).not.toHaveBeenCalled()
  })
})
