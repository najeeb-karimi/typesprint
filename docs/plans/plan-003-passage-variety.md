# Plan 003: Passage Variety

## Summary

Add a curated passage library with Short, Medium, and Long choices. Players choose a length, then press **New passage** to receive a different passage. Replacing a running attempt requires confirmation.

Keep React, JavaScript, Vite, plain CSS, and the current charcoal-and-amber design. Countdown modes, saved results, accounts, generated content, and deployment remain outside this plan.

## Agreed behavior and interfaces

### Catalog and selection

- Include **12 original English passages**, four per category:
  - **Short:** 100–180 characters.
  - **Medium:** 220–320 characters.
  - **Long:** 400–550 characters.
- Preserve the existing 130-character passage as the initial Short passage.
- Represent each passage as `{ id, category, text }`, with stable unique IDs and unique text. Use ordinary English prose, printable ASCII punctuation, and single spaces; exclude tabs, line breaks, and leading or trailing whitespace.
- Derive character counts from the text. Categories describe length, not difficulty.
- Select uniformly from the requested category, excluding the currently displayed passage. Earlier passages may recur after another passage intervenes.
- Use a deterministic selection helper accepting the catalog, category, current ID, and a supplied random value. Read `Math.random()` only when applying a passage change, outside rendering and state-updater functions.

### Controls and attempt ownership

- Place a native select labeled **Next passage length** and a **New passage** button before the reference text.
- Changing the select only configures the next request. It does not replace text, reset measurements, or start an attempt.
- Show the current passage’s actual category beside its character count, independently of the next-length selection.
- **Restart** resets the current passage and retains the chosen next length.
- **New passage** replaces ready or completed attempts immediately. A running attempt requires confirmation, including when its text has been cleared.
- Disable New passage during active composition, with a visible explanation to finish composing first.
- Applying a passage change clears text, history, timing, results, restrictions, and unavailable-score state. Focus the fresh typing field. Initial page loading retains the current behavior without autofocus.
- Reloading returns to the original Short passage; no selection or progress is persisted.

`App` owns the active passage ID. Extend `PracticeSession` with category metadata, a passage-change callback, and opt-in initial focus while retaining its passage-string input. Key the session by passage ID so replacement disposes its editing connection and timer. Keep confirmation and next-length state separate from the attempt model. Follow [React’s state-reset guidance](https://react.dev/learn/preserving-and-resetting-state).

### Running-attempt confirmation

- Use a native modal `<dialog>` opened with `showModal()`, following the [HTML dialog standard](https://html.spec.whatwg.org/multipage/interactive-elements.html#the-dialog-element).
- Title: **Change passage?**
- Explain that changing discards the current attempt and that elapsed time continues while deciding.
- Provide **Keep current attempt** and **Discard and change**. Initially focus Keep current attempt.
- Cancel or Escape preserves the current field, selection, editing history, measurements, and requested length; return focus to New passage.
- Clicking the backdrop does nothing.
- Confirmation applies the captured length request exactly once. Close the dialog before replacing the session, then focus the new field.
- Opening or canceling the dialog must not reconnect the editor, reset historical accounting, or pause timing.

## Implementation phases

### Phase 1 — Catalog and deterministic selection

- Add the catalog and selection helper without changing the displayed application.
- Test unique IDs/text, category counts, character bounds, allowed text, preservation of the original passage, category filtering, exclusion of the current passage, and first/last selection boundaries.
- Verify selection does not mutate the catalog and produces identical output for identical supplied inputs.

**Acceptance:** catalog and selection tests pass; existing practice behavior remains intact.

### Phase 2 — Passage controls and safe switching

- Connect the catalog to App and implement the controls, category display, and confirmation dialog.
- Keep the existing attempt model, timing rules, scoring formulas, and clipboard policy.
- Add optional initial-focus support without making the native editing connection depend on changing control or dialog state.
- Implement fresh-session cleanup and focus for passage changes.
- Add component tests alongside the behavior, including cancellation, confirmation, composition restrictions, and continuous timing.

**Acceptance:** players can change lengths and passages safely; cancellation preserves the active attempt, and accepted changes create a clean attempt.

### Phase 3 — Presentation and integrated verification

- Fit the controls and dialog into the existing spacing, typography, borders, focus styles, and reduced-motion behavior.
- Stack controls where necessary. Keep longer passages in ordinary document flow with vertical scrolling; do not clip reference text or introduce automatic scrolling.
- Expand complete-flow tests across passage changes, completion, unavailable results, Restart, and repeated dialog use.
- Update README features, selection rules, reset behavior, and verification boundaries.

**Acceptance:** controls, passages, results, and dialog remain readable and operable in development and production at 320, 768, and 1280 CSS pixels, around the layout breakpoint, and at actual 200% browser zoom.

### Phase 4 — Full audit and fixes

- Audit every requirement and all preceding phases against the finished application.
- Fix discrepancies in selection, attempt ownership, editing, timing, scoring, accessibility, styling, tests, and documentation.
- Run `npm run check` and verify the production build in a real browser.
- Confirm passage changes leave no obsolete listeners, active timers, composition work, editing history, or stale results.
- Complete verification without writing an audit report. Identify any checks that could not be performed.
- Remove the completed public plan and temporary learning companion while retaining `docs/plans/.gitkeep`.

**Acceptance:** automated checks pass, browser evidence supports the implemented behavior, and the completed planning files are removed.

## Verification scenarios

- Initial load remains the original Short passage with no running timer.
- Changing the next-length selection preserves ready, running, and completed attempts.
- New passage always matches the requested category and differs from the current passage.
- Canceling through either button or Escape preserves an active attempt, including one cleared to empty; time spent deciding counts.
- Switching from completed or unavailable results removes every previous measurement and explanation.
- Restart keeps the same passage; New passage replaces it.
- Native Undo cannot restore text from a replaced passage. Old callbacks and composition notifications cannot affect its replacement.
- Test different passage lengths and confirm WPM uses the active passage’s actual character count.
- Test modal naming, initial focus, Tab containment, Escape, focus restoration, and successful-change focus in a real browser. Simulated document tests alone do not establish native modal behavior.
- Recheck native editing, clipboard restrictions, composition, quiet timer updates, final announcements, and long-passage usability.

## Workflow and defaults

- Implement one phase per pass, followed by its separate learning-notes pass.
- Keep learning topics in the private companion; preserve established explanations and examples.
- Keep the approved public plan unchanged until final cleanup.
- End each implementation pass with a conventional commit message containing a title, unwrapped explanatory paragraphs, and `Co-authored-with: Codex, GPT-6.1 Sol`.
- Add no dependencies, backend services, storage, routes, or deployment configuration.
