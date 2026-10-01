# Changelog

> **Summary:** What changed in this repository, newest first, written for someone arriving with no context.

## 2026-10-02 — Local branches in the sidebar

Nicolas asked for a simple way to see a project's current branches in Atelier. The plan was reviewed by a second agent before building; the review removed ahead/behind counts and the uncommitted-changes mark, and added the access rule below.

- **Sidebar.** A collapsible "Local branches" section at the foot of the sidebar. Each row gives the branch name, the age of its last commit and the commit's subject; a branch that is checked out carries a folder mark and the folder's name. `main` comes first, the rest by last commit. A checkout on no branch gets its own "Detached at …" row. Whether the section is open is remembered in this browser, for all projects.
- **Where the data comes from.** A browser cannot read git, so Atelier's dev server does: `server/branches.ts` adds `/__atelier/branches/<project id>` to Vite. It runs `git for-each-ref` and `git worktree list` in the folder the registry names, with a 3-second limit, and nothing that writes or scans a working folder.
- **Who may ask.** Only Atelier's own page. The endpoint refuses any request whose `Sec-Fetch-Site` header is not `same-origin` before git runs, and the address takes a registered id, never a folder. The dev server also no longer sends cross-origin headers at all (`cors: false`); before, any page on another localhost port could read Atelier's files.
- **Registry.** The plain list moved to `src/registry.ts` so the dev server can read it, and each project gained a `repo` folder. `src/projects.ts` still applies the `.env.local` address overrides for the browser.

No change to the connector contract, and nothing was changed in Palier or Marvin.

**Checks.** `npm run typecheck` and `npm test` (34 checks; 11 new) pass. In the browser, on a second copy of the dev server on port 3201 (another session held 3200): Palier listed its five branches with `palier` and `palier-atelier` marked on the two checked-out ones; Marvin showed "Marvin is not a Git repository"; closing the section survived a reload and made no request while closed; regaining focus read the list again; with a linked page open the section stays at the foot. A fetch from a Marvin page on port 3210 could not read the endpoint. With curl: no header, a cross-site header, POST, an unknown id and a path with `..` were all refused.

**What a newcomer would get wrong.**

- The list is about the repository, not the preview. A folder mark means the branch is checked out there, not that the canvas shows it. `.env.local` can point a project at a worktree's server while the registry names the main folder.
- Opening the endpoint's address directly in a browser tab, or with curl, answers 403. That is the access rule, not a fault.
- An address under `/__atelier/` that does not exist answers 200 with Atelier's own page, because Vite serves that for any unknown address. The browser side therefore checks the content type, not the status.
- The endpoint exists only under `npm run dev`. A built Atelier shows "Not available" in the section.
- Files reachable from `vite.config.ts` import each other with the `.ts` extension. Vite warns otherwise.
- `GIT_CEILING_DIRECTORIES` keeps git inside the named folder. Without it, a project folder that is not a repository would list the branches of any repository above it.

## 2026-10-01 — Reload all previews

Nicolas asked for one control in the sidebar header that refreshes every design at once. Until now each preview and each linked page had only its own reload.

- **Sidebar header.** A reload control sits beside the sidebar toggle. It reloads every loaded preview of the selected project, and the linked page if one is open, from their manifest routes, and asks for a fresh project check so a changed manifest is picked up too.
- **How.** `Workspace` keeps a count (`reloads`) and passes it to `Canvas`, `Frame` and `Page`, where it joins each one's own reload count in the iframe's key.

**Checks.** `npm run typecheck` and `npm test` (23 checks, unchanged) pass. In the browser: on Palier all five previews were replaced and loaded again; on Marvin all four previews and the open library were; canvas position, zoom and selection stayed as they were.

**What a newcomer would get wrong.**

- The control shows only while the project is live. Otherwise there is nothing to reload, the status card already offers "Check again", and the longer status lines ("Not running · …") need the width.
- It lives in the sidebar, so it is not reachable while the sidebar is hidden.
- Previews far from the viewport are not loaded in the first place, so they are not reloaded; they load fresh when they come near.
- A preview that is entered is reloaded with the rest and returns to its starting route.

## 2026-10-01 — Linked pages open inside Atelier

Nicolas asked for the UI library to sit in the sidebar the way Palier's own canvas has it, for both projects. Until now a manifest's `links` were new-tab links at the bottom of the sidebar.

