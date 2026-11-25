# ⌨️ TypeSprint

TypeSprint is a typing game built with React, JavaScript, Vite, and plain CSS. Practice at your own pace, improve your accuracy, and compare results in the same browser.

[Start Typing](https://typesprint-chi.vercel.app/?view=practice) · [Open History](https://typesprint-chi.vercel.app/?view=history)

## ✨ What You Can Do

- Practice with twelve original English passages across Short, Medium, and Long lengths.
- See correct, incorrect, and remaining characters, including marked spaces and the next character to enter.
- Finish an exact match to see elapsed time, speed, and accuracy. Practice has no time limit.
- Review recent results and personal bests with keyboard-friendly controls and a responsive layout.

## 📚 Passage Choices and Resets

Each load starts with the original 130-character Short passage. Length groups describe character count, not difficulty. The length selector applies to the next **New passage** request, which picks a different passage from the chosen group.

A running attempt needs confirmation before switching. **Keep current attempt** or Escape preserves the editor and its Undo/Redo history while the clock keeps running. An accepted switch starts a fresh attempt and focuses the new field. Finish any in-progress text composition before switching. **Restart** repeats the same passage and keeps the next-length preference.

## ⏱️ Timing, Scoring, and Editing

The first accepted text entry starts the clock. It keeps running when you pause, leave the field, or clear the text. An exact match freezes the time and makes the completed text read-only. A full progress bar can still contain mistakes.

- **Speed** is words per minute (WPM), calculated from the completed passage length using five characters per word. A 130-character passage finished in 30 seconds is 52 WPM.
- **Accuracy** measures correct entries divided by all accepted entries. Corrections add new entries, so typing `cxt` and replacing `x` with `a` gives 75%, even though the final text is `cat`. Undo and Redo preserve the counters.
- **Editing** supports selection, replacement, Backspace, Delete, Cut, Undo, and Redo. Paste and text drops are blocked. If an edit cannot be scored reliably, you can still finish and see an explanation.

## 📊 Saved Results and Navigation

Practice and History have direct links and support browser Back and Forward. Switching views preserves a running attempt and its editor. Reloading starts a fresh attempt and retains saved results.

- History keeps the newest 50 completions, ten per page. Each completed attempt is saved once, without the entered text or passage text.
- Personal bests are kept separately for each length. Eligible results are ranked by unrounded speed, then accuracy for exact speed ties. Results with unavailable scores can still appear in History.
- Results stay in the browser for the site's origin, which includes the protocol, hostname, and port. Local development, Vercel previews, and the public site use separate storage when those addresses differ. There are no accounts or cross-device sync.
- Tabs on the same origin share saved results in the `typesprint.results` storage key. An exclusive Web Lock orders saves and clears so each operation uses the latest stored data. **Clear saved results** asks for confirmation and removes History and bests while leaving the current attempt intact.
- Practice remains available if storage or locking fails. History explains the problem and shows the last readable copy when available. Clearing unreadable history requires confirmation.

## 🛠️ Run TypeSprint Locally

Use Node.js 24.x and npm. From the repository root, install the versions in the lockfile and start Vite:

```sh
npm ci
npm run dev
```

Open the address Vite prints. Use HTTPS or localhost for browser storage and [Web Locks](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API). TypeSprint runs without environment variables.

### 👀 Preview the Production Build

```sh
npm run build
npm run preview
```

Open the displayed local address to test the generated `dist/` files before deployment.

## 🧪 Checks and Tests

Run `npm run check` for lint, tests, and the production build. Use `npm run lint`, `npm test`, or `npm run test:watch` for focused checks. [GitHub Actions](.github/workflows/ci.yml) runs the same full check on pull requests and pushes to `main`.

For browser verification, test the built app as well as the development server:

- Check editing, Undo/Redo, exact completion, scoring, and both confirmation dialogs. Verify keyboard focus, Escape, and focus after closing.
- Check History across two tabs. Exercise reload, saves and clears, more than ten entries, unreadable storage, and preservation of a running attempt.
- Check both views and dialogs at 320, 768, and 1280 CSS pixels and actual 200% browser zoom. Include long passages, unavailable scores, and reduced motion. Verify physical input methods and screen-reader speech separately.

## 🗂️ Project Layout

- [`src/App.jsx`](src/App.jsx) wires together the views, passage choice, and saved results.
- [`src/components/`](src/components/) renders the interface. [`src/hooks/`](src/hooks/) handles attempts and navigation.
- [`src/lib/`](src/lib/) contains scoring, editing, selection, and storage logic. [`src/data/passages.js`](src/data/passages.js) holds the passage catalog.
- Tests sit beside the code they cover. [`src/styles.css`](src/styles.css) defines the layout and visual feedback.

## 🚀 Vercel Deployments

Production runs at [typesprint-chi.vercel.app](https://typesprint-chi.vercel.app). Vercel builds previews from GitHub branches and deploys `main` to production. Open the pull request preview and check GitHub Actions before merging. Protected previews require a signed-in Vercel account with project access.

| Setting | Value |
| --- | --- |
| Root Directory | Repository root |
| Framework Preset | Vite |
| Node.js Version | 24.x |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Output Directory | `dist` |

See [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite) and [Vercel for GitHub](https://vercel.com/docs/git/vercel-for-github) for platform details.
