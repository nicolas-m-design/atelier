# Changelog

> **Summary:** What changed in this repository, newest first, written for someone arriving with no context.

## 2026-10-05 — Safari canvas gesture handling

Nicolas authorized implementation with installed Node and quit-on-close. `src/canvasInput.ts` now handles WebKit's cumulative gesture scale through the existing camera math, while retaining modified-wheel zoom and normal pan. It suppresses accompanying wheel input during a gesture and removes handlers on cleanup. Preview iframe input remains separate.

Typecheck and all 67 tests pass, including four new input tests. The current workspace renders in Safari. Physical pinch remains a manual check; synthetic event tests do not establish trackpad feel. No build, package or server code changed in this increment.

## 2026-10-05 — Mac plan simplified after Opus review

Nicolas relayed Claude Opus's "approve with changes" review. Revised `docs/macos-app-plan.md` to retain the existing Node backend as an owned helper, loaded through real HTTP localhost on a separate stable app port. Removed the native service port, script-message bridge, native state file and frontend transport fork. The sequence is now a shared Safari gesture fix/baseline followed by the minimal working app, with performance and accessibility checked within those increments.

**What a newcomer would get wrong.** Opus's cookie/storage/Fetch Metadata observations came from its scratchpad probe; they were not independently reproduced here and do not prove all sign-in flows or bundled-app behavior. Physical Safari pinch, immediate-quit storage durability and helper cleanup still require testing. The bundle needs imported `dist/src` modules and ESM metadata as well as `dist/server`/`dist/app`. Finder launch cannot assume terminal PATH, and an occupied app port must never cause another server to be adopted or stopped. Installed Node and quit-on-close remain proposed decisions awaiting Nicolas. The initial plan's historical entry below is superseded, and this revision has not had a second Opus review.

Only documentation changed; no app, gesture fix or neighbouring-project changes were made. `npm run typecheck` passes; `npm test`: all 63 tests pass across 6 files. `git diff --check` is clean. No tarball test was needed for this documentation-only revision.

## 2026-10-05 — Mac app plan prepared for Claude Opus review

Nicolas asked for a lightweight Mac app around the current UI, with performance and simplicity as the priorities and no marketing/product expansion. He confirmed that it is for his Mac only for now and must open without first starting Atelier in a terminal.

- Added `docs/macos-app-plan.md`: source-based architecture assessment, current Apple guidance including WWDC26, three linked first-person builder reports, comparison of native WebKit/Tauri/Node/Electron options, window behavior, technical boundaries, proposed performance budgets, implementation gates and an Opus review request.
- Recommended a small Swift/AppKit host with the existing React UI in WKWebView, pending a compatibility prototype. Registry and Git semantics need parity with the existing implementation; project servers remain independently operated.
- Updated `TODOS.md` with the review handoff. No runtime code, package configuration, connector contract or neighbouring repository changed.

**What a newcomer would get wrong.** This is a proposal, not a built app or a completed Opus review. WebKit compatibility and performance are unmeasured. A custom bundled asset origin must be proven against HTTP previews and the existing contract's `localhost:3200` framing requirement before the native services are built. The app's saved state would initially be separate from browser state. The npm connector plan is still separate.

**Checks.** `npm run typecheck` passes; `npm test`: 63 tests pass across 6 files. Documentation-only work did not require another tarball test. Atelier was not answering on port 3200 during research, so no live UI verification is claimed.

## 2026-10-05 — Krux is listed and connected, from a branch of its repository

Nicolas asked for Krux to be added. Krux is the studio's website, a Next static site whose repository is `/Users/nico/Sites/design-agency` (the folder is not named after it). No code changed here.

