# Plan 002: Timing and Results

## Summary

Turn the existing passage practice into a measured attempt: start timing with the first text entry, preserve correction and native editing, and show elapsed time, typing speed, and historical accuracy after completion.

Keep React, Vite, plain CSS, the current passage, and the charcoal-and-amber design. Countdown modes, passage selection, saved records, accounts, and Vercel deployment remain outside this plan.

## Agreed behavior and scoring

- **Start and finish:** reading, focusing, and navigation do not start the clock. The first accepted text entry starts it. An exact passage match finishes the attempt and freezes its measurements. Composition input must finish before completion is recognized.
- **Continuous timing:** the clock keeps running through pauses, tab switches, focus changes, and deletion of all entered text. Only Restart creates a fresh attempt. Reloading starts over.
- **Editing:** preserve selection, replacement, Backspace, Delete, Cut, Undo, Redo, and the native length limit. Block clipboard paste and text drops into the typing field; explain the restriction before typing and give restrained feedback when either is attempted.
- **Speed:** use five passage characters as one word, including spaces and punctuation. Final WPM is `(passage.length / 5) / elapsedMinutes`. Corrections take time but do not inflate the completed character count.
- **Accuracy:** use `correct character entries / total character entries × 100`. Judge each newly inserted character against its passage position. Corrections add entries; deletion does not erase history. Undo and Redo preserve existing counters without adding entries. For example, entering `cxt` and replacing `x` with `a` produces 75% accuracy.
- **Presentation:** show elapsed time during practice; reveal WPM and accuracy only after completion. Display whole-number WPM, accuracy to one decimal place, live time as `m:ss`, and final time as `m:ss.s`. Calculate from unrounded values. Missing measurements use an explanatory unavailable state rather than fabricated values.

## Implementation phases

### Phase 1 — Attempt model and scoring

- Add a small, pure attempt model with ready, running, and completed states. Store input, start/end timestamps, and entry counters; keep current progress and mistakes derived through the existing comparison helper.
- Define normalized edit input containing the accepted text, insertion position and characters, edit category, composition state, and timestamp. Keep browser events outside the model.
- Count only accepted inserted characters, including replacements that leave the visible text unchanged. Moving existing characters through deletion must not count them again.
- Add focused unit tests for transitions, reset, historical accuracy, WPM, formatting boundaries, and unavailable measurements. Keep the current application behavior unchanged during this phase.

**Acceptance:** deterministic model tests pass, including 130 characters completed in 30 seconds yielding 52 WPM.

### Phase 2 — Editing integration and attempt lifecycle

- Integrate the model with the controlled textarea. Capture the selection and edit information before editing, then reconcile the accepted value afterward; count each committed edit once.
- Use native browser edit information where needed rather than assuming React’s `onBeforeInput` exposes the native event. React documents that distinction in its [event reference](https://react.dev/reference/react-dom/components/common#common-props).
- Preserve composition editing without counting intermediate composition updates as separate entries. Canceled composition adds no scored entries. Prevent premature completion and clear pending edit information on Restart.
- Block paste and text drops without changing the input, timer, or counters. Update the instructions and replace existing paste-acceptance tests with the new expectations.
- If an accepted edit cannot be scored reliably from the available browser information, preserve editing and mark that attempt’s scores unavailable. Do not silently guess its accuracy.

**Acceptance:** normal typing, corrections, selection replacement, deletion, Undo/Redo, and repeated Restart work without duplicate or lost accounting. Restart restores readiness and focuses the textarea.

### Phase 3 — Clock and completed results

- Measure elapsed time from `performance.now()` timestamps. Use a 250 ms refresh interval only to update the display; never calculate duration by counting interval callbacks. Capture the finish timestamp in the completing edit.
- Clean up timers and native listeners on restart and unmount, including React Strict Mode’s setup/cleanup cycle. Use the documented [Effect cleanup behavior](https://react.dev/reference/react/useEffect#connecting-to-an-external-system).
- Add the live elapsed-time display and an inline completed-results section containing time, WPM, and accuracy. Keep the completed passage visible and read-only, with Restart available.
- Keep the timer outside live announcements. Announce completion once with its final measurements, without moving keyboard focus or opening a dialog.
- Update copy that currently promises “No clock” so it describes passage practice with no countdown.

**Acceptance:** scores stay hidden while typing, freeze on completion, and disappear on Restart. Delayed timer callbacks cannot change final results or revive a restarted attempt.

### Phase 4 — UI polish and integration verification

- Fit the timer and results into the existing visual system using consistent spacing, typography, borders, and restrained emphasis. Use stable-width numerals so time changes do not shift surrounding content.
- Keep labels and instructions visible, preserve focus outlines, and ensure result values wrap without overlap. Retain reduced-motion support.
- Expand component tests for the complete measured-attempt flow, including clear-to-empty behavior, blocked paste, persistent historical mistakes, frozen results, and multiple restarts.
- Update the public README with the implemented features, scoring definitions, paste policy, and current test boundaries. Keep its setup instructions accurate.

**Acceptance:** the development and production interfaces remain usable at 320, 768, and 1280 CSS pixels, intermediate widths around the layout breakpoint, and 200% browser zoom.

### Phase 5 — Full audit and fixes

- Review every requirement and all preceding phases against the finished application. Fix discrepancies in behavior, calculations, event handling, accessibility, styling, tests, and documentation.
- Run `npm run check` and verify the production build in a real browser. Exercise keyboard navigation, native editing, clipboard restrictions, composition, background-tab timing, completion, and Restart.
- Confirm there are no unexpected dependencies, debug output, persistent listeners, duplicate timers, misleading scores, or stale untimed-only documentation.
- Complete necessary fixes and verification without creating an audit report. Once all phases pass, remove this plan and its temporary companion while retaining `docs/plans/.gitkeep`.

**Acceptance:** all automated checks pass, browser checks support the claimed behavior, and any unavailable verification is explicitly identified.

## Interfaces and verification boundaries

- No public API, storage schema, or deployment configuration changes are needed. Keep the existing `comparePassage` contract; introduce only internal attempt-model and browser-integration interfaces.
- Use injected timestamps and controlled timers for deterministic automated tests. Cover same-character replacements, shifted suffixes, rejected over-limit input, zero-duration results, and rounding carries.
- Verify native event ordering, Undo/Redo, composition, and focus in real browsers; simulated component events alone do not establish those behaviors.
- Keep every phase independently checkable. Add its relevant tests during implementation rather than postponing them to the final audit.
