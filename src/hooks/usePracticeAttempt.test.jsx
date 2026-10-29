import { StrictMode } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { usePracticeAttempt } from './usePracticeAttempt.js'

function AttemptHarness() {
  const { attempt, inputRef, inputVersion, handleChange, restriction, restart } = usePracticeAttempt('cat')

  return (
    <>
      <textarea
        aria-label="Typing"
        key={inputVersion}
        ref={inputRef}
        value={attempt.input}
        onChange={handleChange}
        maxLength={3}
        readOnly={attempt.status === 'completed'}
      />
      <button onClick={restart}>Restart</button>
      <output aria-label="Attempt">{JSON.stringify(attempt)}</output>
      <p>{restriction}</p>
    </>
  )
}

function readAttempt() {
  return JSON.parse(screen.getByLabelText('Attempt').textContent)
}

function nativeInput(input, value, options = {}) {
  const { inputType = 'insertText', data = null, isComposing = false } = options
  input.dispatchEvent(new InputEvent('beforeinput', {
    bubbles: true, cancelable: true, inputType, data, isComposing,
  }))
  fireEvent.input(input, { target: { value }, inputType, data, isComposing })
}

describe('React attempt integration', () => {
  it('handles each native edit once under Strict Mode, including an unchanged-value replacement', async () => {
    const user = userEvent.setup()
    render(<StrictMode><AttemptHarness /></StrictMode>)
    const input = screen.getByRole('textbox')

    await user.type(input, 'cx')
    expect(readAttempt()).toMatchObject({ input: 'cx', totalEntries: 2, correctEntries: 1 })
    input.setSelectionRange(0, 1)
    await user.keyboard('c')
    expect(readAttempt()).toMatchObject({ input: 'cx', totalEntries: 3, correctEntries: 2 })

    input.setSelectionRange(1, 2)
    await user.keyboard('at')
    expect(readAttempt()).toMatchObject({ status: 'completed', totalEntries: 5, correctEntries: 4 })
    expect(input).toHaveAttribute('readonly')
  })

  it('keeps the first timestamp and entry history after deleting everything', async () => {
    const user = userEvent.setup()
    render(<AttemptHarness />)
    const input = screen.getByRole('textbox')

    await user.type(input, 'cx')
    const startedAt = readAttempt().startedAt
    await user.clear(input)
    expect(readAttempt()).toMatchObject({
      status: 'running', input: '', startedAt, totalEntries: 2, correctEntries: 1,
    })
    await user.type(input, 'cat')
    expect(readAttempt()).toMatchObject({
      status: 'completed', startedAt, totalEntries: 5, correctEntries: 4,
    })
  })

  it('replaces the native field on Restart, resets its model, and returns focus', async () => {
    const user = userEvent.setup()
    render(<StrictMode><AttemptHarness /></StrictMode>)
    let input = screen.getByRole('textbox')

    await user.type(input, 'cx')
    await user.paste('a')
    expect(screen.getByText(/Paste is unavailable/)).toBeVisible()
    const oldInput = input
    await user.click(screen.getByRole('button', { name: 'Restart' }))
    input = screen.getByRole('textbox')

    expect(oldInput.isConnected).toBe(false)
    expect(input).not.toBe(oldInput)
    expect(input).toHaveFocus()
    expect(input).toHaveValue('')
    expect(readAttempt()).toMatchObject({
      status: 'ready', startedAt: null, finishedAt: null, totalEntries: 0, correctEntries: 0,
      isComposing: false, scoringUnavailableReason: null,
    })
    expect(screen.queryByText(/Paste is unavailable/)).toBeNull()

    await user.type(input, 'cat')
    expect(readAttempt()).toMatchObject({ status: 'completed', totalEntries: 3, correctEntries: 3 })
  })

  it('does not let blocked clipboard actions alter timestamps or historical counters', async () => {
    const user = userEvent.setup()
    render(<AttemptHarness />)
    const input = screen.getByRole('textbox')
    await user.type(input, 'cx')
    input.setSelectionRange(1, 2)
    const previous = readAttempt()

    await user.paste('a')
    expect(fireEvent.drop(input)).toBe(false)
    expect(readAttempt()).toEqual(previous)
    expect(input).toHaveValue('cx')
  })

  it('keeps matching composition text editable until commit, then counts it once', async () => {
    render(<StrictMode><AttemptHarness /></StrictMode>)
    const input = screen.getByRole('textbox')
    input.focus()

    act(() => {
      fireEvent.compositionStart(input)
      nativeInput(input, 'cat', { inputType: 'insertCompositionText', data: 'cat', isComposing: true })
    })
    expect(input).toHaveValue('cat')
    expect(input).not.toHaveAttribute('readonly')
    expect(readAttempt()).toMatchObject({ status: 'running', totalEntries: 0, isComposing: true })

    await act(async () => {
      fireEvent.compositionEnd(input, { data: 'cat' })
      await Promise.resolve()
    })
    expect(input).toHaveAttribute('readonly')
    expect(readAttempt()).toMatchObject({
      status: 'completed', totalEntries: 3, correctEntries: 3, isComposing: false,
    })
  })

  it('discards queued composition completion from a restarted, detached field', async () => {
    render(<AttemptHarness />)
    const oldInput = screen.getByRole('textbox')

    await act(async () => {
      fireEvent.compositionStart(oldInput)
      nativeInput(oldInput, 'cat', { inputType: 'insertCompositionText', data: 'cat', isComposing: true })
      fireEvent.compositionEnd(oldInput, { data: 'cat' })
      fireEvent.click(screen.getByRole('button', { name: 'Restart' }))
      await Promise.resolve()
    })

    expect(screen.getByRole('textbox')).not.toBe(oldInput)
    expect(screen.getByRole('textbox')).toHaveValue('')
    expect(readAttempt()).toMatchObject({ status: 'ready', totalEntries: 0, isComposing: false })
    expect(screen.getByRole('textbox')).toHaveFocus()
  })

  it('preserves a change with missing metadata as unscored and resets that condition on Restart', async () => {
    const user = userEvent.setup()
    render(<AttemptHarness />)
    const input = screen.getByRole('textbox')

    fireEvent.change(input, { target: { value: 'cx' } })
    expect(input).toHaveValue('cx')
    expect(readAttempt().scoringUnavailableReason).toBe('untracked-edit')
    await user.click(screen.getByRole('button', { name: 'Restart' }))
    expect(readAttempt().scoringUnavailableReason).toBeNull()
  })

})