- **Sidebar.** When a manifest has `links`, a page switcher sits under the project header: "Screens" for the canvas, then one entry per link, styled after Palier's "Scénarios / Bibliothèque UI" pair. The screen list hides while a page is open, because the page brings its own navigation.
- **Page view** (`src/components/Page.tsx`). The linked page fills the workspace in a frame, always interactive, under a 48 px bar with its title, reload and open-in-a-new-tab. When the sidebar is hidden, its toggle moves into that bar so nothing of Atelier's is drawn over the page.
- **Contract** (`docs/connector.md`, "Linked pages"). `links[].width` is new and optional: the narrowest width a page is designed for. With less room Atelier lays the page out at that width and scales it down (`fitPage` in `src/camera.ts`). A framed page keeps its own section list and hides its prototype-level navigation.
- **Saved state.** Each project remembers its open page (`page` in `src/storage.ts`). A saved page the project no longer lists falls back to the canvas.
- **In Marvin:** the library link declares `width: 1280`, its product minimum. **In Palier** (branch `claude/atelier-connector`, worktree only): the library hides its wordmark and page switcher when framed, with the existing `data-embedded` check.

**Checks.** `npm run typecheck` and `npm test` pass (23 checks; new ones cover link width validation, the saved page and page fitting). In the browser at 1440 × 900: Marvin's library opens scaled to 0.8875 in the 1136 px beside the sidebar and unscaled at 1384 px with the sidebar hidden; a section link inside it scrolls it; the open page survives a reload; "Screens" returns to the canvas with its five Palier previews still mounted. Palier's library opens with only its section list. Palier was checked against a fresh production build of the worktree on 3101.

**What a newcomer would get wrong.**

- The canvas is not unmounted when a page opens. It sits underneath, `inert`, so its previews keep running and its position is untouched. Unmounting it would reload every preview on return.
- "Screens" is Atelier's word. Palier's own canvas says "Scénarios"; Marvin's groups are product destinations, so the neutral word is used for both.
- After a reload the page area is empty for a moment: a page loads only once the project's manifest check has answered.
- Palier's canonical checkout on 3100 still shows its own switcher if framed, because the hiding rule is on the connector branch.

**Not done.** A manifest with more than one link was not exercised. Nothing was merged or pushed.

## 2026-10-01 — Marvin's UI library

Nicolas asked how to add the UI library now that Marvin is connected, then asked for it to be built. Atelier holds no project content, so the whole change is in Marvin; this repository's code is unchanged.

- **In Marvin** (still not a git repository, so uncommitted files there): a `/ui` page showing its colour tokens, type sizes, logotype, robot form, map markers, status glyphs and the five Overview components, each rendered by the product's own code from its fixture. Its manifest now lists `{ id: "library", title: "UI library", route: "/ui" }` under `links`. Three small exports were added to two product components; nothing in the product's markup or behaviour changed. Details are in Marvin's own changelog.
- **Here:** documentation only.

**Checks.** Marvin: TypeScript clean, 34 tests pass (31 before). In the browser at 1440 × 900 and 1280 × 800 the library renders with no console errors on a clean load, and selection carries across its examples. In Atelier, Marvin's sidebar shows "UI library" linking to `http://localhost:3210/ui`. Here: `npm run typecheck` and `npm test` (20 checks) pass.

**What a newcomer would get wrong.**

- A project's library appears in Atelier only because its manifest names it under `links`. There is nothing to register here, and the link is hidden while the project is not live.
- At this point the library opened in a new tab. The entry above replaces that.
- Marvin's development server on 3210 was already running and was not restarted. Atelier's own server on 3200 was not running and was started for the check.

## 2026-10-01 — Connect Marvin

Nicolas asked for Marvin's UI to be added now that its shell and Overview exist. Marvin already had four product-only preview frames at `/preview/<id>` and a document anticipating a manifest route; it lacked the manifest itself.

- **In Marvin** (not a git repository, so these are uncommitted files there): `/atelier.json`, derived from its preview frame registry and its list of built destinations, with four tests comparing the two. No product screen changed. Its development server on port 3210 was already running and was not restarted.
- **Here:** Marvin's registry entry now has the address `http://localhost:3210` and a start command.

**Checks.** Marvin: TypeScript clean, 31 tests pass (27 before). In the browser: Marvin shows as live with one group and four frames at 1440 × 900 beside Palier's 1280 × 720 frames; frames near the viewport load and the others wait; entering a frame and clicking an attention item changes its selection. This is also the first check against a development server rather than a production build. One frame appeared unstyled for a moment on first load while the dev server compiled, then settled.

**What a newcomer would get wrong.** No project is in the empty state any more, but the state and its message remain for the next project registered without an address.

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
