import { formatAttemptResults } from '../lib/formatAttemptMetrics.js'
import { HISTORY_CATEGORIES } from '../lib/resultHistory.js'

const CATEGORY_LABELS = { short: 'Short', medium: 'Medium', long: 'Long' }
const dateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

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

export default function HistoryView({ history, error, headingRef }) {
  return (
    <div>
      <div className="introduction">
        <p className="eyebrow">Your progress</p>
        <h1 ref={headingRef} tabIndex={-1}>Practice <span>history.</span></h1>
        <p className="introduction-copy">
          Recent results and personal bests, saved in this browser for this site.
          Visiting History does not pause your current attempt.
        </p>
      </div>

      <p className="history-notice" aria-live="polite" aria-atomic="true">{error?.message ?? ''}</p>

      <section className="history-section" aria-labelledby="bests-title">
        <h2 id="bests-title">Personal bests</h2>
        <p className="history-description">
          One all-time best per length group, kept independently of your latest 50 completions.
          Length describes the passage, not its difficulty. Comparisons use unrounded speed,
          then accuracy for exact speed ties.
        </p>
        <div className="best-cards">
          {HISTORY_CATEGORIES.map(category => {
            const best = history.bests[category]
            return (
              <section className="best-card" key={category} aria-labelledby={'best-' + category}>
                <h3 id={'best-' + category}>{CATEGORY_LABELS[category]}</h3>
                {best ? (
                  <>
                    <p className="history-meta">
                      {best.characterCount} characters · <CompletionDate timestamp={best.completedAt} />
                    </p>
                    <ResultMeasurements result={best} />
                  </>
                ) : <p className="history-description">No measured result to show.</p>}
              </section>
            )
          })}
        </div>
      </section>

      <section className="history-section" aria-labelledby="recent-title">
        <h2 id="recent-title">Recent results</h2>
        <p className="history-description">
          Your latest 50 completions, newest additions first. WPM means words per minute.
          Accuracy includes corrected mistakes.
        </p>
        {history.recent.length > 0 ? (
          <ol className="history-list" aria-label="Recent completed attempts">
            {history.recent.map(result => (
              <li className="history-entry" key={result.id}>
                <div className="history-entry-heading">
                  <p className="history-meta">
                    {CATEGORY_LABELS[result.category]} · {result.characterCount} characters
                  </p>
                  {history.bests[result.category]?.id === result.id && <span className="best-label">Personal best</span>}
                  <CompletionDate timestamp={result.completedAt} />
                </div>
                <ResultMeasurements result={result} />
              </li>
            ))}
          </ol>
        ) : !error && <p className="history-description">Complete a passage to see your first result here.</p>}
      </section>
    </div>
  )
}
