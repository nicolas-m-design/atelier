# Changelog

> **Summary:** What changed in this repository, newest first, written for someone arriving with no context.

## 2026-10-01 — First milestone: a shared canvas workspace for Palier and Marvin

Nicolas asked for Palier's prototype canvas to be extracted into a shared local workspace with project switching, after reviewing a plan. Built as its own repository: Vite, React, TypeScript and Tailwind, with no backend.

**What exists.** A project rail; the selected project's scenario sidebar; a canvas ported from Palier's `ScenarioCanvas.tsx` (at Palier commit `5eda020`), with pan, zoom, fit, focus and keyboard controls. Each screen is the project's own page in an iframe. The board is laid out in source pixels, so 100% is a screen's real size, and frame dimensions come from the project's manifest instead of being fixed at 1280 × 720. Position, zoom and selection are saved per project in the browser. Previews load only near the viewport and only while the project answers.

**Canvas and preview input are separate.** A preview takes no pointer, wheel or keyboard input until it is entered (double-click, Enter, or its Interact control). Exit controls sit above the frame and in the bottom bar, outside the iframe; a click on the bare canvas and Escape (while the keyboard is in Atelier) also exit.

**Projects describe themselves.** Atelier's registry holds a name and an address. Groups, screens, routes and frame sizes come from `/atelier.json`, served by the project (`docs/connector.md`). Palier's manifest is derived from the data its own canvas reads. A temporary hand-copied manifest was used while that was being built and has been deleted. Marvin is registered with no address and shows an empty state; nothing was written to Marvin.

**Changes in Palier**, on branch `claude/atelier-connector` in the worktree `/Users/nico/Sites/palier-atelier`, not merged: the manifest route, a shared screen list for the canvas and the manifest, and a client check that hides scenario navigation when a page is framed. Palier's own canvas, product screens and unframed navigation are unchanged.

**What a newcomer would get wrong.**

- Palier on port 3100 does not serve the manifest until that branch is consolidated. `.env.local` (not committed) points Atelier at the worktree's preview on 3101 meanwhile.
- A cross-origin 404 and a stopped server look identical to `fetch`. `src/status.ts` sends a second, opaque request to tell "no manifest" from "not running"; removing it would merge the two states.
- Keys pressed inside an entered preview never reach Atelier. That is why two Exit controls are always on screen; do not rely on Escape alone.
- Run npm only where a `package.json` exists. `/Users/nico/Sites` has its own, and a stray install lands there (see below).

**Checks.** `npm run typecheck` and `npm test` (20 checks: camera maths, manifest validation, layout, frame retention, status, storage) pass. Browser checks against the worktree preview are listed in `TODOS.md`. Verified against Palier's production build only, not its dev server. Pinch behaviour over an entered preview was not exercised.

**An error during setup, and its repair.** The first dependency install ran before `package.json` existed here (an earlier step in the same command had failed), so npm installed into `/Users/nico/Sites`, which has its own `package.json` listing `@base-ui/react`. The added packages were removed again. Two differences from before remain there: `react`, `react-dom` and `scheduler` were updated to 19.3.0 / 0.28.0 within the range `@base-ui/react` accepts (their earlier versions were not recorded), and `@types/react` with `csstype` stayed installed as an optional peer. The lockfile there was rewritten accordingly.

Nothing was merged, pushed, published or deployed.