- **On the machine:** `agent-atelier add` appended Krux to the list, at `http://localhost:3220`, with the start command `npm --prefix web run dev -- --port 3220`. Its id and name come from that repository's `package.json`.
- **In Krux's repository**, on the branch `claude/atelier-connector-2026-10-05` in the worktree `/Users/nico/Worktrees/krux/atelier-connector`, pushed and not merged: its dev server serves `/atelier.json`, built from its page files, with each page at 1440 × 900 and 390 × 844. Inside a frame its annotation toolbar is not rendered and Next's dev indicator is hidden. The manifest exists under `next dev` only; a production build exports nothing new, so nothing reaches the public site.
- **Here:** `.claude/launch.json` has `krux-dev`, which starts that worktree's dev server on port 3220. `docs/local-setup.md` and `TODOS.md` say what is above.

**What a newcomer would get wrong.**

- Krux shows its screens only when port 3220 is served from a checkout that has the connector. Until the branch is in Krux's `main`, that is the one worktree. Started from any other checkout, Krux shows as "No manifest".
- Krux has its own port on purpose. Its dev server defaults to 3000, where Yutugy is listed; on 3000 Atelier would show Krux's screens under Yutugy's name.
- Krux's previews are not fully fixed by their address: the site restores its saved theme from the browser and shows the current Zürich time. The contract asks for state from the URL alone. Changing that means changing code the public site ships, so it is left for Nicolas (`krux-preview-state`).
- A development server can draw its own tools in the page. Next's indicator sat in the corner of every frame until Krux hid it when framed. "Product only at rest" covers those too.
- Krux's rules differ from the other projects': its `main` checkout is for merging only, worktrees go in `~/Worktrees/krux/`, and work branches are pushed. Read its `AGENTS.md` and `AGENT_WORKFLOW.md` first.

**Checks.** In Krux: TypeScript clean, its repository lint clean, and after `npm run build` the export has the same four routes and no manifest. In the browser on port 3200 (a server another session had started; it was read, not restarted): Krux shows "Live · localhost:3220" with two groups and six frames, all loaded, and no dev tool visible in a frame. Not exercised: entering a Krux preview, and Krux at a narrow Atelier window. `npm run typecheck` and `npm test` pass here.

## 2026-10-02 — `agent-atelier add` takes `--id` and `--name`; Yutugy is listed

Nicolas ran the command in `yutugy-portfolio`, a project with no `package.json`. `add` takes a project's id from its package name, so it could not add that folder at all.

- **`--id` and `--name` on `add`** (`server/command.ts`, `server/projects.ts`). Without a `package.json` and without `--id`, `add` now says to pass one. The entry stores only what was given.
- **Outside this repository**: Yutugy was added to Nicolas's list with the packed command (`--id yutugy`, port 3000, its own start command). `add` rewrote the file with one field per line; the two earlier entries are unchanged in content. Nothing in Yutugy's folder was touched.

**What a newcomer would get wrong.** Yutugy is listed, not connected: it does not serve `/atelier.json`, so it shows as "Not running" or "No manifest" and has no screens. It is not an npm project, so the connector package planned for step 3 will not apply to it; it would need a manifest written by hand and served by its own dev server. `npx agent-atelier` in a folder that has not installed the package asks the npm registry and fails, because nothing is published; `npx --package=<tarball> agent-atelier` runs it from the tarball.

**Checks.** `npm run typecheck` passes; `npm test`: 63 pass (62 before; one new, one reworded). From a fresh tarball, in Yutugy's folder: `add` without `--id` refused with the new sentence and wrote nothing; with `--id` it added the entry. The dev server already running on port 3200 then listed three projects, and its rail showed "Yutugy. Not running · localhost:3000" in the in-app Chromium browser. Yutugy's own server was not started, so the "No manifest" state was not seen.

## 2026-10-02 — A launch entry starts Marvin from a session here

Nicolas asked for Marvin to be started alongside Atelier. The desktop app starts servers from `.claude/launch.json` of the folder a session is opened on, so that file gained `marvin-dev`: `npm --prefix /Users/nico/Sites/marvin run dev`, port 3210. `docs/local-setup.md` says so.

**What a newcomer would get wrong.** The entry holds a folder of Nicolas's machine in a committed file. That is outside `src/`, `server/` and the package, so the rule "No project in the code" and the tarball are untouched, but the entry does nothing on another machine. It starts Marvin's dev server and edits nothing there. Palier has no entry: its server on 3100 was already running, started elsewhere.

