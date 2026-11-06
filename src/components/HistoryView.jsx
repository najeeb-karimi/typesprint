import { useEffect, useRef, useState } from 'react'
import { formatAttemptResults } from '../lib/formatAttemptMetrics.js'
import { HISTORY_CATEGORIES } from '../lib/resultHistory.js'
import ConfirmationDialog from './ConfirmationDialog.jsx'

const PAGE_SIZE = 10
const CATEGORY_LABELS = { short: 'Short', medium: 'Medium', long: 'Long' }
const dateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })
const UNREADABLE_CODES = new Set(['read-failed', 'invalid-data', 'unsupported-version'])

function CompletionDate({ timestamp }) {
  return <time dateTime={new Date(timestamp).toISOString()}>{dateFormatter.format(timestamp)}</time>
}

function ResultMeasurements({ result }) {
  const formatted = formatAttemptResults(result, result.scoringUnavailableReason)
  return (
    <>
      <dl className="history-metrics">
        <div><dt>Elapsed time</dt><dd>{formatted.time}</dd></div>
        <div><dt>Speed</dt><dd>{formatted.speed} <span className="result-unit">WPM</span></dd></div>
        <div><dt>Accuracy</dt><dd>{formatted.accuracy}</dd></div>
      </dl>
      {formatted.explanation && <p className="history-explanation">{formatted.explanation}</p>}
    </>
  )
}

function errorHelp(error) {
  if (error.code === 'invalid-data' || error.code === 'unsupported-version') {
    return 'Your saved data has been left untouched. Clear saved results to start a new history.'
  }
  if (error.code === 'read-failed') {
    return 'You can keep practicing. Check storage permissions for this site before reloading to try again.'
  }
  if (error.code === 'locking-unavailable') {
    return 'Use a current browser over HTTPS or localhost to save or clear results safely.'
  }
  return 'You can keep practicing. Check browser storage permissions and available space before trying a new operation.'
}

