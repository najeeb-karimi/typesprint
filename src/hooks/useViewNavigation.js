import { useCallback, useEffect, useState } from 'react'

function viewFrom(href) {
  return new URL(href).searchParams.get('view') === 'history' ? 'history' : 'practice'
}

/** Browser navigation state is separate from the mounted practice session. */
export function useViewNavigation() {
  const [location, setLocation] = useState(() => ({ href: window.location.href, visit: 0 }))
  const view = viewFrom(location.href)

  const readLocation = useCallback(() => {
    const href = window.location.href
    setLocation(previous => previous.href === href ? previous : {
      href,
      visit: previous.visit + (viewFrom(previous.href) !== viewFrom(href) ? 1 : 0),
    })
  }, [])

  useEffect(() => {
    window.addEventListener('popstate', readLocation)
    return () => window.removeEventListener('popstate', readLocation)
  }, [readLocation])

  function hrefFor(nextView) {
    const url = new URL(location.href)
    url.searchParams.set('view', nextView)
    url.hash = ''
    return url.pathname + url.search
  }

  function navigate(event) {
    const link = event.currentTarget
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey
      || event.shiftKey || event.altKey || link.hasAttribute('download')
      || (link.target && link.target !== '_self')) return

    const target = new URL(link.href)
    if (target.origin !== window.location.origin || target.pathname !== window.location.pathname) return
    event.preventDefault()
    if (viewFrom(target.href) === viewFrom(window.location.href)) return

    window.history.pushState(null, '', target)
    // pushState changes the URL but does not emit popstate.
    readLocation()
  }

  return { view, visit: location.visit, hrefFor, navigate }
}
