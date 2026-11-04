import { StrictMode } from 'react'
import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useViewNavigation } from './useViewNavigation.js'

afterEach(() => {
  window.history.replaceState(null, '', '/')
  vi.restoreAllMocks()
})

function click(href, changes = {}, attributes = {}) {
  const link = document.createElement('a')
  link.href = href
  for (const [name, value] of Object.entries(attributes)) link.setAttribute(name, value)
  return {
    currentTarget: link, button: 0, defaultPrevented: false,
    metaKey: false, ctrlKey: false, shiftKey: false, altKey: false,
    preventDefault: vi.fn(), ...changes,
  }
}

describe('link navigation boundaries', () => {
  it('handles an ordinary same-site link once and does not push duplicate active-view entries', () => {
    window.history.replaceState(null, '', '/?sample=one#main-content')
    const push = vi.spyOn(window.history, 'pushState')
    const { result } = renderHook(useViewNavigation, { wrapper: StrictMode })
    expect(result.current.hrefFor('history')).toBe('/?sample=one&view=history')
    const event = click(result.current.hrefFor('history'))
    act(() => result.current.navigate(event))
    expect(event.preventDefault).toHaveBeenCalledTimes(1)
    expect(push).toHaveBeenCalledTimes(1)
    expect(result.current.view).toBe('history')
    expect(result.current.visit).toBe(1)
    act(() => result.current.navigate(event))
    expect(push).toHaveBeenCalledTimes(1)
    expect(result.current.visit).toBe(1)
  })

  it.each([
    ['already handled', { defaultPrevented: true }],
    ['middle button', { button: 1 }],
    ['Control', { ctrlKey: true }],
    ['Command', { metaKey: true }],
    ['Shift', { shiftKey: true }],
    ['Alt', { altKey: true }],
    ['download', {}, { download: '' }],
    ['new tab', {}, { target: '_blank' }],
  ])('leaves %s navigation to the browser', (name, changes, attributes) => {
    const push = vi.spyOn(window.history, 'pushState')
    const { result } = renderHook(useViewNavigation)
    const event = click('/?view=history', changes, attributes)
    act(() => result.current.navigate(event))
    expect(event.preventDefault).not.toHaveBeenCalled()
    expect(push).not.toHaveBeenCalled()
    expect(result.current.view).toBe('practice')
  })

  it.each(['https://example.com/?view=history', '/another-page?view=history'])(
    'does not intercept other destinations: %s', href => {
      const { result } = renderHook(useViewNavigation)
      const event = click(href)
      act(() => result.current.navigate(event))
      expect(event.preventDefault).not.toHaveBeenCalled()
      expect(result.current.view).toBe('practice')
    },
  )

  it('removes its traversal subscription on unmount under Strict Mode', () => {
    const add = vi.spyOn(window, 'addEventListener')
    const remove = vi.spyOn(window, 'removeEventListener')
    const { unmount } = renderHook(useViewNavigation, { wrapper: StrictMode })
    unmount()
    const subscribed = add.mock.calls.filter(([type]) => type === 'popstate')
    const removed = remove.mock.calls.filter(([type]) => type === 'popstate')
    expect(subscribed).toHaveLength(2)
    expect(removed).toEqual(subscribed)
  })
})
