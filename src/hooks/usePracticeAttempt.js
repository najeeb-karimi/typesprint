import { useCallback, useRef, useState } from 'react'
import { attachPracticeInput } from '../lib/attachPracticeInput.js'
import { createAttempt } from '../lib/practiceAttempt.js'

const RESTRICTIONS = {
  paste: 'Paste is unavailable. Type the passage yourself.',
  drop: 'Text drops are unavailable. Type the passage yourself.',
}

// The passage stays fixed for this hook's lifetime. Its component is keyed by
// passage; Restart keys the field separately to discard old native edit history.
export function usePracticeAttempt(passage) {
  const [attempt, setAttempt] = useState(() => createAttempt(passage))
  const [inputVersion, setInputVersion] = useState(0)
  const [restriction, setRestriction] = useState('')
  const editorRef = useRef(null)
  const focusOnMount = useRef(false)

  const inputRef = useCallback(input => {
    const editor = attachPracticeInput(input, {
      passage,
      onAttempt(next) {
        setAttempt(next)
        setRestriction('')
      },
      onRestricted(kind) {
        setRestriction(RESTRICTIONS[kind])
      },
    })
    editorRef.current = editor

    if (focusOnMount.current) {
      input.focus()
      focusOnMount.current = false
    }

    return () => {
      editor.dispose()
      if (editorRef.current === editor) editorRef.current = null
    }
  }, [passage])

  function handleChange() {
    editorRef.current?.reconcileChange()
  }

  function restart() {
    // Detach immediately so a queued old composition cannot publish into the
    // new attempt before React commits the new textarea.
    editorRef.current?.dispose()
    editorRef.current = null
    focusOnMount.current = true
    setAttempt(createAttempt(passage))
    setRestriction('')
    setInputVersion(version => version + 1)
  }

  return { attempt, inputRef, inputVersion, handleChange, restriction, restart }
}
