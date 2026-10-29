import { StrictMode } from 'react'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App.jsx'
import PracticeSession from './PracticeSession.jsx'

let clock

beforeEach(() => {
  clock = 0
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
  vi.spyOn(performance, 'now').mockImplementation(() => clock)
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

function user() {
  return userEvent.setup()
}

function refreshAt(timestamp) {
  clock = timestamp
  act(() => vi.advanceTimersByTime(250))
}

function results() {
  return within(screen.getByRole('region', { name: 'Your results' }))
}

describe('elapsed time and completed results', () => {
  it('waits for the first entry, keeps scores hidden, and excludes ticking time from announcements', async () => {
    const typing = user()
    render(<StrictMode><PracticeSession passage="cat" /></StrictMode>)
    const input = screen.getByRole('textbox')
    const timer = screen.getByRole('timer', { name: 'Elapsed time' })
    expect(timer).toHaveTextContent('0:00')
    expect(timer).toHaveAttribute('aria-live', 'off')
    expect(timer.closest('[role="status"]')).toBeNull()
    expect(screen.queryByRole('region', { name: 'Your results' })).toBeNull()
    expect(vi.getTimerCount()).toBe(0)

    refreshAt(10_000)
    await typing.click(input)
    await typing.paste('cat')
    expect(timer).toHaveTextContent('0:00')
    expect(vi.getTimerCount()).toBe(0)

    clock = 20_000
    await typing.type(input, 'c')
    expect(vi.getTimerCount()).toBe(1)
    const status = screen.getByRole('status').textContent
    refreshAt(21_250)
    expect(timer).toHaveTextContent('0:01')
    expect(screen.getByRole('status').textContent).toBe(status)
    expect(screen.getAllByRole('status')).toHaveLength(1)
    expect(screen.queryByRole('region', { name: 'Your results' })).toBeNull()
  })

  it('uses the actual clock after a delayed callback and keeps counting after clearing or losing focus', async () => {
    const typing = user()
    const intervals = vi.spyOn(globalThis, 'setInterval')
    render(<PracticeSession passage="cat" />)
    const input = screen.getByRole('textbox')
    clock = 500
    await typing.type(input, 'cx')
    expect(intervals.mock.calls[0][1]).toBe(250)

    fireEvent.blur(input)
    refreshAt(60_500)
    expect(screen.getByRole('timer')).toHaveTextContent('1:00')
    await typing.clear(input)
    expect(screen.getByRole('status')).toHaveTextContent('Your attempt is still running.')
    refreshAt(61_500)
    expect(screen.getByRole('timer')).toHaveTextContent('1:01')
    expect(vi.getTimerCount()).toBe(1)
  })

  it('shows 52 WPM for the real 130-character passage completed in thirty seconds', async () => {
    const typing = user()
    render(<App />)
    const input = screen.getByRole('textbox')
    const passage = screen.getByText(/Small steps build steady progress\./, { selector: '.sr-only' }).textContent
    expect(passage).toHaveLength(130)
    clock = 500
    await typing.type(input, passage[0])
    clock = 30_500
    await typing.type(input, passage.slice(1))

    expect(results().getByText('0:30.0')).toBeVisible()
    expect(results().getByText('52')).toBeVisible()
    expect(results().getByText('100.0%')).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent('52 words per minute')
    expect(input).toHaveAttribute('readonly')
    expect(input).toHaveFocus()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('finishes at the correcting edit between ticks and freezes all results and the completion announcement', async () => {
    const typing = user()
    render(<PracticeSession passage="cat" />)
    const input = screen.getByRole('textbox')
    await typing.type(input, 'cxt')
    refreshAt(4000)
    input.setSelectionRange(1, 2)
    clock = 5123
    await typing.keyboard('a')

    expect(results().getByText('0:05.1')).toBeVisible()
    expect(results().getByText('75.0%')).toBeVisible()
    expect(screen.queryByRole('timer')).toBeNull()
    expect(input).toHaveFocus()
    const finalStatus = screen.getByRole('status').textContent
    const finalResults = screen.getByRole('region', { name: 'Your results' }).textContent
    refreshAt(90_000)
    expect(screen.getByRole('status').textContent).toBe(finalStatus)
    expect(screen.getByRole('region', { name: 'Your results' }).textContent).toBe(finalResults)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('rejects an old interval callback after completion, Restart, and a new attempt', async () => {
    const typing = user()
    const intervals = vi.spyOn(globalThis, 'setInterval')
    render(<PracticeSession passage="cat" />)
    let input = screen.getByRole('textbox')
    await typing.type(input, 'c')
    const oldTick = intervals.mock.calls[0][0]
    clock = 1000
    await typing.type(input, 'at')
    const finished = screen.getByRole('status').textContent
    clock = 50_000
    act(() => oldTick())
    expect(screen.getByRole('status').textContent).toBe(finished)

    await typing.click(screen.getByRole('button', { name: 'Restart' }))
    input = screen.getByRole('textbox')
    act(() => oldTick())
    expect(input).toHaveFocus()
    expect(screen.getByRole('timer')).toHaveTextContent('0:00')
    expect(screen.queryByRole('region', { name: 'Your results' })).toBeNull()
    expect(vi.getTimerCount()).toBe(0)

    clock = 60_000
    await typing.type(input, 'c')
    refreshAt(61_000)
    expect(screen.getByRole('timer')).toHaveTextContent('0:01')
    clock = 150_000
    act(() => oldTick())
    expect(screen.getByRole('timer')).toHaveTextContent('0:01')
    expect(vi.getTimerCount()).toBe(1)
  })

  it('clears results and old clock samples even if another attempt starts at the same timestamp', async () => {
    const typing = user()
    render(<StrictMode><PracticeSession passage="cat" /></StrictMode>)
    let input = screen.getByRole('textbox')
    clock = 1000
    await typing.type(input, 'c')
    refreshAt(5000)
    await typing.type(input, 'at')
    expect(results().getByText('0:04.0')).toBeVisible()

    await typing.click(screen.getByRole('button', { name: 'Restart' }))
    input = screen.getByRole('textbox')
    clock = 1000
    await typing.type(input, 'c')
    expect(screen.getByRole('timer')).toHaveTextContent('0:00')
    expect(screen.queryByRole('region', { name: 'Your results' })).toBeNull()
    expect(input).toHaveFocus()
    expect(vi.getTimerCount()).toBe(1)
  })

  it('stops a running timer on unmount and makes a captured callback harmless', async () => {
    const typing = user()
    const intervals = vi.spyOn(globalThis, 'setInterval')
    const { unmount } = render(<StrictMode><PracticeSession passage="cat" /></StrictMode>)
    await typing.type(screen.getByRole('textbox'), 'c')
    const oldTick = intervals.mock.calls[0][0]
    expect(vi.getTimerCount()).toBe(1)
    unmount()
    expect(vi.getTimerCount()).toBe(0)
    vi.mocked(performance.now).mockClear()
    act(() => oldTick())
    expect(performance.now).not.toHaveBeenCalled()
  })

  it('keeps composition provisional until commit and freezes at its end timestamp', async () => {
    render(<PracticeSession passage="cat" />)
    const input = screen.getByRole('textbox')
    fireEvent.compositionStart(input)
    fireEvent.input(input, {
      target: { value: 'cat' }, data: 'cat', inputType: 'insertCompositionText', isComposing: true,
    })
    refreshAt(1250)
    expect(input).not.toHaveAttribute('readonly')
    expect(screen.getByRole('timer')).toHaveTextContent('0:01')
    expect(screen.queryByRole('region', { name: 'Your results' })).toBeNull()

    clock = 2345
    await act(async () => {
      fireEvent.compositionEnd(input, { data: 'cat' })
      await Promise.resolve()
    })
    expect(results().getByText('0:02.3')).toBeVisible()
    expect(results().getByText('100.0%')).toBeVisible()
    expect(input).toHaveAttribute('readonly')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('explains zero-duration speed without hiding valid time and accuracy', async () => {
    const typing = user()
    render(<PracticeSession passage="cat" />)
    await typing.type(screen.getByRole('textbox'), 'cat')

    expect(results().getByText('0:00.0')).toBeVisible()
    expect(results().getByText('100.0%')).toBeVisible()
    expect(results().getByText('—')).toBeVisible()
    expect(results().getByText(/no positive duration was measured/)).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent('Speed: unavailable.')
    expect(screen.getByRole('status')).not.toHaveTextContent('Infinity')
  })

  it('explains missing time while showing independently measured accuracy', async () => {
    const typing = user()
    render(<PracticeSession passage="cat" />)
    const input = screen.getByRole('textbox')
    await typing.type(input, 'c')
    clock = NaN
    await typing.type(input, 'at')

    expect(results().getByText('100.0%')).toBeVisible()
    expect(results().getAllByText('—')).toHaveLength(2)
    expect(results().getByText(/duration could not be measured/)).toBeVisible()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('keeps reliable elapsed time but explains unavailable scores after an untracked edit', () => {
    render(<PracticeSession passage="cat" />)
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'cx' } })
    clock = 3000
    fireEvent.change(input, { target: { value: 'cat' } })

    expect(results().getByText('0:03.0')).toBeVisible()
    expect(results().getAllByText('—')).toHaveLength(2)
    expect(results().getByText(/Speed and accuracy are unavailable because an edit could not be measured/)).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent('Time: 0 minutes and 3.0 seconds.')
  })
})