**Checks.** `npm run typecheck` and `npm test` (62 checks) pass. In the browser on port 3200: Marvin shows "Live · localhost:3210", and the Overview previews in view render from port 3210.

## 2026-10-02 — The "until it is merged" sentences about Palier are removed

Palier's canvas removal reached its `main` earlier in the day, and Nicolas asked for the sentences here that still said otherwise to be cleared. He also had Palier's reworded decision merged: Palier's `main` (`b38166e`) no longer calls its top-edge bar an exception to this contract.

- **`docs/connector.md`**: the summary no longer says that what it tells about Palier describes a branch.
- **`docs/local-setup.md`**: Palier's removal is in its `main`; port 3100 redirects `/` to its first screen.
- **`docs/package-plan.md`**: Palier's connector paths stand without the note about a branch.
- **`TODOS.md`**: `palier-docs-after-merge` and `palier-manifest-name` are closed.

**What a newcomer would get wrong.** The three entries below about Palier ("on a branch", "not merged", "out of date") describe the state when each was written. Nothing in the contract changed here. On a device without hover Palier's bar is always visible, which "Product only at rest" does not allow inside a frame; it is an open item in Palier (`framed-bar-touch`), not here.

**Checks.** `npm run typecheck` and `npm test` pass. Against port 3100, with curl: `/` redirects to `/scenarios/photo-1/accueil`, `/atelier.json` answers 200, and the stylesheet's only `data-embedded` rule hides the library's navigation. The bar inside an Atelier frame was not hovered from this session.

## 2026-10-02 — The Palier override is deleted from `.env.local`

Nicolas asked for the leftover `VITE_ORIGIN_PALIER=http://localhost:3101` line to be deleted and Atelier's dev server restarted. `.env.local` is not committed, so the change is on this machine only; the file keeps one comment and holds no address. The section "A leftover to delete" is gone from `docs/local-setup.md`, and `palier-env-override` is closed in `TODOS.md`.

**What a newcomer would get wrong.** Earlier entries and handoff notes say Atelier looks for Palier on 3101 and shows it as not running; that ended here. An override is read when the dev server starts, so a change to `.env.local` needs a restart, not a page reload. Port 3100 was serving Palier's dev server at the time, so this was also the first time previews loaded from it instead of a production build; entering a preview was not tried against it (`palier-dev-server`).

**Checks.** `npm run typecheck` and `npm test` pass. In the browser on port 3200: Palier shows "Live · localhost:3100", its five previews point at port 3100, and the three in view render. Marvin was not running.

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


## 2026-10-05 — First personal Mac app

Built one AppKit window around the existing UI in WKWebView, following the revised Opus review and Nicolas's “ok go”. The app starts the bundled existing HTTP server with installed Node on localhost:3201. It has standard window/menu behavior, persistent WebKit storage, inspectability, bounded startup/failure handling and one renderer reload. No native message handlers, backend port or native state file.

Added a parent-owned pipe for helper lifetime, shutdown cleanup for active Git children, and a bounded web-store flush on quit. App occlusion/hide/minimize events supplement browser visibility so repeated status polling can pause. Initial status and branch loads still run while covered. Closing or Cmd-W quits; browser development and project servers stay separate. The connector now documents both 3200 and 3201 for framing/CORS allowlists.

`npm run build:mac` builds and ad-hoc signs a local app with all required compiled modules and asset notices. Installed and launched outside the checkout at `/Users/nico/Applications/Atelier.app`; the bundle contains 701,007 bytes, excluding installed runtimes. Rebuilds do not automatically replace this installed copy.

**Checks:** typecheck and all 67 unit tests pass; four helper integration tests cover readiness, access boundaries, occupied-port refusal, EOF/SIGTERM cleanup and reaping stuck Git commands. `npm pack` was installed in a temporary directory and its command served its page and registry. Signature verification passes. Native UI loaded live previews/branches, restored 32% zoom after immediate Cmd-Q, released its helper on Cmd-W, and reopened after a forced native-process exit with no orphan helper. Existing port 3200 remained available. Nicolas confirmed physical Safari pinch is smooth.

