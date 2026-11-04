import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import PracticeSession from './components/PracticeSession.jsx'
import HistoryView from './components/HistoryView.jsx'
import { INITIAL_PASSAGE_ID, PASSAGES } from './data/passages.js'
import { useViewNavigation } from './hooks/useViewNavigation.js'
import { createHistoryController } from './lib/createHistoryController.js'
import { createResultRecord } from './lib/resultHistory.js'
import { selectNextPassage } from './lib/selectNextPassage.js'

const SAVE_FAILURE = 'This result could not be saved. Your practice result is still available.'

export default function App({ historyController } = {}) {
  const [controller] = useState(() => historyController ?? createHistoryController())
  const saved = useSyncExternalStore(controller.subscribe, controller.getSnapshot)
  const { view, visit, hrefFor, navigate } = useViewNavigation()
  const practiceHeadingRef = useRef(null)
  const historyHeadingRef = useRef(null)
  const [activePassageId, setActivePassageId] = useState(INITIAL_PASSAGE_ID)
  const [nextCategory, setNextCategory] = useState('short')
  const [focusNewPassage, setFocusNewPassage] = useState(false)
  const [completionStatus, setCompletionStatus] = useState(null)
  const activePassage = PASSAGES.find(passage => passage.id === activePassageId)

  useEffect(() => {
    document.title = view === 'history' ? 'TypeSprint — History' : 'TypeSprint — Find your typing rhythm'
  }, [view])

  useEffect(() => {
    if (visit === 0) return
    const heading = view === 'history' ? historyHeadingRef.current : practiceHeadingRef.current
    heading?.focus()
  }, [view, visit])

  const recordCompletion = useCallback(({ passageId, category, attempt }) => {
    setCompletionStatus({ attempt, state: 'saving' })
    function finish(response) {
      setCompletionStatus(current => current?.attempt !== attempt ? current : {
        attempt,
        state: response.ok ? 'saved' : 'failed',
        message: response.error?.message ?? SAVE_FAILURE,
      })
    }
    try {
      // These changing external inputs belong to this completed edit only.
      const record = createResultRecord({
        id: crypto.randomUUID(), completedAt: Date.now(), passageId, category, attempt,
      })
      Promise.resolve(controller.record(record)).then(finish, () => finish({ ok: false }))
    } catch {
      finish({ ok: false })
    }
  }, [controller])

  function changePassage(category) {
    // Draw once for an accepted action, outside rendering and state updaters.
    const next = selectNextPassage(PASSAGES, category, activePassageId, Math.random())
    setActivePassageId(next.id)
    setFocusNewPassage(true)
  }

  return (
    <div className="site-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>

      <header className="site-header">
        <div className="brand">
          <img src="/favicon.svg" alt="" width="36" height="36" />
          <span>TypeSprint</span>
        </div>
        <p className="header-note">Practice at your own pace.</p>
      </header>

      <nav className="site-nav" aria-label="Main navigation">
        <a href={hrefFor('practice')} onClick={navigate} aria-current={view === 'practice' ? 'page' : undefined}>
          Practice
        </a>
        <a href={hrefFor('history')} onClick={navigate} aria-current={view === 'history' ? 'page' : undefined}>
          History
        </a>
      </nav>

      <main id="main-content" tabIndex={-1}>
        {/* Keep its rendering frame: display:none discards native Undo in Firefox. */}
        <div
          className={'practice-view' + (view !== 'practice' ? ' practice-view--inactive' : '')}
          inert={view !== 'practice'}
          aria-hidden={view !== 'practice' ? true : undefined}
        >
          <div className="introduction">
            <p className="eyebrow">Passage practice</p>
            <h1 ref={practiceHeadingRef} tabIndex={-1}>
              Find your <span>typing rhythm.</span>
            </h1>
            <p className="introduction-copy">
              No countdown. Just you and the next word.
            </p>
          </div>

          <PracticeSession
            key={activePassage.id}
            passage={activePassage.text}
            passageId={activePassage.id}
            category={activePassage.category}
            nextCategory={nextCategory}
            onNextCategoryChange={setNextCategory}
            onPassageChange={changePassage}
            focusOnMount={focusNewPassage}
            isActive={view === 'practice'}
            onComplete={recordCompletion}
            completionStatus={completionStatus}
          />
        </div>

        {view === 'history' && <HistoryView history={saved.history} error={saved.error} headingRef={historyHeadingRef} />}
      </main>

      <footer className="page-footer">
        <span className="footer-line" aria-hidden="true" />
        <p>Small steps. Steady progress.</p>
      </footer>
    </div>
  )
}
