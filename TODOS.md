# TODOS

> **Summary:** Current handoff, remaining work and known limits for Atelier. The first milestone is built and verified locally; nothing is merged, pushed or published.

## Handoff note

*2026-10-01, Claude.* The first milestone is committed on `work/first-milestone` (`main` holds only the empty starting commit). Atelier runs on http://localhost:3200 with a project rail, scenario sidebar, canvas, per-project saved view, a select/interact split for previews, and live, not-running, no-manifest and empty project states.

Palier is connected through a manifest it serves itself. That change is **not in Palier's canonical checkout**: it is on the branch `claude/atelier-connector` in a separate worktree at `/Users/nico/Sites/palier-atelier`, based on `5eda020` (the tip of `codex/cal-sans-wordmark` when the work started). For verification that worktree was built and served on port 3101, and `.env.local` here points Palier at it. Port 3100 was not running at the time and was never touched.

Marvin is registered without an address and shows the empty state. Nothing was written to Marvin. `docs/connector.md` is the contract for its session to adopt.

Checks run: `npm run typecheck` and `npm test` (20 checks) pass here. In the browser, against the worktree preview: a single click selects without reaching the preview; double-click or Enter enters; links and scrolling work inside an entered, scaled preview; all three exits work; switching projects and reloading restore each project's position, zoom and selection; stopping the Palier preview shows the not-running state and restarting it recovers without a reload; at 100% after a reload one of five previews loads, at 49% three or four, with everything visible all five.

## Remaining work

| Id | Task | Status | Notes |
| --- | --- | --- | --- |
| `palier-consolidation` | Bring Palier's connector branch into its canonical line | waiting on Nicolas | Until then 3100 reports "No manifest". Afterwards delete `VITE_ORIGIN_PALIER` from `.env.local`, the `palier-connector-preview` launch entry, and the worktree. The branch touches `TODOS.md` and `CHANGELOG.md` in Palier, which the active session there also edits: expect small text conflicts. |
| `marvin-connection` | Connect Marvin when its app exists | waiting on the Marvin session | It serves `/atelier.json` and product-only preview routes (`docs/connector.md`); then set its `origin` in `src/projects.ts`. Its frames are planned at 1440 × 900, which the layout already supports per screen. |
| `marvin-plan-note` | Tell Marvin's plan that Atelier replaces copying the canvas | open; needs authorisation to edit Marvin | `docs/implementation.md` there still describes adapting Palier's canvas locally. |
| `palier-dev-server` | Check previews against Palier's dev server | open | Verified against a production build (`next start`) only. `next dev` allows `localhost` origins by default, so it should work; not exercised. |
| `preview-keys` | Let Escape leave a preview from inside it, and show a preview's current route | deferred | Needs a small script in the project that posts messages to Atelier. An addition to the connector contract. |
| `preview-pinch` | Keep pinch zoom on the canvas over an entered preview | deferred | Same mechanism as `preview-keys`. The browser's own page zoom in that case was not exercised. |
| `thumbnails` | Lighter previews for large projects | deferred | Every preview is a full page. Fine at Palier's five; revisit when a project passes about a dozen screens. |
| `palier-canvas-future` | Decide what happens to Palier's built-in canvas | open question for Nicolas | It stays as Palier's standalone and public entry for now, so improvements made here do not reach it. |
| `library-view` | Show a project's UI library inside Atelier | deferred | It is a new-tab link today. Palier's `/ui` has its own sidebar, which would nest. |

## Completed

| Id | Task | Status | Notes |
| --- | --- | --- | --- |
| `first-milestone` | Workspace shell, canvas, persistence, interaction mode, project states | done on `work/first-milestone` (2026-10-01) | Canvas mechanics ported from Palier's `ScenarioCanvas.tsx` at `5eda020`; board units changed to source pixels and frame sizes taken from the manifest. |
| `palier-connector` | Palier serves a derived manifest and hides scenario navigation when framed | done on Palier branch `claude/atelier-connector` (2026-10-01); not merged | Tests there: 158 pass, plus the one suite that already failed before the change. |
| `temporary-manifest` | Remove the hand-copied Palier manifest | done (2026-10-01) | Used only until the live manifest worked. |
