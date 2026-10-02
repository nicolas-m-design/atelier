# Changelog

> **Summary:** What changed in this repository, newest first, written for someone arriving with no context.

## 2026-10-02 — Palier's wording follows the new rule; its canvas removal is in its `main`

Nicolas asked for Palier's decisions log to match the rule below. That was done in Palier, on its branch `work/contract-wording` (`d139596`), in a separate worktree: its `docs/decisions.md` and README no longer call the top-edge bar an exception. Here, only `TODOS.md` changed, to say so.

**What a newcomer would get wrong.** That Palier branch is not merged, so Palier's `main` still says "a deliberate exception". Separately, Palier's canvas removal is now in its `main`, so the sentences in `docs/connector.md` and the README that say "until that branch is in Palier's `main`" are out of date; removing them is `palier-docs-after-merge` in `TODOS.md`, not done in this session. On a device without hover, Palier's bar is always visible, which "Product only at rest" does not allow inside a frame; it is noted in Palier as `framed-bar-touch`.

**Checks.** None run: one document.

## 2026-10-02 — The preview rule becomes "Product only at rest"

Nicolas asked for the contract's rule to allow navigation that is hidden at rest, instead of listing Palier's top-edge bar as an exception to it. `docs/connector.md` only; no code reads this rule, and the manifest is unchanged.

- **The rule.** A framed preview that nothing is pointing at or focused in shows the product and nothing else. A project keeps to it either by hiding its prototype navigation when framed, as before, or by keeping navigation between its own screens out of sight until the pointer reaches it or the keyboard focuses it. Palier's scenario bar is the example of the second way.
- **What is still not allowed in a framed preview:** anything visible at rest, such as a banner, and a link back to the project's own canvas.

**What a newcomer would get wrong.** The entry below, "The documents follow the removal of Palier's built-in canvas", says the rule did not change and that Palier's bar is an exception; this entry replaces that. The guide says the bar cannot appear on a preview that is only shown or selected. That rests on `src/components/Frame.tsx`, which keeps a preview `inert` and without pointer events until it is entered; the bar itself was not looked at in a browser from this session. Palier's `docs/decisions.md` still words its bar as an exception to this contract, and was not edited from here.

**Checks.** `npm run typecheck` and `npm test` (62 checks) pass.

## 2026-10-02 — The `agent-atelier` command and the package build (package plan, step 2)

Nicolas asked for step 2 of `docs/package-plan.md`. Atelier could only be run from its source, through Vite. It can now be packed, installed in another folder and started there.

- **`agent-atelier`** serves the built page and Atelier's endpoints with Node's own modules (`server/serve.ts`, `server/cli.ts`). Port 3200, as under `npm run dev`; it fails with an explanation when the port is taken, and `--port` starts a second copy. It listens on both loopback addresses of this machine and on nothing else.
- **`agent-atelier add [folder]`** appends a project to the list, with `--origin` and `--start`. It is the only thing that writes the file. It does nothing for a folder already listed, and refuses to touch a file it cannot read or to store an entry that would not work.
- **`--origin <id>=<address>`** shows a listed project elsewhere for one run. `VITE_ORIGIN_<ID>` still does that under `npm run dev`; both now go through one function, and an override that is not an address is reported instead of breaking the page.
- **A folder is shown without being listed** when the command is run in it and its `package.json` has `agent-atelier` among its dependencies or an `atelier` field.
- **A request must name the server as `localhost`, `127.0.0.1` or `[::1]`**, with its port. Otherwise a site whose name was pointed at this machine would count as Atelier's own page and could read the project list. Vite does the same for the dev server.
- **The build**: `npm run build` empties `dist`, puts the page in `dist/app` (Vite) and the command in `dist/server` and `dist/src` (`tsconfig.build.json`). `npm pack` runs it first. `package.json` gains `bin`, `files` and `engines`; React, Lucide and Inter moved to development dependencies, because the page is prebuilt, so the package installs nothing else.
- **`README.md` names no project and no local folder any more**, because npm always packs it. The table of projects, the Palier notes and the `.env.local` leftover are in the new `docs/local-setup.md`.

**What a newcomer would get wrong.** The command is `agent-atelier`, never `atelier`. The packaged command does not read `.env.local`, so the leftover `VITE_ORIGIN_PALIER` line affects `npm run dev` only: the two can show Palier at different addresses until that line is deleted. `dist` used to hold the page at its top level; it is now under `dist/app`, and a stale `dist` from before would have been packed, which is why the build empties it. The tarball in the folder is not committed and goes stale with the next change to the code: pack again before installing it anywhere. `"private": true` is still set, so `npm publish` refuses; nothing is published. The plan said an unlisted folder "runs with that one project"; it is added to the listed ones instead, and only when it shows one of the two signs above.

**A bug the tests had missed.** `add` first stored the command's own `"run": "add"` field in the list, because the whole command object was handed over. Running the installed command showed it; the entry is now built from the folder, address and start command only, and a test covers it.

