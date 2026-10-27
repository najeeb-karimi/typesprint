# TypeSprint — Plan 001: Polished Untimed Practice

## Summary

Build TypeSprint’s first usable milestone: a polished browser interface where a player can type a passage, see character feedback, correct mistakes, and restart.

Use React with JavaScript, Vite, and plain CSS. Establish maintainable code and meaningful verification while keeping the first milestone small.

**Excluded:** timers, words per minute, accuracy scores, saved records, random passages, accounts, theme switching, and deployment. These belong in later plans.

Save this plan as `docs/plans/plan-001-untimed-practice.md`. Implement one phase at a time, reporting its changes and verification before moving to the next phase.

## Product and Technical Decisions

**Visual direction**

- Use charcoal backgrounds, slightly lighter panels, warm amber accents, and restrained borders and shadows.
- Use system sans-serif fonts for the interface and system monospace fonts for the passage. Require no external font service.
- Center the interface within a maximum width of approximately 960px. Stack controls naturally on narrow screens.
- Include TypeSprint branding, an “Untimed practice” label, the heading “Find your typing rhythm,” the practice panel, and brief instructions.
- Show only working controls and truthful progress information. Omit placeholders for future features.

**Practice behavior**

- Use one original, fixed English passage:

  > Small steps build steady progress. Take a breath, find your rhythm, and let each careful keystroke bring the next word into focus.

- Display the passage above a visible, labeled native textarea. Preserve normal selection, editing, Backspace, paste, and undo behavior.
- Compare input with the passage by character position, including spaces, capitalization, and punctuation. Do not trim or otherwise transform entered text.
- Distinguish correct, incorrect, and remaining characters. Underline or highlight mistakes so feedback does not depend on color alone; make incorrect spaces visible.
- Mark the next unentered character with a static indicator. Retain the textarea’s normal editing caret.
- Limit input to the passage’s length. Newlines count as mismatches and remain editable.
- Show entered-character progress and the number of currently incorrect positions. These describe the current input, rather than historical mistakes.
- Finish only when the input exactly matches the passage. A full-length incorrect entry remains editable and prompts the player to correct mistakes.
- On completion, make the textarea read-only and show a clear success message. Restart clears the input and feedback and focuses the textarea.
- Do not automatically focus the textarea when the page first opens or introduce global keyboard shortcuts.

**Architecture**

- Keep the app in the existing repository root. Preserve existing files and ignore rules.
- Use a small component structure: application shell, practice session, and passage display.
- The practice session owns the entered text. Derive comparison results, counts, and completion from that text; avoid storing duplicate values that can disagree.
- Keep character comparison in a pure JavaScript function, separate from rendering.
- Use React state for input and a ref for restart focus. No state-management library, router, backend, or component framework.
- There are no external APIs or persisted-data formats in this milestone. The passage is provided to the practice session as text.

## Implementation Phases

### Phase 1 — Establish the Project Foundation

- Add a minimal React/Vite JavaScript setup without using a scaffolding operation that overwrites the nonempty repository.
- Use Node.js `24.x` and npm. Install compatible stable dependencies and commit the lockfile. Node 24 is supported by Vercel. [Vercel documentation](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions).
- Configure React Strict Mode and ESLint with React Hooks and refresh rules.
- Add consistent UTF-8, LF, and two-space indentation settings.
- Extend ignore rules for installed dependencies, build output, local tooling artifacts, and local environment files.
- Replace starter branding with TypeSprint’s page title, description, and a simple local SVG favicon.
- Provide working `dev`, `build`, `preview`, and `lint` scripts.

**Exit criteria:** the app opens locally, the production build succeeds, lint passes, and existing repository material remains intact.

### Phase 2 — Build the Visual and Accessible Foundation

