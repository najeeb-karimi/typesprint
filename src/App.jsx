import PracticeSession from './components/PracticeSession.jsx'

const PRACTICE_PASSAGE =
  'Small steps build steady progress. Take a breath, find your rhythm, and let each careful keystroke bring the next word into focus.'

export default function App() {
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

        <PracticeSession passage={PRACTICE_PASSAGE} />
      </main>

      <footer className="page-footer">
        <span className="footer-line" aria-hidden="true" />
        <p>Small steps. Steady progress.</p>
      </footer>
    </div>
  )
}