**Checks.** `npm run typecheck` passes; `npm test`: 62 pass (46 before, 16 new), three of them through a real local connection. `npm pack`, then, by an agent, the tarball installed in an empty folder outside the repository (one package added, no dependency): `--version`, `--help` and a wrong argument answer as intended; the command started on 3200 on both loopback addresses, and a second copy refused with the explanation; in the in-app Chromium browser the page loaded, Palier and Marvin were live with their previews, Palier's branch list loaded, and the empty folder itself appeared as a third project without an address. By direct request: the endpoints refuse a request without the browser's same-origin mark, a request naming another host, and two attempts to reach a file outside the page. `add` against a scratch list: created the file, did nothing the second time, refused a folder without `package.json` and a broken file, and left the real list untouched. `--port` with `--origin`: the override applied, and an `--origin` for an unknown id was reported. The tarball was unpacked and searched: no `/Users/`, no project name, no personal name, no project address. The dev server was started once on another port after the change and answered the list and the branches. Every server started for these checks was stopped. Not seen: the cases in `command-not-exercised`.

## 2026-10-02 — The project list leaves the code (package plan, step 1)

Nicolas asked for step 1 of `docs/package-plan.md`. Until now the projects were a constant in `src/registry.ts`, compiled into the page with their names and folders on his machine. A package cannot ship that.

- **The list is a file on the machine**: `~/.config/agent-atelier/projects.json`, or the file named by `ATELIER_PROJECTS`. An entry is a project's folder, or an object naming it with `origin`, `start`, `id` and `name`; what it leaves out comes from the folder's `package.json` (its `name`, and an `atelier` field). `server/projects.ts` reads it and never writes.
- **The page asks for it** at `/__atelier/projects` (`src/useProjects.ts`), once, when it opens. With no usable project it shows where the file is, an example, and why each entry was skipped (`src/components/NoProjects.tsx`).
- **The server code no longer depends on Vite.** `server/handler.ts` answers the project list and the branch list for Atelier's own page only, as before; `server/vite.ts` is the few lines that mount it on the dev server. `server/branches.ts` keeps only git.
- **Address overrides (`VITE_ORIGIN_<ID>`) are applied by the server**, which gets them from Vite. Behaviour is the same, with one addition: a hyphen in an id becomes an underscore in the name.
- **`src/registry.ts` is deleted.** `AGENTS.md` gains the rule that no project goes into the code, and no longer lists an installer as out of scope; the README and `docs/connector.md` describe the file.
- **Outside this repository**: the file `~/.config/agent-atelier/projects.json` was created on Nicolas's machine with Palier and Marvin. Neither project was touched.

**What a newcomer would get wrong.** A fresh clone shows "No projects yet" until that file exists; the page says where. The plan had the machine's file hold folders only, with each project describing itself in its `package.json`. Entries that carry their own `origin` and `start` were added so that this step needed no change in Palier or Marvin; neither has the `atelier` field. The page reads the list once, so reload after editing the file. A built copy of Atelier (`npm run build`) has no server behind it and says the project list is not available, as it already did for branches; step 2 fixes that. Comments in `src/layout.ts` and `src/components/Canvas.tsx` still mention Palier as where a few sizes came from; they are not the list. The leftover `VITE_ORIGIN_PALIER` line in `.env.local` still points Palier at port 3101.

