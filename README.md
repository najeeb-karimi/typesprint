# TypeSprint

A focused typing game built with React, JavaScript, Vite, and plain CSS. Choose a passage length, practice at your own pace, correct mistakes, and start fresh whenever you like.

## Current features

- Twelve original English passages across Short, Medium, and Long groups, with four passages per group.
- A next-length preference and New passage action, with confirmation before discarding a running attempt.
- Current passage category and character count, plus feedback for correct, incorrect, and remaining characters.
- Underlined mistakes, visible incorrect spaces, and a marker for the next unentered character.
- Entered-character progress and current mistake counts.
- Elapsed time from the first character, with frozen time, speed, and historical accuracy results on completion.
- Native text editing, selection, Backspace, Delete, Cut, Undo, and Redo; paste and text drops are blocked.
- Exact-match completion that leaves the finished text read-only; Restart clears the attempt and returns focus to the typing field.
- Linkable Practice and History views, with browser-saved recent results and personal bests for each length.
- Ten results per page, cross-tab updates, and safe clearing with confirmation.
- Responsive layout, labeled controls, visible keyboard focus, and restrained status announcements.

Practice has no time limit. Completed results are saved locally when browser storage is available; there are no accounts. Progress measures entered text; a full progress bar does not mean completion while mistakes remain. The ticking clock stays outside live announcements; completion provides its final measurements without moving focus.

## Passage choices and resets

- **Lengths:** Short passages contain 100–180 characters, Medium 220–320, and Long 400–550. These groups describe length, not difficulty. Every load starts with the original 130-character Short passage.
- **Next passage length:** changing the select configures the next request. It leaves the current passage, typing, timer, and results intact; the category beside the passage describes the active text.
- **New passage:** choose uniformly from the requested group, excluding the current passage. Earlier passages can appear again after another passage intervenes; selection is not a shuffle through every passage.
- **Running attempts:** New passage asks before discarding one, including an attempt cleared to an empty field. Keep current attempt or Escape preserves the field, selection, native editing history, measurements, and length preference, returning focus to New passage. Elapsed time continues while deciding. Clicking the backdrop does nothing.
- **Fresh attempts:** ready and completed attempts change immediately. An accepted change replaces the editing session, clears prior text, native editing history, timing, displayed results, restrictions, and unavailable scores, and focuses the new field. New passage is unavailable while text composition is unfinished, with a visible explanation.
- **Restart and reload:** Restart clears the same passage and retains the next-length preference. Reload returns to the original Short passage and default preference. Saved completion history is retained; an unfinished attempt and length choices are not stored. Initial page loading does not automatically focus the typing field.

## Saved results and navigation

- **Views:** Practice and History have linkable `?view=practice` and `?view=history` addresses, with browser Back and Forward support. Missing or unrecognized values open Practice. Ordinary navigation preserves the mounted attempt, selection, native Undo/Redo, length preference, and running clock. Headings receive focus after view changes; initial loading has no autofocus. View changes cancel open confirmations without discarding an attempt or reopening the confirmation on return.
- **Recording:** each completed, committed attempt is saved once. Restart, an abandoned attempt, navigation, rerenders, and loading existing history do not create records. Completion records contain an ID, completion timestamp shown as local date and time, passage ID, length group, character count, raw duration, WPM, accuracy, and any unavailable-measurement reason. Entered text and passage text are not stored in history.
- **Recent results:** keep the newest 50 additions, displayed ten per page with Previous and Next. Addition order is retained even if the calendar clock changes. Removing an old recent entry does not remove an independently retained personal best. Page controls stay within the available range when another tab changes the list.
- **Personal bests:** one complete winning record is retained for each length group. Eligibility requires positive measured duration, available speed and accuracy, and no scoring-unavailable reason. Compare unrounded WPM, then accuracy for exact speed ties; a complete tie retains the existing winner. There is no minimum accuracy threshold. Length groups describe length, not difficulty, and rounded display values can conceal a difference used in comparison.
- **Unavailable results:** still save the completion and its explanation. Independently valid measurements remain visible, while unavailable values use a dash. These results cannot become personal bests.
- **Local storage:** history is stored under `typesprint.results` in this browser for this site's origin. Development, local preview, different domains, protocols, and ports have separate storage. This is not an account or cloud backup; another browser or device does not share it. Private browsing and clearing site data can remove results. See [MDN's local-storage reference](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage).
- **Open tabs:** cooperating TypeSprint tabs on the same origin serialize saves and clears with an exclusive Web Lock and refresh through storage notifications. The operation reads the latest stored data after acquiring the lock. A completion saved before a clear is removed by that clear; a completion saved afterward remains. This coordination does not prevent unrelated scripts or browser tools from changing site storage.
- **Clear saved results:** a native confirmation removes recent history and all personal bests for this site across its open tabs. Cancel is focused first; Escape cancels and backdrop clicks do nothing. Confirmation clears the latest saved state, including results added before the clear acquires its lock. Only TypeSprint's key is removed. The current attempt, its native editing history, and its displayed completion remain available, and an already completed attempt is not automatically saved again.
- **Failures:** blocked reads, failed writes or clearing, unavailable locking, and malformed or unsupported stored data are explained without interrupting practice. Failed completions are not placed in temporary history or retried automatically. Existing stored data is left untouched on failure; the last readable copy can remain on screen with an explanation. Malformed or unsupported data requires explicit clear confirmation to reset.

