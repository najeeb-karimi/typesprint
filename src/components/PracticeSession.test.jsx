import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App.jsx'
import PracticeSession from './PracticeSession.jsx'

const PASSAGE =
  'Small steps build steady progress. Take a breath, find your rhythm, and let each careful keystroke bring the next word into focus.'
const READY_MESSAGE =
  'Type the passage above. Match every character, including spaces and punctuation.'

describe('untimed practice', () => {
  it('opens ready for editing without autofocus, with clear keyboard order and a coherent passage', async () => {
    const user = userEvent.setup()
    render(<App />)
    const input = screen.getByRole('textbox', { name: 'Your typing' })
    const progress = screen.getByRole('progressbar', { name: 'Passage progress' })

    expect(input).not.toHaveFocus()
    expect(input).not.toHaveAttribute('readonly')
    expect(input).toHaveValue('')
    expect(input).toHaveAttribute('maxlength', '130')
    expect(input).toHaveAccessibleDescription(PASSAGE + ' ' + READY_MESSAGE)
    expect(progress).toHaveAttribute('value', '0')
    expect(progress).toHaveAttribute('max', '130')
    expect(screen.getByText('0 current mistakes')).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent(READY_MESSAGE)

    await user.tab()
    expect(screen.getByRole('link', { name: 'Skip to practice' })).toHaveFocus()
    // Fragment navigation and its target focus are checked in a real browser.
    expect(screen.getByRole('link', { name: 'Skip to practice' })).toHaveAttribute('href', '#main-content')
    await user.tab()
    expect(input).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Restart' })).toHaveFocus()
  })

  it('supports typing, Backspace, full-length correction, completion, and read-only protection', async () => {
    const user = userEvent.setup()
    const { container } = render(<PracticeSession passage="Go, go." />)
    const input = screen.getByRole('textbox', { name: 'Your typing' })
    const progress = screen.getByRole('progressbar', { name: 'Passage progress' })

    await user.type(input, 'Gx')
    expect(progress).toHaveAttribute('value', '2')
    expect(screen.getByText('1 current mistake')).toBeVisible()
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(container.querySelector('.passage-character--correct')).toHaveTextContent('G')
    expect(container.querySelector('.passage-character--incorrect')).toHaveTextContent('o')
    expect(container.querySelector('.passage-character--next')).toHaveTextContent(',')

    await user.keyboard('{Backspace}')
    expect(screen.getByText('0 current mistakes')).toBeVisible()
    expect(progress).toHaveAttribute('value', '1')

    await user.type(input, 'o, xo.')
    expect(input).toHaveValue('Go, xo.')
    expect(input).not.toHaveAttribute('readonly')
    expect(progress).toHaveAttribute('value', '7')
    expect(screen.getByRole('status')).toHaveTextContent('Correct the marked characters to finish.')

    input.setSelectionRange(4, 5)
    await user.keyboard('g')
    expect(input).toHaveValue('Go, go.')
    expect(input).toHaveAttribute('readonly')
    expect(input).toHaveAttribute('aria-invalid', 'false')
    expect(screen.getByRole('status')).toHaveTextContent('Passage complete.')
    expect(screen.getByText('0 current mistakes')).toBeVisible()
    expect(container.querySelector('.passage-character--next')).toBeNull()

    await user.keyboard('{Backspace}')
    await user.paste('extra')
    expect(input).toHaveValue('Go, go.')
  })

  it('marks an incorrect space and clears its marker when the space is corrected', async () => {
    const user = userEvent.setup()
    const { container } = render(<PracticeSession passage="a b" />)
    const input = screen.getByRole('textbox', { name: 'Your typing' })

    await user.type(input, 'axb')
    expect(screen.getByText('1 current mistake')).toBeVisible()
    expect(container.querySelector('.passage-character--space').textContent).toBe(' ')
    expect(input).not.toHaveAttribute('readonly')

    input.setSelectionRange(1, 2)
    await user.keyboard(' ')
    expect(input).toHaveValue('a b')
    expect(container.querySelector('.passage-character--space')).toBeNull()
    expect(screen.getByRole('status')).toHaveTextContent('Passage complete.')
  })

  it('preserves a newline as an editable mismatch instead of trimming or replacing it', async () => {
    const user = userEvent.setup()
    render(<PracticeSession passage="a b" />)
    const input = screen.getByRole('textbox', { name: 'Your typing' })

    await user.type(input, 'a{Enter}b')
    expect(input).toHaveValue('a\nb')
    expect(input).not.toHaveAttribute('readonly')
    expect(screen.getByText('1 current mistake')).toBeVisible()
    expect(screen.getByRole('progressbar')).toHaveAttribute('value', '3')

    input.setSelectionRange(1, 2)
    await user.keyboard(' ')
    expect(input).toHaveValue('a b')
    expect(input).toHaveAttribute('readonly')
  })

  it('clears current feedback and focuses the textarea on repeated restarts, including after completion', async () => {
    const user = userEvent.setup()
    const { container } = render(<PracticeSession passage="Hi." />)
    const input = screen.getByRole('textbox', { name: 'Your typing' })
    const restart = screen.getByRole('button', { name: 'Restart' })

    await user.type(input, 'Hx')
    await user.click(restart)
    expect(input).toHaveValue('')
    expect(input).toHaveFocus()
    expect(screen.getByText('0 current mistakes')).toBeVisible()
    expect(screen.getByRole('progressbar')).toHaveAttribute('value', '0')
    expect(container.querySelector('.passage-character--incorrect')).toBeNull()
    expect(container.querySelector('.passage-character--next')).toHaveTextContent('H')

    await user.type(input, 'Hi.')
    expect(input).toHaveAttribute('readonly')
    await user.tab()
    expect(restart).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(input).toHaveValue('')
    expect(input).not.toHaveAttribute('readonly')
    expect(input).toHaveFocus()
    expect(screen.getByRole('status')).toHaveTextContent(READY_MESSAGE)

    await user.click(restart)
    expect(input).toHaveValue('')
    expect(input).toHaveFocus()
    await user.type(input, 'Hi.')
    expect(screen.getByRole('status')).toHaveTextContent('Passage complete.')
  })

  it('accepts paste while enforcing the native length limit', async () => {
    const user = userEvent.setup()
    render(<App />)
    const input = screen.getByRole('textbox', { name: 'Your typing' })

    await user.click(input)
    await user.paste(PASSAGE + ' extra text')
    expect(input).toHaveValue(PASSAGE)
    expect(screen.getByRole('progressbar')).toHaveAttribute('value', '130')
    expect(screen.getByRole('status')).toHaveTextContent('Passage complete.')
  })

  it('limits pasted replacement text to the space available in the selected range', async () => {
    const user = userEvent.setup()
    render(<PracticeSession passage="abcde" />)
    const input = screen.getByRole('textbox', { name: 'Your typing' })

    await user.click(input)
    await user.paste('abXde')
    input.setSelectionRange(2, 3)
    await user.paste('cZZZ')
    expect(input).toHaveValue('abcde')
    expect(input).toHaveAttribute('readonly')
  })

  it('updates progress and current mistakes without changing the routine live message on every edit', async () => {
    const user = userEvent.setup()
    render(<PracticeSession passage="Go, go." />)
    const input = screen.getByRole('textbox', { name: 'Your typing' })
    const status = screen.getByRole('status')

    await user.type(input, 'G')
    const typingMessage = status.textContent
    await user.type(input, 'x')
    expect(status.textContent).toBe(typingMessage)
    expect(screen.getByText('1 current mistake')).toBeVisible()
    await user.clear(input)
    expect(screen.getByText('0 current mistakes')).toBeVisible()
    expect(screen.getByRole('progressbar')).toHaveAttribute('value', '0')
    expect(status).toHaveTextContent(READY_MESSAGE)
  })
})
