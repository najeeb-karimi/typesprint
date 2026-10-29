# TypeSprint

A focused typing game built with React, JavaScript, Vite, and plain CSS. Practice one passage at your own pace, correct mistakes, and restart whenever you like.

## Current features

- One fixed English passage with feedback for correct, incorrect, and remaining characters.
- Underlined mistakes, visible incorrect spaces, and a marker for the next unentered character.
- Entered-character progress and current mistake counts.
- Elapsed time from the first character, with frozen time, speed, and historical accuracy results on completion.
- Native text editing, selection, Backspace, Delete, Cut, Undo, and Redo; paste and text drops are blocked.
- Exact-match completion that leaves the finished text read-only; Restart clears the attempt and returns focus to the typing field.
- Responsive layout, labeled controls, visible keyboard focus, and restrained status announcements.

Practice has no time limit. The clock starts with the first text entry and continues through pauses and time away. Speed uses five passage characters per word; accuracy includes corrected mistakes. Results are not saved, and there are no accounts or random passages. Progress measures entered text; a full progress bar does not mean completion while mistakes remain.

## Prerequisites

- Node.js 24.x and npm. The required Node major version is also recorded in `.nvmrc`.
- A modern browser.

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
| `npm test` | Run comparison and component-interaction tests once, then exit. |
| `npm run test:watch` | Rerun relevant tests while editing in an interactive terminal. |
| `npm run build` | Create the production files in `dist/`. |

Vitest checks calculation rules directly. React Testing Library and user-event check typing, correction, completion, blocked paste, and repeated restarts in jsdom's simulated document. These tests do not replace real-browser checks for layout, native editing, keyboard focus, zoom, or screen-reader behavior.

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
src/App.jsx                           Page shell and fixed practice passage
src/components/PracticeSession.jsx    Input state, controls, status, and Restart
src/components/PassageDisplay.jsx     Accessible passage and visual feedback
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
