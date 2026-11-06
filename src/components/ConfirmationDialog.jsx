import { useEffect, useRef } from 'react'

/** Each mount owns one native confirmation and settles at most one decision. */
export default function ConfirmationDialog({
  id, title, description, cancelLabel, confirmLabel, onCancel, onConfirm,
}) {
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
    // Release native modality before the owner chooses the next focus target.
    dialogRef.current.close()
    callback()
  }

  return (
    <dialog
      ref={dialogRef}
      className="confirmation-dialog"
      aria-labelledby={id + '-title'}
      aria-describedby={id + '-description'}
      onCancel={event => {
        event.preventDefault()
        decide(onCancel)
      }}
    >
      <h2 id={id + '-title'}>{title}</h2>
      <p id={id + '-description'}>{description}</p>
      <div className="dialog-actions">
        <button ref={cancelRef} className="action-button action-button--primary" type="button" onClick={() => decide(onCancel)}>
          {cancelLabel}
        </button>
        <button className="action-button action-button--danger" type="button" onClick={() => decide(onConfirm)}>
          {confirmLabel}
        </button>
      </div>
    </dialog>
  )
}
