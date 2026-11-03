import { useState } from 'react'
import PracticeSession from './components/PracticeSession.jsx'
import { INITIAL_PASSAGE_ID, PASSAGES } from './data/passages.js'
import { selectNextPassage } from './lib/selectNextPassage.js'

export default function App() {
  const [activePassageId, setActivePassageId] = useState(INITIAL_PASSAGE_ID)
  const [nextCategory, setNextCategory] = useState('short')
  const [focusNewPassage, setFocusNewPassage] = useState(false)
  const activePassage = PASSAGES.find(passage => passage.id === activePassageId)

  function changePassage(category) {
    // Draw once for an accepted action, outside rendering and state updaters.
    const next = selectNextPassage(PASSAGES, category, activePassageId, Math.random())
    setActivePassageId(next.id)
    setFocusNewPassage(true)
  }

  return (
    <div className="site-shell">
      <a className="skip-link" href="#main-content">
        Skip to practice
      </a>

      <header className="site-header">
        <div className="brand">
          <img src="/favicon.svg" alt="" width="36" height="36" />
          <span>TypeSprint</span>
        </div>
        <p className="header-note">Practice at your own pace.</p>
      </header>

      <main id="main-content" tabIndex={-1}>
        <div className="introduction">
          <p className="eyebrow">Passage practice</p>
          <h1>
            Find your <span>typing rhythm.</span>
          </h1>
          <p className="introduction-copy">
            No countdown. Just you and the next word.
          </p>
        </div>

        <PracticeSession
          key={activePassage.id}
          passage={activePassage.text}
          category={activePassage.category}
          nextCategory={nextCategory}
          onNextCategoryChange={setNextCategory}
          onPassageChange={changePassage}
          focusOnMount={focusNewPassage}
        />
      </main>

      <footer className="page-footer">
        <span className="footer-line" aria-hidden="true" />
        <p>Small steps. Steady progress.</p>
      </footer>
    </div>
  )
}
