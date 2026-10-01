# TODOS

> **Summary:** Current handoff, remaining work and known limits for Atelier. The first milestone is built and verified locally; nothing is merged, pushed or published.

## Handoff note

*2026-10-01, Claude.* The first milestone is committed on `work/first-milestone` (`main` holds only the empty starting commit). Atelier runs on http://localhost:3200 with a project rail, scenario sidebar, canvas, per-project saved view, a select/interact split for previews, and live, not-running, no-manifest and empty project states.

Palier is connected through a manifest it serves itself. That change is **not in Palier's canonical checkout**: it is on the branch `claude/atelier-connector` in a separate worktree at `/Users/nico/Sites/palier-atelier`, based on `5eda020` (the tip of `codex/cal-sans-wordmark` when the work started). For verification that worktree was built and served on port 3101, and `.env.local` here points Palier at it. Port 3100 was not running at the time and was never touched.

Marvin was connected later the same day, on Nicolas's instruction: it now serves `/atelier.json` from its preview frame registry (added to Marvin from this session; Marvin is not a git repository, so that change is uncommitted files there), and is registered here at `http://localhost:3210`. Its four Overview frames show at 1440 × 900.

Marvin's UI library was added after that, also on Nicolas's instruction: Marvin now has a `/ui` page built from its own components and names it under `links` in its manifest. The work is uncommitted files in Marvin, like the manifest.

Linked pages now open inside Atelier, for both projects. With `links` in a manifest, the sidebar opens with a page switcher ("Screens", then each link), and a linked page fills the workspace under a bar with reload and open-in-a-new-tab. The canvas stays mounted underneath. Two changes outside this repository go with it: Marvin's link declares `width: 1280`, and Palier's library hides its own wordmark and page switcher when framed (one more commit on `claude/atelier-connector` in the worktree, rebuilt and served on 3101 for the check).

Checks run: `npm run typecheck` and `npm test` (23 checks) pass here. In the browser, against the worktree preview: a single click selects without reaching the preview; double-click or Enter enters; links and scrolling work inside an entered, scaled preview; all three exits work; switching projects and reloading restore each project's position, zoom and selection; stopping the Palier preview shows the not-running state and restarting it recovers without a reload; at 100% after a reload one of five previews loads, at 49% three or four, with everything visible all five.

## Remaining work

| Id | Task | Status | Notes |
| --- | --- | --- | --- |
| `palier-consolidation` | Bring Palier's connector branch into its canonical line | waiting on Nicolas | Until then 3100 reports "No manifest". Afterwards delete `VITE_ORIGIN_PALIER` from `.env.local`, the `palier-connector-preview` launch entry, and the worktree. The branch touches `TODOS.md` and `CHANGELOG.md` in Palier, which the active session there also edits: expect small text conflicts. |
| `dev-server-first-load` | Smooth the first load of a preview from a development server | noted | A frame can show unstyled for a moment while the project's dev server compiles its styles. Seen once with Marvin; it settles by itself. A production build does not do this. |
| `palier-dev-server` | Check previews against Palier's dev server | open | Palier was verified against a production build only. Marvin's `next dev` works embedded, so Palier's should too; not exercised. |
| `page-keys` | Keyboard and focus when a linked page is open | noted | Keys pressed inside a linked page stay there, as with an entered preview. Atelier does not move focus into the page when it opens. |
| `preview-keys` | Let Escape leave a preview from inside it, and show a preview's current route | deferred | Needs a small script in the project that posts messages to Atelier. An addition to the connector contract. |
| `preview-pinch` | Keep pinch zoom on the canvas over an entered preview | deferred | Same mechanism as `preview-keys`. The browser's own page zoom in that case was not exercised. |
| `thumbnails` | Lighter previews for large projects | deferred | Every preview is a full page. Fine at Palier's five; revisit when a project passes about a dozen screens. |
| `palier-canvas-future` | Decide what happens to Palier's built-in canvas | open question for Nicolas | It stays as Palier's standalone and public entry for now, so improvements made here do not reach it. |

## Completed

| Id | Task | Status | Notes |
| --- | --- | --- | --- |
| `library-view` | Show a project's UI library inside Atelier | done (2026-10-01) | Page switcher at the top of the sidebar and a page view over the canvas. The nesting worry is settled by the contract: a framed page keeps its own section list and hides its prototype-level navigation. Not exercised: a manifest with several links, and a narrow Atelier window against Palier's library. |
| `marvin-library` | Add Marvin's UI library | done (2026-10-01) | Built in Marvin at `/ui` and listed in its manifest. Marvin's plan had deferred the library until a second surface existed, and Nicolas asked for it now. |
| `marvin-connection` | Connect Marvin | done (2026-10-01) | Manifest route added in Marvin; registered at port 3210. Marvin's own documents had already withdrawn the plan to copy Palier's canvas, so no plan note was needed. |
| `first-milestone` | Workspace shell, canvas, persistence, interaction mode, project states | done on `work/first-milestone` (2026-10-01) | Canvas mechanics ported from Palier's `ScenarioCanvas.tsx` at `5eda020`; board units changed to source pixels and frame sizes taken from the manifest. |
| `palier-connector` | Palier serves a derived manifest and hides scenario navigation when framed | done on Palier branch `claude/atelier-connector` (2026-10-01); not merged | Tests there: 158 pass, plus the one suite that already failed before the change. |
| `temporary-manifest` | Remove the hand-copied Palier manifest | done (2026-10-01) | Used only until the live manifest worked. |