export default function HistoryView({ history, error, headingRef, onClear, clearStatus }) {
  const [page, setPage] = useState(1)
  const [confirmingClear, setConfirmingClear] = useState(false)
  const clearButtonRef = useRef(null)
  const recentHeadingRef = useRef(null)
  const pageFocusRequestedRef = useRef(false)
  const pageCount = Math.max(1, Math.ceil(history.recent.length / PAGE_SIZE))
  // Clamp remembered state too, so a later addition cannot revive an obsolete page.
  if (page > pageCount) setPage(pageCount)
  const currentPage = Math.min(page, pageCount)
  const firstIndex = (currentPage - 1) * PAGE_SIZE
  const visibleResults = history.recent.slice(firstIndex, firstIndex + PAGE_SIZE)
  const hasResults = history.recent.length > 0 || HISTORY_CATEGORIES.some(category => history.bests[category])
  const clearing = clearStatus?.state === 'clearing'
  const displayedError = error ?? (clearStatus?.state === 'failed'
    ? { code: 'unexpected-clear-failure', message: clearStatus.message } : null)
  const unreadable = displayedError && UNREADABLE_CODES.has(displayedError.code)
  const feedback = clearing ? 'Clearing saved results…'
    : displayedError?.message ?? (clearStatus?.state === 'cleared' ? 'Saved results cleared.' : '')

  useEffect(() => {
    if (!pageFocusRequestedRef.current) return
    pageFocusRequestedRef.current = false
    recentHeadingRef.current?.focus()
  }, [page])

  function changePage(nextPage) {
    pageFocusRequestedRef.current = true
    setPage(nextPage)
  }

  function cancelClear() {
    setConfirmingClear(false)
    const button = clearButtonRef.current
    if (button && !button.disabled) button.focus()
    else recentHeadingRef.current.focus()
  }

  function confirmClear() {
    setConfirmingClear(false)
    // This heading stays available when clearing disables the initiating button.
    recentHeadingRef.current.focus()
    onClear()
  }

  return (
    <div className="history-view">
      <div className="introduction">
        <p className="eyebrow">Your progress</p>
        <h1 ref={headingRef} tabIndex={-1}>Practice <span>history.</span></h1>
        <p className="introduction-copy">
          Recent results and personal bests, saved in this browser for this site.
          Visiting History does not pause your current attempt.
        </p>
      </div>

      <div className="history-toolbar">
        <p>Only completed attempts are saved.</p>
        <button
          ref={clearButtonRef}
          className="action-button action-button--danger"
          type="button"
          disabled={clearing || (!hasResults && !displayedError)}
          onClick={() => setConfirmingClear(true)}
        >
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5m4-5v5" />
          </svg>
          Clear saved results
        </button>
      </div>

      <p className={feedback ? 'history-notice' + (displayedError && !clearing ? ' history-notice--error' : '') : 'sr-only'} role="status" aria-atomic="true">
        {feedback}
      </p>
      {displayedError && (
        <p className="history-help">
          {errorHelp(displayedError)}
          {unreadable && hasResults && ' Showing the last successfully read results below.'}
        </p>
      )}

      <section className="history-section" aria-labelledby="bests-title">
        <div className="history-section-heading">
          <h2 id="bests-title">Personal bests</h2>
          <span className="history-section-detail">By passage length</span>
        </div>
        <p className="history-description">
          One all-time best per length group, kept independently of your latest 50 completions.
          Length describes the passage, not its difficulty. Comparisons use unrounded speed,
          then accuracy for exact speed ties.
        </p>
        <div className="best-cards">
          {HISTORY_CATEGORIES.map(category => {
            const best = history.bests[category]
            return (
              <section className={'best-card' + (best ? ' best-card--measured' : '')} key={category} aria-labelledby={'best-' + category}>
                <h3 id={'best-' + category}>{CATEGORY_LABELS[category]}</h3>
                {best ? (
                  <>
                    <p className="history-meta">
                      {best.characterCount} characters · <CompletionDate timestamp={best.completedAt} />
                    </p>
                    <ResultMeasurements result={best} />
                  </>
                ) : <p className="history-description">{unreadable ? 'Saved best could not be read.' : 'No measured result to show.'}</p>}
              </section>
            )
          })}
        </div>
      </section>

      <section className="history-section" aria-labelledby="recent-title">
        <div className="history-section-heading">
          <h2 id="recent-title" ref={recentHeadingRef} tabIndex={-1} aria-describedby={history.recent.length ? 'history-range' : undefined}>Recent results</h2>
          <span className="history-section-detail">{history.recent.length} {displayedError ? 'shown' : 'saved'}</span>
        </div>
        <p className="history-description">
          Your latest 50 completions, newest additions first. WPM means words per minute.
          Accuracy includes corrected mistakes.
        </p>
        {history.recent.length > 0 ? (
          <>
            <p id="history-range" className="history-range">
              Showing {firstIndex + 1}–{firstIndex + visibleResults.length} of {history.recent.length} results
            </p>
            <ol className="history-list" role="list" start={firstIndex + 1} aria-label="Recent completed attempts">
              {visibleResults.map((result, index) => (
                <li className="history-entry" key={result.id}>
                  <div className="history-entry-heading">
                    <span className="history-entry-number" aria-hidden="true">#{String(firstIndex + index + 1).padStart(2, '0')}</span>
                    <p className="history-meta">{CATEGORY_LABELS[result.category]} · {result.characterCount} characters</p>
                    {history.bests[result.category]?.id === result.id && <span className="best-label">Personal best</span>}
                    <CompletionDate timestamp={result.completedAt} />
                  </div>
                  <ResultMeasurements result={result} />
                </li>
              ))}
            </ol>
            <nav className="history-pagination" aria-label="Result pages">
              <button className="action-button" type="button" aria-label="Previous page" disabled={currentPage === 1} onClick={() => changePage(currentPage - 1)}>
                <span aria-hidden="true">←</span> Previous
              </button>
              <p>Page {currentPage} of {pageCount}</p>
              <button className="action-button" type="button" aria-label="Next page" disabled={currentPage === pageCount} onClick={() => changePage(currentPage + 1)}>
                Next <span aria-hidden="true">→</span>
              </button>
            </nav>
          </>
        ) : (
          <div className="history-empty">
            <h3>{displayedError ? 'Saved results unavailable' : 'A fresh start'}</h3>
            <p>{displayedError
              ? unreadable
                ? 'Saved results could not be loaded. You can keep using Practice or clear saved results to start again.'
                : 'There are no saved results to display. You can keep practicing, or try clearing again.'
              : 'Complete a passage to see your first result here.'}</p>
            {!displayedError && <p>Every finished attempt counts. Your best measured result for each length gets its own place above.</p>}
          </div>
        )}
      </section>

      {confirmingClear && (
        <ConfirmationDialog
          id="clear-results"
          title="Clear saved results?"
          description="This permanently removes recent results and all personal bests for this site in this browser, including changes from other open TypeSprint tabs before clearing. Your current attempt and its displayed result stay available. This cannot be undone."
          cancelLabel="Cancel"
          confirmLabel="Clear saved results"
          onCancel={cancelClear}
          onConfirm={confirmClear}
        />
      )}
    </div>
  )
}
