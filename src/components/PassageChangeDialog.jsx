import ConfirmationDialog from './ConfirmationDialog.jsx'

export default function PassageChangeDialog({ onCancel, onConfirm }) {
  return (
    <ConfirmationDialog
      id="change-passage"
      title="Change passage?"
      description="Changing passages discards your current attempt. Elapsed time continues while you decide."
      cancelLabel="Keep current attempt"
      confirmLabel="Discard and change"
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  )
}
