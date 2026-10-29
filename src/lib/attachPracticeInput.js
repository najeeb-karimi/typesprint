import { applyAttemptEdit, createAttempt } from './practiceAttempt.js'

const BLOCKED_INPUT_TYPES = new Set([
  'insertFromPaste', 'insertFromPasteAsQuotation', 'insertFromDrop', 'insertFromYank',
])
const INSERT_INPUT_TYPES = new Set([
  'insertText', 'insertLineBreak', 'insertParagraph', 'insertReplacementText',
])

function snapshot(input) {
  return {
    value: input.value,
    start: input.selectionStart,
    end: input.selectionEnd,
  }
}

// Use the actual selection, not a longest-prefix diff: identical characters can
// make a diff assign an insertion to the wrong target position.
function insertionAtSelection(before, value) {
  if (!before) return null

  const prefix = before.value.slice(0, before.start)
  const suffix = before.value.slice(before.end)

  if (value.length < prefix.length + suffix.length
    || !value.startsWith(prefix)
    || !value.endsWith(suffix)) {
    return null
  }

  return {
    insertionStart: before.start,
    insertedText: value.slice(prefix.length, value.length - suffix.length),
  }
}

function acceptedPartOf(data, insertedText) {
  return typeof data === 'string'
    && data.replace(/\r\n?/g, '\n').startsWith(insertedText)
}

/**
 * Connect one textarea's native editing events to an attempt. The caller receives
 * immutable model snapshots for rendering. Dispose before replacing the field;
 * a fresh field also gives Restart a fresh native Undo/composition history.
 */
export function attachPracticeInput(input, {
  passage,
  onAttempt,
  onRestricted,
  now = () => performance.now(),
}) {
  let attempt = createAttempt(passage)
  let pending = null
  let composition = null
  let compositionTail = null
  let disposed = false

  function publish(edit) {
    if (disposed || attempt.status === 'completed') return

    attempt = applyAttemptEdit(attempt, {
      input: input.value,
      insertionStart: null,
      insertedText: '',
      category: 'unknown',
      isComposing: false,
      timestamp: now(),
      ...edit,
    })
    onAttempt(attempt)
  }

  function restrict(event) {
    event.preventDefault()
    pending = { ...snapshot(input), blocked: true }
    if (attempt.status !== 'completed') {
      onRestricted(event.type === 'drop' || event.inputType === 'insertFromDrop' ? 'drop' : 'paste')
    }
  }

  function beforeInput(event) {
    if (BLOCKED_INPUT_TYPES.has(event.inputType)) {
      restrict(event)
      return
    }

    if (attempt.status === 'completed') {
      event.preventDefault()
      return
    }

    pending = {
      ...snapshot(input),
      inputType: event.inputType,
      data: event.data,
    }
    // A new ordinary edit is not a trailing composition notification.
    if (!event.isComposing && event.inputType !== 'insertFromComposition'
      && event.inputType !== 'insertCompositionText') {
      compositionTail = null
    }
  }

  function finishComposition(session) {
    if (disposed || composition !== session) return

    composition = null
    pending = null
    const value = input.value
    const insertion = insertionAtSelection(session.before, value)
    let edit = { category: 'unknown' }

    if (session.data === '' && session.before?.value === value) {
      edit = { category: 'delete' }
    } else if (insertion && acceptedPartOf(session.data, insertion.insertedText)) {
      edit = insertion.insertedText.length > 0
        ? { ...insertion, category: 'insert' }
        : { category: 'delete' }
    }

    compositionTail = { value, data: session.data }
    publish({ ...edit, timestamp: session.timestamp })
  }

  function compositionStart() {
    pending = null
    compositionTail = null
    composition = { before: snapshot(input), ended: false }
  }

  function compositionEnd(event) {
    if (!composition) return

    const session = composition
    session.ended = true
    session.data = event.data
    session.timestamp = now()

    // Some engines send the last input before compositionend, others after it.
    // Let that final input settle; dispose/session identity invalidate old work.
    queueMicrotask(() => finishComposition(session))
  }

  function handleInput(event) {
    const before = pending
    pending = null

    if (attempt.status === 'completed' || BLOCKED_INPUT_TYPES.has(event.inputType)) {
      input.value = attempt.input
      if (before) input.setSelectionRange(before.start, before.end)
      return
    }

    if (composition?.ended) {
      finishComposition(composition)
      return
    }

    if (composition || event.isComposing || event.inputType === 'insertCompositionText') {
      if (!composition) {
        composition = { before: before?.value === attempt.input ? before : null, ended: false }
      }
      publish({ isComposing: true })
      return
    }

    if (compositionTail && input.value === compositionTail.value
      && (event.inputType === 'insertFromComposition'
        || (!before && event.inputType === 'insertText' && event.data === compositionTail.data))) {
      compositionTail = null
      return
    }
    compositionTail = null

    if (event.inputType === 'historyUndo' || event.inputType === 'historyRedo') {
      publish({ category: 'history' })
      return
    }

    if (event.inputType?.startsWith('delete')) {
      publish({ category: 'delete' })
      return
    }

    if (INSERT_INPUT_TYPES.has(event.inputType)
      && before?.value === attempt.input
      && before.inputType === event.inputType) {
      const insertion = insertionAtSelection(before, input.value)
      const isLineBreak = event.inputType === 'insertLineBreak' || event.inputType === 'insertParagraph'
      const data = isLineBreak ? '\n' : event.data
      const beforeData = isLineBreak ? '\n' : before.data

      // Chrome can shorten input.data after enforcing maxLength. Both events
      // must explain the accepted insertion, but need not contain equal text.
      if (insertion && acceptedPartOf(data, insertion.insertedText)
        && acceptedPartOf(beforeData, insertion.insertedText)) {
        if (insertion.insertedText === '' && input.value === attempt.input) return
        publish({ ...insertion, category: 'insert' })
        return
      }
    }

    // Missing/ambiguous event information must not prevent editing or invent
    // historical accuracy. The model keeps this unscored until Restart.
    publish({})
  }

  const listeners = {
    beforeinput: beforeInput,
    input: handleInput,
    compositionstart: compositionStart,
    compositionend: compositionEnd,
    paste: restrict,
    drop: restrict,
  }

  for (const [type, listener] of Object.entries(listeners)) {
    input.addEventListener(type, listener)
  }

  return {
    // React's change fallback also preserves edits that do not emit native input.
    reconcileChange() {
      if (!disposed && input.value !== attempt.input) {
        if (composition?.ended) finishComposition(composition)
        else publish({ isComposing: Boolean(composition) })
      }
    },
    dispose() {
      disposed = true
      pending = null
      composition = null
      compositionTail = null
      for (const [type, listener] of Object.entries(listeners)) {
        input.removeEventListener(type, listener)
      }
    },
  }
}
