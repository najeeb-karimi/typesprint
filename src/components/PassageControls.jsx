import { useRef, useState } from 'react'
import PassageChangeDialog from './PassageChangeDialog.jsx'

/** Only the decision controls leave the tree when the practice view is hidden. */
export default function PassageControls({
  attemptStatus, isComposing, nextCategory, onNextCategoryChange, onPassageChange,
}) {
  const [pendingCategory, setPendingCategory] = useState(null)
  const newPassageRef = useRef(null)

  function requestPassage() {
    if (isComposing || pendingCategory !== null) return
    if (attemptStatus === 'running') setPendingCategory(nextCategory)
    else onPassageChange(nextCategory)
  }

  function cancelPassageChange() {
    setPendingCategory(null)
    newPassageRef.current.focus()
  }

  function confirmPassageChange() {
    const requestedCategory = pendingCategory
    setPendingCategory(null)
    onPassageChange(requestedCategory)
  }

  return (
    <>
      <div className="passage-controls">
        <div className="passage-actions">
          <div className="passage-choice">
            <label htmlFor="next-passage-length">Next passage length</label>
            <select
              id="next-passage-length"
              className="passage-select"
              value={nextCategory}
              onChange={event => onNextCategoryChange(event.target.value)}
              aria-describedby="next-passage-hint"
            >
              <option value="short">Short</option>
              <option value="medium">Medium</option>
              <option value="long">Long</option>
            </select>
          </div>
          <button
            ref={newPassageRef}
            className="action-button action-button--primary new-passage-button"
            type="button"
            onClick={requestPassage}
            disabled={isComposing}
            aria-describedby={isComposing ? 'passage-change-hint' : undefined}
          >
            New passage
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 12h16m-6-6 6 6-6 6" />
            </svg>
          </button>
        </div>
        <p id="next-passage-hint" className="passage-choice-hint">
          Your length choice applies when you choose New passage.
        </p>
        {isComposing && (
          <p id="passage-change-hint" className="passage-change-hint">
            Finish composing the current text before changing passages.
          </p>
        )}
      </div>
      {pendingCategory !== null && (
        <PassageChangeDialog onCancel={cancelPassageChange} onConfirm={confirmPassageChange} />
      )}
    </>
  )
}
