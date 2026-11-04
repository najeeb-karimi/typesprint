# Plan 004: Results History and Personal Bests

## Summary

Add a linkable **History** view with the latest 50 completions and separate all-time personal bests for Short, Medium, and Long. Save results locally and synchronize changes across open TypeSprint tabs.

Keep React, JavaScript, Vite, plain CSS, and the charcoal-and-amber design. Accounts, cloud storage, charts, export/import, countdown modes, and deployment remain outside this plan.

## Agreed behavior

- **Recording:** save each completed attempt once, including completions with unavailable measurements. Abandoned attempts, Restart, navigation, and rerenders create no records.
- **Stored information:** retain a unique result ID, completion date/time, passage ID, category, character count, raw elapsed time, raw WPM, raw accuracy, and scoring-unavailable reason. Do not store entered text or passage text.
- **Recent history:** retain the newest 50 additions, displayed ten per page with Previous and Next controls. Show local completion date/time, category, character count, duration, speed, accuracy, and any unavailable-measurement explanation.
- **Personal bests:** retain one complete winning record per length group independently of recent-history pruning. Require positive measured duration, available speed and accuracy, and no scoring-unavailable reason. Compare unrounded WPM first, then accuracy for exact speed ties; otherwise retain the existing winner. Apply no minimum accuracy threshold.
- **Presentation:** show three personal-best cards above the recent-results list. Identify a recent entry that matches its category’s current best. Explain that categories describe length and that comparisons use unrounded measurements.
- **Navigation:** use linkable `?view=practice` and `?view=history` addresses, supporting browser Back/Forward. Missing or unrecognized values show Practice. Ordinary navigation preserves the mounted practice session, its selection, native editing history, preference, and running clock.
- **Focus:** identify the active navigation link and focus the destination heading after navigation, including Back/Forward. Initial loading retains no autofocus. Rename the skip link to **Skip to main content**. View changes cancel open confirmations without discarding the attempt or reopening them on return.
- **Clearing:** provide **Clear saved results** in History. A native modal explains that this removes recent history and all personal bests across open tabs. Initially focus Cancel; Escape cancels, backdrop clicks do nothing, and confirmation clears the latest saved state. Clearing preserves the current practice attempt and displayed result.
- **Save failures:** keep the typing result visible, report that saving failed, and leave saved history unchanged. Do not silently create temporary history or retry previously failed completions.

## Architecture and persistence

- Keep history outside the replaceable practice session. Extend its interface with passage identity, view activity, and an optional stable completion callback while preserving standalone passage-string usage.
- Publish completion from the accepted-edit path using the completed snapshot and its frozen metrics. Generate the result ID and wall-clock completion time once outside rendering and state updaters; continue using the existing elapsed-time clock for duration.
- Implement pure record validation, bounded insertion, duplicate prevention, and best comparison separately from browser access. Store raw measurements and reuse existing display formatters.
- Use one versioned JSON document under the `typesprint.results` local-storage key, containing recent records and independently retained best records. Loading performs no writes. Local storage belongs to the site’s origin, so development, preview domains, and production do not share history. [MDN reference](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage).
- Provide a small history controller exposing a cached immutable snapshot, subscription, record, and clear operations; connect it through React’s [`useSyncExternalStore`](https://react.dev/reference/react/useSyncExternalStore). Browser dependencies must be replaceable in tests.
- Serialize record and clear operations with an exclusive **Web Lock**, rereading persisted state inside the lock before updating it. Publish successful changes locally and refresh other tabs through storage events; subscriptions must clean up correctly. [Web Locks reference](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API).
- Handle blocked storage, failed writes, and unavailable locking without affecting practice or claiming success. Malformed or unsupported stored data must remain untouched, with an explanation and an explicit clear/reset action. Clear only TypeSprint’s key.
- Use ordinary navigation links with client-side handling for unmodified clicks; preserve normal modified-click behavior. Keep the practice subtree mounted and hide the inactive view without overriding native hidden behavior. No routing dependency is needed.

## Implementation phases

### Phase 1 — History model and persistence

Implement record creation, validation, retention, best comparison, and the browser controller without changing the displayed application.

**Acceptance:** focused tests cover nullable measurements, independent best retention, ties, duplicate records, malformed data, storage failures, subscriptions, and serialized updates.

### Phase 2 — Completion capture and linkable views

Connect completion recording and add functional Practice/History navigation, personal-best summaries, and recent results. Preserve the practice session across navigation and history updates.

**Acceptance:** each completion is recorded once under Strict Mode; reload restores history; navigation and storage notifications preserve editing, timing, and scoring; unavailable results remain distinguishable.

### Phase 3 — History management and presentation

Add pagination, clear confirmation, empty/error states, responsive styling, focus behavior, and accessible labels. Update README with saving rules, comparisons, navigation, browser requirements, and verification boundaries.

**Acceptance:** both views and confirmations remain readable and operable at 320, 768, and 1280 CSS pixels, around the existing breakpoint, and at actual 200% browser zoom. Verify development and production, plus real two-tab saving and clearing.

### Phase 4 — Full audit and fixes

Audit every preceding requirement, correct discrepancies, run `npm run check`, and verify the production application in real browsers. Confirm that navigation, history updates, and clearing leave no duplicate records, obsolete subscriptions, editor reconnections, timer resets, or stale confirmations.

Complete the audit without report files and identify checks that could not be performed. Remove the completed public plan and temporary learning companion, retaining `docs/plans/.gitkeep`.

## Verification and workflow

- Exercise completion → History → Practice → Restart → another completion, including browser Back/Forward and a direct History URL load.
- Verify the 51st completion removes the oldest recent entry while an older personal best survives; test exact ties and unavailable measurements.
- Test simultaneous two-tab completions and save/clear ordering. A cleared completed result must not reappear merely because its practice screen rerenders.
- Test failed reads, writes, clearing, and unsupported stored versions without losing existing data or interrupting typing.
- Recheck native Undo, selection, composition, modal behavior, quiet announcements, reduced motion, long content, and pagination after cross-tab changes.
- On export, use `docs/plans/plan-004-results-history.md` with a companion in ignored `tmp/`. Implement one phase per pass, with learning notes in separately requested passes. Preserve established lessons and examples; keep the approved plan unchanged until cleanup.
- End implementation passes with a conventional commit title, unwrapped explanatory paragraphs, and `Co-authored-with: Codex, GPT-6.1 Sol`. Create no commits or pushes.
