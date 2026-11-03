import { useEffect, useRef } from 'react'

export default function PassageChangeDialog({ onCancel, onConfirm }) {
  const dialogRef = useRef(null)
  const cancelRef = useRef(null)
  const settledRef = useRef(false)

  useEffect(() => {
    const dialog = dialogRef.current
    dialog.showModal()
    cancelRef.current.focus()

    return () => {
      if (dialog.open) dialog.close()
    }
  }, [])

  function decide(callback) {
    if (settledRef.current) return
    settledRef.current = true
    // Close native modality before a replacement session focuses its field.
    dialogRef.current.close()
    callback()
  }

  return (
    <dialog
      ref={dialogRef}
      className="passage-dialog"
      aria-labelledby="change-passage-title"
      aria-describedby="change-passage-description"
      onCancel={event => {
        event.preventDefault()
        decide(onCancel)
      }}
    >
      <h2 id="change-passage-title">Change passage?</h2>
      <p id="change-passage-description">
        Changing passages discards your current attempt. Elapsed time continues while you decide.
      </p>
      <div className="dialog-actions">
        <button ref={cancelRef} className="action-button action-button--primary" type="button" onClick={() => decide(onCancel)}>
          Keep current attempt
        </button>
        <button className="action-button action-button--danger" type="button" onClick={() => decide(onConfirm)}>
          Discard and change
        </button>
      </div>
    </dialog>
  )
}