**Checks.** `npm run typecheck` passes; `npm test`: 46 pass (34 before, 12 new, for the file, the page's validation, the overrides and the endpoints). By an agent in the in-app Chromium browser, against a temporary dev server on port 3201 reading the real file: both projects appear in the rail; Marvin is live and its previews load; Palier's branch list loads, although Palier itself shows as not running because of the leftover override, so Palier was not seen live; the endpoint returns the overridden address without folder or command, as before. Against a second temporary server on port 3202 pointed at a faulty list: the "No projects yet" card shows the file, the example and the reason. Both servers were stopped afterwards. Not seen: the "not available" card of a built copy, a list that mixes usable and unusable entries, a project described by its own `package.json` (tests only), and Atelier on its usual port 3200.

## 2026-10-02 — The documents follow the removal of Palier's built-in canvas

Nicolas had Palier's own canvas removed, in Palier, and asked for the documents here to be corrected now instead of after that work is merged. Documents only; no code and no change to the contract's fields.

- **`docs/connector.md`**: Palier's manifest is derived from `src/components/scenarios/screens.ts` and `atelier.ts`, the list its entry redirect also reads, no longer "its own canvas". Palier is no longer the example of hiding scenario navigation in a framed preview. Its scenario pages keep their top-edge bar when framed, recorded under "Product only" as one exception decided by Nicolas. The frame check (`data-embedded`) is now described where it is still used, in Palier's UI library.
- **README**: Palier no longer keeps a canvas of its own.
- **`docs/package-plan.md`**: Palier's connector paths.
- **`TODOS.md`**: `palier-canvas-future` is answered (removed); `palier-docs-after-merge` is new.

**What a newcomer would get wrong.** These documents describe Palier's branch `work/atelier-name-restored` (read at `c106169`), not its `main`. Port 3100 still serves the canvas at `/`, hides the bar inside frames and has the files under `src/components/canvas/` until that branch is merged; the connector guide's summary and the README each carry one sentence saying so, to be removed then. The "Product only" rule did not change: a new project must still hide its prototype navigation when framed, and Palier's bar is an exception because it is out of sight at rest. Atelier's own rule, that nothing Atelier draws appears inside a frame, is untouched, since the bar is Palier's.

**Checks.** `npm test`: 34 pass. `npm run typecheck` reported three errors in `src/App.tsx`, all from another session's uncommitted work in this folder at the time (`src/projects.ts` changed, `server/projects.ts` and `server/request.ts` new); this commit holds documents only and leaves those files alone. Palier's branch was read, not run: the bar inside a frame was not looked at in a browser from this session.

## 2026-10-02 — The package is `agent-atelier`; a rename to Canvagent was made and undone

Nicolas looked for a package name closer to AI. He first chose Canvagent, and Claude renamed everything here to it, moved the folder to `/Users/nico/Sites/canvagent`, moved the manifest to `/canvagent.json` and added a bridge that still read the old names (commits `9c99e9f`, `e3f6f50`). An hour later he chose **Agent Atelier** instead: "Atelier" for short, package and command `agent-atelier`, folder `atelier`.

- **The Canvagent rename is reverted in full**: code, tests, interface text, endpoint, launch entry and documents are as they were at `1881110`. The bridge is gone because nothing needs it.
- **The folder is `/Users/nico/Sites/atelier` again.**
- **The package name is `agent-atelier`** in `package.json` and `package-lock.json`. That is the only code-level difference from before the rename.
- **`docs/package-plan.md` is rewritten for the name**: `npm install -D agent-atelier`, `npx agent-atelier`, and what the name is up against.

**What a newcomer would get wrong.** The command is `agent-atelier`, never `atelier`: an unrelated npm package owns `atelier` and its command, and `npx atelier` would run that. The contract did not change, so Marvin and Palier's `main` need nothing. Palier's branch `work/remove-canvas` was started from the Canvagent rename and serves `/canvagent.json`; see `palier-manifest-name` in `TODOS.md`. "Canvagent" and "Agentroom" were rejected: the first begins with another design tool's trademark, the second is used by several live products and its hyphenated form is taken on npm. A browser that opened the workspace during the Canvagent hour keeps an unused `canvagent:v1` storage entry.

**Checks.** `npm run typecheck` passes; `npm test`: 34 pass, the count before the rename. The staged tree was compared with `1881110` before the package name and documents were edited, and matched. Not opened in a browser afterwards: the dev server was not running.

## 2026-10-02 — A plan for an installable package

Nicolas asked, from a Palier session, for a plan to make Atelier an `npm install`, as Agentation is. Claude wrote `docs/package-plan.md`: one package holding the connector a project imports and an `atelier` command that serves the workspace, with the project list read when it starts.

**What a newcomer would get wrong.** It is a plan; no code changed. `AGENTS.md` and the README still list an installer and a connector package as out of scope, and the plan's first step is to change those lines once Nicolas has settled the name, the distribution and the licence. The name `atelier` is taken on npm. Publishing is a separate, explicit decision.

**Checks.** None run: documents only.

## 2026-10-02 — Palier's connector is consolidated; the 3101 preview is gone

Nicolas had every Palier branch merged into Palier's `main`, from a session working in Palier. The connector branch (`claude/atelier-connector`) is part of that, so Palier's own server on port 3100 now serves `/atelier.json`. The worktree at `/Users/nico/Sites/palier-atelier` was removed, and the preview served from it on port 3101 was stopped first.

In this repository: the `palier-connector-preview` entry is removed from `.claude/launch.json`, and the README's interim instructions are replaced.

**What a newcomer would get wrong.** `.env.local` may still point Palier at port 3101. That session could not edit the file, so the line `VITE_ORIGIN_PALIER=http://localhost:3101` is Nicolas's to delete; until then Atelier shows Palier as not running even while 3100 is up. Palier now has one branch, so the "Local branches" list shows one. The sample data in `tests/branches.test.ts` still names the old branches and worktree; it is fixed test input, not a reading of the real repository.

**Checks.** `npm run typecheck` and `npm test` here. Atelier itself was not re-checked against port 3100 because of the leftover override.

## 2026-10-02 — Disable interface text selection

Text in Atelier's sidebar, controls and canvas labels can no longer be selected accidentally. The document-level CSS includes Safari support and preserves selection in editable fields. The start-command text follows the same rule; its Copy button remains available.

This does not affect project previews or linked pages: each iframe has its own document and styles. No connector change is needed.

**Checks.** `npm run typecheck` and `npm test` pass (34 tests). Browser interaction was not exercised.

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
