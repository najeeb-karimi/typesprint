import { useCallback, useEffect, useRef, useState } from 'react'
import { attachPracticeInput } from '../lib/attachPracticeInput.js'
import { createAttempt, getAttemptMetrics } from '../lib/practiceAttempt.js'

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
  const [clockSample, setClockSample] = useState(null)
  const stopTimerRef = useRef(null)
  const editorRef = useRef(null)
  const focusOnMount = useRef(false)

  const stopClock = useCallback(() => {
    stopTimerRef.current?.()
    stopTimerRef.current = null
  }, [])

  const { status, startedAt } = attempt
  useEffect(() => {
    if (status !== 'running' || startedAt === null) return

    let active = true
    const interval = setInterval(() => {
      if (active) {
        setClockSample({ inputVersion, startedAt, timestamp: performance.now() })
      }
    }, 250)
    const stop = () => {
      active = false
      clearInterval(interval)
    }
    stopTimerRef.current = stop

    return () => {
      stop()
      if (stopTimerRef.current === stop) stopTimerRef.current = null
    }
  }, [status, startedAt, inputVersion])

  const inputRef = useCallback(input => {
    const editor = attachPracticeInput(input, {
      passage,
      onAttempt(next) {
        if (next.status === 'completed') stopClock()
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
      stopClock()
      if (editorRef.current === editor) editorRef.current = null
    }
  }, [passage, stopClock])

  function handleChange() {
    editorRef.current?.reconcileChange()
  }

  function restart() {
    // Detach immediately so a queued old composition cannot publish into the
    // new attempt before React commits the new textarea.
    stopClock()
    editorRef.current?.dispose()
    editorRef.current = null
    focusOnMount.current = true
    setAttempt(createAttempt(passage))
    setRestriction('')
    setInputVersion(version => version + 1)
  }

  // An old sample must not supply time for a fresh attempt, even if a clock
  // reading happens to equal the previous attempt's start.
  const timestamp = clockSample?.inputVersion === inputVersion && clockSample?.startedAt === startedAt
    ? clockSample.timestamp : startedAt
  const metrics = getAttemptMetrics(attempt, timestamp)

  return { attempt, metrics, inputRef, inputVersion, handleChange, restriction, restart }
}