## Timing, scoring, and editing

- **Elapsed time:** reading and focusing do not start an attempt. The first accepted text entry starts it. Pauses, time in another tab, losing focus, and clearing all text keep the same attempt running. An exact match after composition finishes freezes the result at that edit's timestamp. Restart, an accepted passage change, or reload creates a fresh attempt.
- **Speed:** WPM means words per minute, using five passage characters per word, including spaces and punctuation. The formula is `(passage.length / 5) / (elapsedMs / 60000)`. A 130-character passage completed in 30 seconds gives 52 WPM. Corrections take time without increasing the completed passage length.
- **Accuracy:** correct accepted character entries divided by all accepted character entries, multiplied by 100. Each insertion is judged at its passage position. Corrections add entries; deletion and Cut do not erase history. Undo and Redo preserve the counters without counting restored text again. Typing `cxt` and replacing `x` with `a` gives 75.0%, even though the finished `cat` has no current mistakes.
- **Display:** running time uses minutes:seconds; completed time adds tenths of a second. Final WPM is rounded to a whole number and accuracy to one decimal place. Calculations use unrounded values. Speed and accuracy stay hidden until completion.

Paste and text drops are blocked in the typing field, with instructions and brief feedback. Selection, replacement, Backspace, Delete, Cut, Undo, and Redo remain available. The English catalog and its character accounting use JavaScript string units; the score measures accepted entries, not physical key presses.

If an edit cannot be measured reliably, editing remains available and speed and accuracy are shown as unavailable, with a reason. Independently valid time can still be shown. Zero or missing duration cannot produce a speed score; missing measurements are not presented as zero. Browser and device behavior during system sleep can vary; the clock is intended for in-page practice, rather than a persistent timer across page lifetimes.

## Prerequisites

- Node.js 24.x and npm. The required Node major version is also recorded in `.nvmrc`.
- A current browser with native modal dialogs, inert content, and modern text-input events. Saving and clearing also require available local storage and [Web Locks](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API) in a secure context: use HTTPS or localhost. Practice remains available when storage or locking fails.

Check your installed tools:

```sh
node --version
npm --version
```

## Install and develop

Download or clone the repository, then open a terminal in its root folder, alongside `package.json`:

```sh
npm ci
npm run dev
```

`npm ci` installs the dependency versions recorded in `package-lock.json`. Open the local address printed by Vite. Stop the development server with Ctrl+C. No environment variables or external services are required.

## Checks and tests

Run all checks before proposing a change:

```sh
npm run check
```

This runs lint, the automated tests, and the production build in order, stopping if a step fails. Individual commands are also available:

| Command | Purpose |
| --- | --- |
| `npm run lint` | Check source against ESLint rules, treating warnings as failures. |
| `npm test` | Run calculation, input-adapter, Hook, and component tests once, then exit. |
| `npm run test:watch` | Rerun relevant tests while editing in an interactive terminal. |
| `npm run build` | Create the production files in `dist/`. |

Vitest checks catalog constraints, deterministic selection and boundaries, attempt transitions, character accounting, score calculations, formatting, and explicit input-adapter event sequences. React Testing Library and user-event exercise the Hook and interface in jsdom's simulated document, including timing, correction history, blocked clipboard actions, clearing text, frozen results, unavailable scores, and repeated fresh attempts. Passage flows cover length preferences, immediate and confirmed changes, cancellation, captured requests, composition restrictions, fresh sessions, and scoring against the active passage length. History tests cover validation, nullable measurements, raw comparisons, independent best retention, the 50-entry boundary, duplicate prevention, cached snapshots, subscription cleanup, and serialized mutations. Interface flows cover one-time completion capture under Strict Mode, pagination, confirmation, failures, direct view addresses, and preserving the editor during navigation and storage notifications. Timing tests control the clock and refresh schedule instead of waiting for real elapsed seconds.

