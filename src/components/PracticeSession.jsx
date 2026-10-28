import { useRef, useState } from 'react'
import { comparePassage } from '../lib/comparePassage.js'
import PassageDisplay from './PassageDisplay.jsx'

export default function PracticeSession({ passage }) {
  const [input, setInput] = useState('')
  const inputRef = useRef(null)
  const { characters, enteredCount, mistakeCount, isComplete } = comparePassage(passage, input)

  let status = 'Type the passage above. Match every character, including spaces and punctuation.'

  if (isComplete) {
    status = 'Passage complete. Every character matches. Restart when you’re ready.'
  } else if (enteredCount === passage.length) {
    status = 'You’ve reached the end. Correct the marked characters to finish.'
  } else if (enteredCount > 0) {
    status = 'Keep your pace. You can go back and correct any character.'
  }

  function handleRestart() {
    setInput('')
    inputRef.current.focus()
  }

  return (
    <section className="practice-panel" aria-labelledby="practice-title">
      <div className="passage-area">
        <div className="panel-heading">
          <h2 id="practice-title">Your passage</h2>
          <p className="passage-length">{passage.length} characters</p>
        </div>
        <PassageDisplay passage={passage} characters={characters} />
      </div>

      <div className="typing-area">
        <div className="field-heading">
          <label htmlFor="typing-input">Your typing</label>
          <span
            id="mistake-count"
            className={`mistake-count${mistakeCount > 0 ? ' mistake-count--active' : ''}`}
          >
            {mistakeCount} current {mistakeCount === 1 ? 'mistake' : 'mistakes'}
          </span>
        </div>
        <textarea
          ref={inputRef}
          id="typing-input"
          className="typing-input"
          name="typing"
          rows={3}
          value={input}
          onChange={event => setInput(event.target.value)}
          readOnly={isComplete}
          maxLength={passage.length}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder="Start typing the passage here."
          aria-invalid={mistakeCount > 0}
          aria-describedby="practice-passage practice-status"
        />
        <p
          id="practice-status"
          className={`practice-status${isComplete ? ' practice-status--complete' : ''}`}
          role="status"
          aria-atomic="true"
        >
          <svg className="status-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            {isComplete ? <path d="m8 12 3 3 5-6" /> : <path d="M12 11v6M12 7h.01" />}
          </svg>
          <span>{status}</span>
        </p>
      </div>

      <div className="session-footer">
        <div className="progress-group">
          <div className="progress-heading">
            <label htmlFor="passage-progress">Passage progress</label>
            <span id="progress-detail">{enteredCount} of {passage.length} characters</span>
          </div>
          <progress
            id="passage-progress"
            className="passage-progress"
            value={enteredCount}
            max={passage.length}
            aria-describedby="progress-detail"
          >
            {enteredCount} of {passage.length} characters
          </progress>
        </div>
        <button className="restart-button" type="button" onClick={handleRestart}>
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M3 10a9 9 0 1 1 2.6 8.4M3 4v6h6" />
          </svg>
          Restart
        </button>
      </div>
    </section>
  )
}
