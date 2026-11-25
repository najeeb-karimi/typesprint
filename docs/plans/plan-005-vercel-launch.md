# Plan 005 — Vercel Launch and Production Verification

## Summary

Launch TypeSprint on a stable Vercel URL. Verify a hosted preview before publishing, then connect the existing GitHub repository so branches receive previews and `main` deploys to production. The release is complete when the live app and the GitHub deployment workflow both pass verification.

Use the existing static Vite build, query-based Practice and History views, and browser storage. This plan covers deployment and release documentation. The generated Vercel domain is the public address.

## Phase 1 — Prepare the release candidate

- Confirm the release commit on `origin/main` and a passing GitHub Actions check for that commit. Run `npm ci` and `npm run check` with Node 24 locally.
- Serve `dist/` with `npm run preview`. Open `/`, `/?view=practice`, and `/?view=history` directly. Check the page title, description, favicon, and that the built JavaScript and CSS load. Fix confirmed release defects and rerun the checks before selecting the final commit.
- Export that commit with `git archive` into a clean temporary directory for the initial CLI deployments. Confirm the export contains only tracked public project files and excludes the private learning repository, scratch files, and local credentials.

**Done when** the exact candidate commit passes CI and the built app works in local preview.

## Phase 2 — Verify a hosted preview

- In the owner’s Vercel account, use `vercel link` from the release export to create and link the `typesprint` project. Set the root to the repository root, preset to Vite, Node to `24.x`, install command to `npm ci`, build command to `npm run build`, and output to `dist`. Leave environment variables empty. Use the owner’s existing preview access settings. [Vercel link](https://vercel.com/docs/cli/link) · [Build settings](https://vercel.com/docs/builds/configure-a-build) · [Node versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)
- Run `vercel deploy` for the preview. Record the candidate commit and deployment URL. Verify HTTPS, the direct query URLs, and successful asset loading. Diagnose build or access failures in Vercel before continuing. [Vercel deploy](https://vercel.com/docs/cli/deploy)
- In an isolated browser session, finish a passage, confirm one recent result and the eligible personal best, reload History, and verify both persist. Use a second tab on the same preview URL to verify refresh after a save or clear. Check that navigating away from a running attempt and back preserves the typed text. Run the two-tab check in Firefox as well, since the previous audit found a storage timing regression there.

**Done when** the hosted preview passes the checks and the owner can review the exact candidate before production.

## Phase 3 — Publish and connect GitHub

- After owner approval, deploy the same export with `vercel deploy --prod --skip-domain`. Check the resulting staged production URL, then promote that deployment with `vercel promote`. Use the stable project domain shown in Vercel for all public links. [Staged production and promotion](https://vercel.com/docs/deployments/promoting-a-deployment)
- On the stable URL, verify public access from a signed-out browser, direct Practice and History loads, one completed attempt, reload persistence, and confirmation cancellation and acceptance. Check keyboard focus, 320 CSS pixels, and actual 200% page zoom. In the same browser session, confirm the stable production origin starts independently of preview history.
- Connect `najeeb-karimi/typesprint` to the same Vercel project and set `main` as the production branch. Replace the README’s deferred deployment section with the verified live URL, build settings, and branch workflow. Use that documentation change as the pull request that proves GitHub Actions and the automatic Vercel preview both run. After owner-approved merge, confirm Vercel serves the resulting `main` commit at the stable URL and repeat a short live smoke test. [Vercel for GitHub](https://vercel.com/docs/git/vercel-for-github)

**Done when** the live URL passes verification and a GitHub pull request and merge have demonstrated both deployment paths.

## Phase 4 — Audit the entire plan

- Review each phase against the candidate commit, build logs, deployment URLs, GitHub checks, and browser results. If a check fails, fix the issue and repeat the affected checks. If a later release breaks the live site, restore the last verified production deployment before testing the fix. [Vercel rollback](https://vercel.com/docs/deployments/promoting-a-deployment#instant-rollback)
- Confirm the README points to the stable production URL and the live app still matches the checked commit. Keep the learning companion in `tmp/` for the separate learning passes. Remove `docs/plans/plan-005-vercel-launch.md` after the audit and retain `docs/plans/.gitkeep`. Report the live URL and verification results in chat.