**Limits:** native physical gesture feedback, cookies/sign-in, WebSocket hot reload, visibility/idle behavior and a controlled Safari/Chrome/native performance comparison remain acceptance work; no FPS or runtime-memory claim was measured. The installed app uses the machine registry but has preferences separate from the browser. No neighboring files or servers were changed; nothing merged or pushed.


## 2026-10-06 — Mac app icon

Replaced the generic Mac icon with the supplied `atelier-dark.png`. The build generates every standard ICNS size and registers `Atelier.icns` in Info.plist, preserving the original PNG. Updated the installed app and visually confirmed the artwork in About Atelier after reopening. Typecheck, all 67 tests, build/signature verification, and the installed tarball command pass.

## 2026-10-06 — Shared desktop viewport baseline

Palier's inherited 1280 × 720 frames were too constrained for the intended presentation. Atelier now starts every project with a 1440 × 900 desktop minimum, offers two larger minima and exact Project sizes, and displays each frame's effective CSS dimensions outside its preview. Resizing reflows the iframe and board and keeps a selected frame in view. The choice is local to the mounted workspace and is not persisted or injected into preview URLs or storage.

The rule applies to inherited landscape defaults at least 1024 px wide; larger source dimensions never shrink. Explicit screen sizes, narrow/portrait defaults and linked pages remain authoritative. For an exact compact desktop or landscape tablet review, declare per-screen dimensions. The connector documents both the presentation convention and a 1440 × 900 source default for future desktop integrations. No neighboring repository or server was modified.

Checks: all 70 tests and typecheck pass. Browser inspection verified live Palier iframe dimensions at 1440 × 900 and the original 1280 × 720; larger preset labels and selection reframing were checked after Palier's server independently stopped. Tests cover all minima, mixed desktop/mobile/exact screens, non-overlap, source preservation and larger/narrow/portrait defaults. Mac build and signature verification pass. The rebuilt app was subsequently installed at Nicolas’s explicit request: quit the previous copy, replaced its bundle with a verified build, and reopened it. Native visual verification shows live Palier at 1440 × 900 and the Desktop minimum selector; the app is left open. No merge or push.


## 2026-10-06 — Update Atelier from its menu

Added **Atelier → Update Atelier…**, with a native source-folder confirmation and optional picker. It builds the current local checkout while the app remains usable, stages a verified bundle, uses the existing preference flush and owned-helper shutdown, installs and reopens automatically. Build progress appears in the window subtitle. The native bundle records its build source; the npm package contains no machine path or updater. No network release service, Git operation, dependency installation or preview-accessible update endpoint was added.

The copied update worker survives replacing the app. Build failure and cancellation keep the installed bundle intact; filesystem/open-command errors roll back to the previous bundle and report on reopening. Updates retain previous bundles in hidden sibling recovery folders. The source checkout, installed dependencies and Xcode tools remain required, and current uncommitted changes are included. Updating an app running from its own build output is refused.

Checks: typecheck and 70 web tests pass; 12 native/helper/update tests cover staged verification, rollback, source validation, quit timeout, aliased paths, build failure and process-group cancellation. Mac build/signature verification and installing/starting the npm tarball pass. Installed the feature and successfully exercised its native menu through a complete build, replacement and automatic relaunch. Live checks caught two repaired issues: macOS temporary-path aliasing and a main-queue termination deadlock. No neighboring project was edited or restarted. App left open; no merge or push.


## 2026-10-06 — Remove viewport selector outline

Removed the desktop viewport selector’s focus ring at Nicolas’s request. Keyboard focus gets a quiet background treatment instead. No change to frame outlines or other controls. Typecheck and all 70 tests pass; installed through Atelier’s native update flow.


## 2026-10-06 — Desktop, tablet and mobile viewport presets