- Implement the agreed layout with shared CSS values for colors, spacing, typography, borders, and focus states.
- Build the passage panel, labeled textarea, progress area, status message, and Restart button.
- Keep the initial screen honest and coherent while behavior is added in Phase 3; do not imply that unfinished interactions work.
- Use semantic headings and native controls with visible keyboard focus and touch targets of at least 44px.
- Present the passage as coherent text to screen readers; character-level visual markup must not create fragmented announcements.
- Reserve polite live announcements for meaningful status changes, rather than every keystroke.
- Respect reduced-motion preferences and avoid decorative animation that distracts from typing.

**Exit criteria:** the interface remains readable without horizontal page scrolling at 320px, 768px, and 1280px widths and at 200% browser zoom. Keyboard order and control labels are clear.

### Phase 3 — Implement Untimed Practice

- Connect the textarea to React state using its native change events. React requires controlled textareas to update their backing value through `onChange`. [React documentation](https://react.dev/reference/react-dom/components/textarea).
- Implement the character comparison, visual feedback, progress, correction guidance, completion, and restart behavior specified above.
- Keep editing immediate and local. Do not intercept ordinary text input or add artificial delays.
- Add Vitest, React Testing Library, user-event, and jsdom. Test calculations directly and interactions through accessible controls.
- Provide a noninteractive `test` script and a separate `test:watch` script.

**Exit criteria:** the complete practice flow works with typing, correction, completion, and repeated restarts; automated behavior tests pass.

### Phase 4 — Prepare the Public Repository

- Write a concise public README covering the current feature set, prerequisites, installation, development, testing, production preview, and project organization.
- Describe future Vercel setup using the Vite preset, the build script, and `dist` output. Do not connect services or deploy in this plan. [Vercel’s Vite guidance](https://vercel.com/docs/frameworks/frontend/vite).
- Add `npm run check` to run lint, tests, and the production build.
- Add a GitHub Actions workflow for pull requests and pushes to `main`, using Node 24 and `npm ci` before the checks.
- Keep components small, names descriptive, and comments focused on reasoning. Remove starter assets, dead code, and debug output.
- Do not add abstractions, dependencies, or configuration for unimplemented features.

**Exit criteria:** documented commands match the project, the combined check succeeds, and the workflow is ready to run when the repository is published.

### Phase 5 — Audit Every Earlier Phase and Close the Plan

- Review every requirement from Phases 1–4 against the actual implementation.
- Verify reproducibility with `npm ci`, then run the combined checks.
- Exercise the production preview in a real browser, including keyboard-only operation, narrow layouts, zoom, and reduced motion.
- Check for console errors, missing assets, misleading copy, broken focus, layout overflow, and inconsistent feedback.
- Inspect the public changes for accidental local files and confirm existing ignore protections remain effective.
- Fix findings and repeat the checks affected by those fixes. Report actual verification and any remaining limitations; do not mark unperformed browser checks as passed.
- Once all acceptance criteria pass, remove this plan while preserving `docs/plans/.gitkeep` and unrelated documents. Provide the audit results in the final handoff.

## Verification Scenarios

Automated tests must cover:

- Empty input produces no errors and no completion.
- A correct prefix marks only the entered positions correct.
- Incorrect letters, spaces, capitalization, and punctuation produce positional errors.
- Backspace and replacement clear errors when the input is corrected.
- Full-length incorrect input remains editable and incomplete.
- An exact match produces completion and a read-only textarea.
- Restart clears progress and feedback, restores editing, and focuses the textarea.
- Repeated restarts work consistently.
- Native paste respects the input length limit.

Browser checks must cover the same central flow, visible focus, readable character feedback, mobile-width input, and production asset loading. Avoid snapshot tests that merely duplicate the component markup.

## Assumptions and Defaults

- Desktop keyboard use is primary; responsive layouts and native text entry must also work on touch devices.
- This milestone uses one ASCII English passage; multilingual passage handling is deferred.
- Native selection and paste are intentional features of untimed practice.
- Use current compatible stable packages, with installed versions recorded in the lockfile.
- Remotes, publishing, and actual deployment remain for later work.
