export default function AttemptResults({ results }) {
  return (
    <section className="attempt-results" aria-labelledby="results-title">
      <h2 id="results-title">Your results</h2>
      <dl className="result-metrics">
        <div className="result-metric">
          <dt>Elapsed time</dt>
          <dd><span className="result-value">{results.time}</span></dd>
        </div>
        <div className="result-metric">
          <dt>Speed</dt>
          <dd>
            <span className="result-value">{results.speed}</span>{' '}
            <span className="result-unit">WPM</span>
          </dd>
        </div>
        <div className="result-metric">
          <dt>Accuracy</dt>
          <dd><span className="result-value">{results.accuracy}</span></dd>
        </div>
      </dl>
      {results.explanation && <p className="result-explanation">{results.explanation}</p>}
      <p className="result-definition">
        Time is minutes:seconds. WPM means words per minute, using five characters per word.
        Accuracy includes corrected mistakes.
      </p>
    </section>
  )
}