Added Device to the left of Size: Desktop has 1536 × 864, 1920 × 1080 and 2560 × 1440; Tablet has 800 × 1280 and 820 × 1180; Mobile has 360 × 800, 390 × 844 and 430 × 932. The small curated list uses current Statcounter usage and Apple layout specifications, with sources and selection limits documented in the connector. Both selectors retain the requested outline-free styling.

A preset now sets every canvas frame to its exact CSS dimensions, replacing the desktop-minimum rule, including for screens with explicit source sizes. Project sizes restores those dimensions. Device switches choose a starting size and any size change focuses the selected or first screen. Routes and mounted iframes are retained; choices are transient. This changes viewport dimensions only, not user agent, touch or pixel density, and a connected project must supply its own responsive layout.

Checks: typecheck and all 71 tests pass, covering mixed source dimensions, all eight presets, non-overlapping frames and source restoration. Live UI checks against the installed app verified all eight iframe dimensions and restoration to the project’s original size. Updated via Atelier’s native menu and visually verified Device/Size in the reopened app. No neighboring project changes, merge or push.

## 2026-10-07 — Branch preview plan and independent review prompt

Reviewed the existing branch inventory, registry, preview/status/state handling and shared server/native lifecycle for Nicolas's request to switch branches. He confirmed Atelier should prepare and start previews that are not running. Added `docs/branch-preview-plan.md` and a copy-ready Claude Code Opus 5.5 review request in `docs/claude-branch-preview-review.md`.

The proposal uses exact-commit detached snapshots and explicit project recipes, keeps the current preview until a candidate is ready, and separates target identity from project identity. It identifies readiness proof, abrupt-helper-death cleanup and the first project's recipe as decisions to resolve before implementation. Existing external previews remain separate and cannot be assigned a branch from Git inventory alone. Updated the handoff and preview-branch task accordingly.

Checks: typecheck and all 71 existing tests pass. Documentation only; no runtime, connector contract, installed app, local registry or neighbouring project/server change. Claude has not reviewed the proposal yet. No merge or push.

## 2026-10-07 — Review of the branch-preview plan

Nicolas asked Claude (Opus 5.5) to review `docs/branch-preview-plan.md` against the code before any implementation. Verdict: **proceed with changes**. The review was returned in the session with a reply to paste to Codex; it is not stored here, and it does not authorize implementation. HEAD was `786b8d1`, which differs from the reviewed baseline `e0917b5` in documents only.

What the review changes, and why:

- **Snapshot by `git archive`, not a linked worktree.** A linked worktree shares the repository's configuration and hooks folder, so an install step inside it can change the real repository; it also appears in every worktree list, Atelier's own included, and cannot be removed without `--force` once a tool rewrites a tracked file. An export writes nothing to the repository and is deleted like any folder Atelier made.
- **A guardian process per run.** It stops its own process group when its input pipe closes, which happens however Atelier's server dies. No host needs its own shutdown code, and no process is ever signalled from a recorded id.
- **Readiness from process ownership.** Every listener on the assigned port must belong to the run's process group (`lsof`), then the manifest is fetched and checked. No connector change, so branches without a new connector piece stay previewable.
- **Left out of the first version:** the mutation token, per-commit saved views, environment files, a configured port range, submodule and LFS detection, and any platform but macOS.

**Probes, all disposable and in the session's scratch folder.** A process group started detached survived a `SIGKILL` of its parent and kept listening; the same group under a guardian was gone within 300 ms with no signal from outside it. `lsof` reported the listener's process group and bound address in 20 to 50 ms. In a temporary repository: `git archive` wrote nothing to the repository; `git worktree add` wrote under `.git/worktrees/` and ran `post-checkout` unless `core.hooksPath` was overridden; a `git config` write inside the linked worktree changed the main repository's setting; removal without `--force` deleted an ignored `node_modules` but refused after a tracked file changed. A Vite restart built a second handler in the same process.

