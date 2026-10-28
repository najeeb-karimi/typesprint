import PassageDisplay from './PassageDisplay.jsx'

export default function PracticeSession({ passage }) {
  return (
    <section className="practice-panel" aria-labelledby="practice-title">
      <div className="passage-area">
        <div className="panel-heading">
          <h2 id="practice-title">Your passage</h2>
          <p className="passage-length">{passage.length} characters</p>
        </div>
        <PassageDisplay passage={passage} />
      </div>

      <div className="typing-area">
        <div className="field-heading">
          <label htmlFor="typing-input">Your typing</label>
          <span className="preview-label">Preview</span>
        </div>
        <textarea
          id="typing-input"
          className="typing-input"
          name="typing"
          rows={3}
          value=""
          readOnly
          maxLength={passage.length}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder="Your next word will start here."
          aria-describedby="practice-passage practice-status"
        />
        <p id="practice-status" className="practice-status" role="status" aria-atomic="true">
          <svg className="status-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 11v6M12 7h.01" />
          </svg>
          <span>This is a preview. Typing and feedback are coming soon.</span>
        </p>
      </div>

      <div className="session-footer">
        <div className="progress-group">
          <div className="progress-heading">
            <label htmlFor="passage-progress">Passage progress</label>
            <span id="progress-detail">0 of {passage.length} characters</span>
          </div>
          <progress
            id="passage-progress"
            className="passage-progress"
            value={0}
            max={passage.length}
            aria-describedby="progress-detail"
          >
            0 of {passage.length} characters
          </progress>
        </div>
        <button
          className="restart-button"
          type="button"
          disabled
          aria-describedby="practice-status"
        >
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M3 10a9 9 0 1 1 2.6 8.4M3 4v6h6" />
          </svg>
          Restart
        </button>
      </div>
    </section>
  )
}
