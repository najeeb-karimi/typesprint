export default function AttemptResults({ results }) {
  return (
    <section className="attempt-results" aria-labelledby="results-title">
      <h2 id="results-title">Your results</h2>
      <dl className="result-metrics">
        <div className="result-metric">
          <dt>Elapsed time</dt>
          <dd>{results.time}</dd>
        </div>
        <div className="result-metric">
          <dt>Speed</dt>
          <dd>{results.speed} <span className="result-unit">WPM</span></dd>
        </div>
        <div className="result-metric">
          <dt>Accuracy</dt>
          <dd>{results.accuracy}</dd>
        </div>
      </dl>
      {results.explanation && <p className="result-explanation">{results.explanation}</p>}
      <p className="result-definition">
        WPM is words per minute, using five characters per word. Accuracy includes corrected mistakes.
      </p>
    </section>
  )
}