Simulated checks do not establish native browser event ordering, native Undo/Redo, actual operating-system input methods, native dialog modality and keyboard containment, layout, or screen-reader speech. Browser checks must also cover dialog naming, safe initial focus, Tab and Shift+Tab, Escape, backdrop clicks, focus after cancellation or acceptance, preserved editing history on cancellation, and discarded history after switching. Recheck composition, selection replacement, length limits, clipboard restrictions, and time away from the field. Browser automation of composition does not replace testing a real input method on the supported platform.

For UI checks, use both the development server and production preview. Inspect Short, Medium, and Long passages in ready, running, completed, unavailable-result, and open-confirmation states at 320, 768, and 1280 CSS pixels, on both sides of the 40rem layout breakpoint, and at actual 200% browser page zoom. Confirm longer text grows in ordinary document flow, remains fully readable, and leaves controls reachable by vertical scrolling without horizontal overflow or automatic passage scrolling. Check growing time and score values, wrapping, keyboard navigation and focus outlines, reduced motion for controls, and that final announcements do not repeat as the clock refreshes. Verify speech separately with the browser and screen reader being supported.

For history checks, seed more than ten entries and verify first, intermediate, and last pages, partial pages, boundary buttons, and page recovery after a remote clear. Use separate same-origin tabs to save and clear while the other tab is typing, showing completed results, paging, or confirming a clear. Verify latest-state clearing, unrelated storage preservation, unavailable and long-value records, empty history, blocked storage/locking, and malformed or unsupported data. Recheck native Undo/Redo, selection, timing, quiet announcements, and focus after paging or confirmation. Include History and both confirmation dialogs in the responsive and actual-zoom checks above. Native browser automation is supplementary evidence; physical IME and screen-reader operation require separate verification.

The [GitHub Actions workflow](.github/workflows/ci.yml) runs `npm ci` and `npm run check` on pull requests and pushes to `main`, using Node 24 from `.nvmrc`.

## Preview the production build

Build first, then serve the generated files locally:

```sh
npm run build
npm run preview
```

Open the address printed by Vite and stop the preview with Ctrl+C. Preview is a local check of the built app; it does not deploy it.

## Project organization

```text
.github/workflows/ci.yml              Automated repository checks
public/favicon.svg                    Local TypeSprint icon
src/main.jsx                          React entry and global stylesheet import
src/App.jsx                           Views, passage ownership, completion capture, and history controller
src/data/passages.js                  Authored passage catalog and starting ID
src/components/PracticeSession.jsx    Attempt feedback, editing session, and Restart
src/components/PassageControls.jsx    Length preference and pending passage requests
src/components/HistoryView.jsx        Personal bests, recent pages, and clear confirmation
src/components/ConfirmationDialog.jsx Shared native confirmation and single-decision lifecycle
src/components/PassageChangeDialog.jsx Native running-attempt confirmation
src/components/AttemptResults.jsx     Labeled completed measurements
src/components/PassageDisplay.jsx     Accessible passage and visual feedback
src/hooks/usePracticeAttempt.js       Editing connection, clock, and completion delivery
src/hooks/useViewNavigation.js        Link handling, query views, and browser traversal
src/lib/resultHistory.js              Pure record validation, retention, and best comparison
src/lib/createHistoryController.js    Local storage, locks, snapshots, and cross-tab updates
src/lib/selectNextPassage.js          Deterministic category selection and repeat exclusion
src/lib/attachPracticeInput.js        Native input events and accepted-edit translation
src/lib/practiceAttempt.js            Pure attempt transitions and scoring
src/lib/formatAttemptMetrics.js       Measurement formatting and completion wording
src/lib/comparePassage.js             Pure character-comparison calculation
src/test/setup.js                     Shared test assertions and cleanup
src/styles.css                        Layout, design values, and feedback styles
```

Tests live beside the component or calculation they check in `*.test.jsx` and `*.test.js` files. Vite, Vitest, and ESLint configuration live at the repository root.

## Future Vercel setup

Deployment is deferred. When ready to import the published repository into Vercel, use these settings:

| Setting | Value for this project |
| --- | --- |
| Root directory | Repository root, where `package.json` lives |
| Framework preset | Vite |
| Node.js version | 24.x |
| Build command | `npm run build` |
| Output directory | `dist` |

No environment variables are needed for the current app. Consult [Vercel's Vite guide](https://vercel.com/docs/frameworks/frontend/vite) and [build settings](https://vercel.com/docs/builds/configure-a-build) when setting it up; platform settings can change.