**A hypothesis the probe refuted.** Under `npm run dev` Atelier's endpoints do not check the Host header themselves (`server/handler.ts`), but Vite 8.3.2 rejects a foreign Host before they run. The mutation route should still check it in shared code so it does not rest on a Vite default.

**What a newcomer would get wrong.**

- Palier's `dev` script fixes port 3100, the Working preview's own port. A recipe that reuses the script would serve a snapshot at the address labelled as the working copy.
- Next 16.3 rewrites a block in a tracked `AGENTS.md` when its dev server starts (stated in Palier's own rules and present in its installed Next). A snapshot is not guaranteed clean after a run.
- `/Users/nico/package.json` exists with a lockfile and `node_modules`; `/Users/nico/Sites/package.json` does not. See `parent-package-rule` in `TODOS.md`.
- Krux's `main` contains the connector's manifest route; three of its branches checked do not, which makes them a real case of "not connected".

Checks: typecheck, all 71 tests and the 12 Mac helper and updater tests pass. Neighbouring repositories were read only (their rules first, then branch, lockfile and configuration listings). No runtime, registry, installed app or project server was changed, started or stopped. No merge or push.


## 2026-10-07 — Incorporate the branch-preview review

Revised `docs/branch-preview-plan.md` after Nicolas relayed Claude's “proceed with changes” verdict. Archive exports replace linked worktrees; an EOF guardian owns every step; readiness checks all listeners against the run's process group with `lsof` before server-side manifest validation. The plan uses system-assigned ports, a required `{port}` argument, required-file recipe checks, one revisioned server state and run-keyed inner workspaces with Device/Size above them. Removed mutation tokens, per-commit views, environment files, port ranges, submodule/LFS detection and non-macOS support from v1.

The first increment is strictly `server/previews.ts`, the guardian and process-level fixture tests, followed by a cold start on the project Nicolas names. Implementation remains unauthorized. The first project, committed-only snapshots and single-managed-preview policy await his decision. The original review prompt is labelled historical; Claude's reported probes have not been reproduced by Codex. No runtime, connector, local configuration, installed app or neighbouring project/server changed.

Checks for this documentation revision: `npm run typecheck`, all 71 tests and `git diff --check` pass. No merge or push.


## 2026-10-07 — Internal branch-preview runner and guardian

Nicolas authorized the first runner increment with Palier, committed-only snapshots and one managed preview at a time. Added `server/previews.ts` and `server/previewGuardian.ts`, plus eleven macOS process-level tests. The coordinator preserves its active run until a replacement is ready; cancellation/supersession stop only owned candidates. Recipes use explicit commands, required files and a mandatory `{port}` start argument. Archive exports and private dependencies stay in disposable cache directories, with no linked-worktree or neighbouring-checkout writes.

Every command runs beneath an EOF guardian in its own process group. A dropped coordinator pipe—including coordinator SIGKILL—causes group TERM then KILL; no recorded PID is used. A live Unix socket protects each marked cache directory from recovery cleanup. Listener readiness uses all `lsof` results on the assigned port, including both address families, then validates a bounded manifest response on the server. Preparation/timeouts, missing files/manifests, external symlinks, foreign listeners, source rewrites and leftover cleanup have real fixture coverage. A test caught cancellation reported as a command error; cancellation now wins consistently.

Palier's archive of `main` at `1591aac` installed dependencies cold and served its manifest plus the first screen. Its original HEAD, status, worktree list and port-3100 listener were unchanged. The temporary server/export were removed; the tested recipe is in `docs/local-setup.md`. The build explicitly includes the runner and guardian so the installed tarball can launch the compiled child.

Limits: this is an internal backend increment, with no registry configuration change, HTTP API, UI or host lifecycle wiring. Vite restart disposal and native/CLI integration remain next. No visual/HMR claim. Recipes must not daemonize outside the guardian's group; killing the guardian itself is not the tested coordinator-death path. Output is drained without exposing dependency credentials; richer diagnostics are deferred. Port collision fails safely for explicit retry. Unknown cache folders are preserved. The installed app was not replaced.

Checks: typecheck, all 82 web/process tests and 12 Mac helper/update tests pass. `npm pack` installs and its command serves the page/registry; the installed runner also cold-starts and disposes a fixture through the compiled guardian. No merge or push.


## 2026-10-07 — Branch-preview controls, API and host lifecycle

Nicolas approved integrating the runner with a compact, explicit launcher: choose a branch, then press Start preview. Added registry recipe resolution and a same-origin `/__atelier/previews` API with bounded bodies, exact action schemas, server instance/revision checks and run-targeted Stop/Cancel. Commands, environment values and cache paths stay out of browser responses. The project list only exposes recipe capability. Palier’s machine entry now contains the tested recipe, with the previous registry backed up locally; the packed README remains generic.

The sidebar shows the selected branch and the source actually being viewed, with progress, Cancel, Start/Restart/Update and Stop/Working preview. A candidate replaces the old preview only when ready. Run-keyed inner workspaces reset iframe/page lifetimes, preserve valid selection and page IDs, and keep Device/Size above the reset. Managed view storage is transient; Working preview preferences stay separate. Status replies are guarded by project/origin and request sequence. Hidden windows pause polling.

Each Vite HTTP server now disposes its own preview service on close. The real restart test caught a shared plugin-level cleanup hook disposing the new service after restart; disposal is now tied to the captured old HTTP server instead. `serve()` owns the same cleanup for CLI and native helper. Mac EOF tests cover both preparation and live serving. A live Cancel race led to exact run IDs for Stop/Cancel: progress revisions may advance, but an old run cannot stop a replacement. Start still checks the full current revision. Successful cancellation is neutral, and failed retirement cleanup does not kill a newly promoted run.

Verification: typecheck, all 88 web/process tests, 14 Mac helper/update tests, Mac build/signature check, and an installed npm tarball’s CLI/API/compiled guardian/manifest/SIGTERM cleanup. The browser walkthrough cold-started Palier, switched main (`1591aac`) → activity-video-draft (`6c53deb`) → main, retained Tablet 820 × 1180 and the selected screen, preserved the linked page while changing its origin, cancelled a replacement without losing the active preview, and reconnected a second tab to the same run. The registered checkout stayed clean at the same HEAD and port 3100 retained its original listener. No product code or external server was changed.

The owned review server on 3298 and its current main preview are left available. The installed Mac app has not been replaced; installed WKWebView acceptance and a live project HMR mutation are not claimed. Raw install output remains hidden, recipes must not daemonize outside their process group, and snapshot/export/port-allocation limits remain as recorded in the plan. No connector protocol change, merge, push or publication.


## 2026-10-07 — Sidebar update availability

Added a dark **Update available** action pinned to the sidebar footer in the Mac app. A matching build shows no notice; while updating the slot reads **Updating Atelier…**. Clicking opens the existing native confirmation, preserving the updater’s build/stage/verify/install flow. Native interception requires the exact local URL, a link activation and Atelier’s main source/target frame; preview frames and new windows cannot invoke it. Browser-only Atelier has no update action or HTTP update endpoint.

The build records a SHA-256 fingerprint of saved source/build inputs. Native checks run on startup/focus and every 30 seconds while visible using a bounded, clean-environment Node process that only reads files. Uncommitted saved edits, additions and deletions count; documentation, tests, dependencies, Git metadata and generated output do not. Missing or unreadable source, unrecognized metadata and source symlinks are unknown rather than “up to date”. This detects local content differences, not release versions or whether a Git branch is newer. Source changes during the build now refuse to produce an installable success.

Checks: typecheck, 88 web/process tests, 17 Mac tests, Mac build/signature verification, npm pack and installed tarball CLI/preview/cleanup. An isolated native copy verified matching source hides the action, a disposable saved source addition reveals it, clicking opens the normal confirmation, and restoring the source hides it again. The probe file and test app process were removed. Nicolas’s installed app and active branch preview were left running; this feature needs one normal menu update to become available there. No merge or push.
