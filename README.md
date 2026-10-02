# Atelier

> **Summary:** A local workspace that shows several projects' prototype screens on one pannable, zoomable canvas, with a project switcher. Each project stays in its own repository and runs its own server; Atelier embeds its screens as live previews. Palier and Marvin are both connected. Local only: nothing is published or deployed. Its full name is Agent Atelier and its package name `agent-atelier`; these documents and the interface say Atelier.

## What it is

The scenario canvas started inside Palier. Atelier is that canvas, moved out so it can be improved once and used by every project:

- a narrow **project rail** to switch projects, each with a status dot;
- the selected project's **sidebar**: a switch between its screens and its linked pages, such as a UI library, then the list of screens, and at the foot the local branches of its repository;
- the **canvas**, with each screen shown as a live preview from the project's own server.

Atelier holds no product code. A project lists its screens in a small manifest it serves itself, and each screen is one of the project's own pages in an iframe, so it keeps its own styles, dependencies and state. The contract is in [docs/connector.md](docs/connector.md).

Palier no longer keeps a canvas of its own: Nicolas had it removed on 2026-10-02, so Atelier is the only canvas for its screens. That removal is on Palier's branch `work/atelier-name-restored`; until it is in Palier's `main`, port 3100 still serves the old canvas at `/`.

## Run it

Requires Node 22.12 or later, and npm.

```bash
npm install
```

```bash
npm run dev
```

Atelier runs at http://localhost:3200. The port is fixed, because saved canvas positions belong to that address; if 3200 is taken, the command fails instead of moving. In the Claude desktop app, the preview uses `.claude/launch.json` (`atelier-dev`).

### The project list

No project is named in Atelier's code. The list is a file on this machine, `~/.config/agent-atelier/projects.json` (or the file named by `ATELIER_PROJECTS`), read by Atelier's server each time the page asks:

```json
{
  "projects": [
    { "repo": "/Users/nico/Sites/palier", "origin": "http://localhost:3100", "start": "npm run dev" },
    "/path/to/another/project"
  ]
}
```

An entry is a project's folder, or an object naming it. What the entry leaves out comes from that folder's `package.json`: the id from its `name`, and `origin`, `start` and `name` from an `atelier` field, when it has one. An entry may also give `id` and `name` itself, and may leave out `repo` for a project that is only an address. An entry that cannot be used is skipped; the page says why when nothing else is listed, and the browser console says so otherwise. Reload the page after editing the file. Atelier only reads it.

Start each project's own server yourself, in its own folder. Atelier never starts or stops anything. The projects listed on Nicolas's machine:

| Project | Address Atelier expects | Start it with |
| --- | --- | --- |
| Palier | http://localhost:3100 | `npm run dev` in `/Users/nico/Sites/palier` |
| Marvin | http://localhost:3210 | `npm run dev` in `/Users/nico/Sites/marvin` |

Palier's connector is part of its `main` since 2026-10-02, so the server on 3100 serves `/atelier.json`. The separate worktree and its preview on port 3101 no longer exist. If `.env.local` still holds the line below, delete it: it points Palier at 3101, where nothing answers, and Atelier then shows Palier as not running.

```
VITE_ORIGIN_PALIER=http://localhost:3101
```

## Using the canvas

- **Move:** drag, or scroll. **Zoom:** pinch on a trackpad, or Ctrl/Command + wheel, or the controls at the bottom. 100% is the screen's real size.
- **Keyboard, with the canvas focused:** arrow keys pan, `+` and `-` zoom, `0` shows everything, `1` is actual size, Enter enters the selected screen.
- **Sidebar:** a group name shows that row; a screen name centres that screen and selects it.
- **Pages:** when a project links a page such as its UI library, the top of the sidebar switches between "Screens" (the canvas) and that page. The page fills the workspace and is interactive straight away; reload and open-in-a-new-tab sit in the bar above it. The canvas keeps its position and previews meanwhile.
- **Select a screen:** click it. Nothing inside the screen reacts. A selected screen shows three controls above its top-right corner: interact, reload, open in a new tab.
- **Interact with a screen:** double-click it, or press Enter on a selected one. Its links, forms and scrolling now work; the rest of the canvas still pans and zooms.
- **Leave a screen:** "Exit preview" above the screen or in the bar at the bottom, a click on the bare canvas, or Escape while the keyboard is in Atelier.

- **Local branches:** the foot of the sidebar lists the branches of the project's repository: name, age of the last commit, its subject, and a folder mark on each branch that is checked out, with the folder's name. Hover a row for the commit hash and the full path. It is a list to read; nothing in it is a control. It is read when the list opens and when the window regains focus, and it does not depend on the project's server running.

Each project remembers its own position, zoom, selected screen and open page in this browser. Previews are never affected by that memory: a screen's state comes from its route alone.

## What the project states mean

| Dot | Sidebar line | Meaning |
| --- | --- | --- |
| Green | Live | The project serves a valid manifest. Screens load when they come near the viewport. |
| Grey | Not running | Nothing answers. The last known screens stay listed as placeholders; Atelier reconnects by itself when the server is back. |
| Amber | No manifest | A server answers without a usable `/atelier.json`. |
| Hollow | No preview yet | Listed without an address. No current project is in this state. |

## Known limits

- **Escape inside a preview stays in the preview.** Once a preview has the keyboard, Atelier cannot see key presses. Use an Exit control or click the bare canvas.
- **A pinch or Ctrl/Command + wheel over an entered preview goes to the preview, not the canvas**, and the browser may zoom the whole page instead. Pinch outside the preview, or exit first. (Wheel input was confirmed to stay inside an entered preview; the browser's page zoom itself was not exercised.)
- **A preview's current page is not shown.** After you navigate inside a preview, its label still names the starting screen. Reload returns it there.
- **Loaded previews stay loaded** until more than twelve are held, so in-preview navigation survives panning. Switching projects, or a project going offline, discards them.
- **The branch list does not say which branch a preview shows.** Atelier cannot tell which folder a server on a given port was started from. A folder mark means "checked out there", which is the most a preview could be served from.
- **The project list and the branch list need the dev server.** Both are answered by `npm run dev` itself. A built copy of Atelier has no server behind it and says the project list is not available. The packaged command in `docs/package-plan.md` removes this.
- **Each preview is a full page.** That is fine for a handful of screens; a project with dozens would need thumbnails, which do not exist yet.
- **Text can shimmer while zooming**, and settles when the zoom stops. At 100% a preview is not scaled at all.

## Where things are

| Path | Its job |
| --- | --- |
| `AGENTS.md` | Rules for working here |
| `TODOS.md` | Handoff note and open work |
| `CHANGELOG.md` | What changed, newest first |
| `docs/connector.md` | The manifest and preview-route contract a project implements |
| `src/projects.ts`, `src/useProjects.ts` | The shape of a project and of the list, their validation, address overrides; and reading the list from Atelier's server |
| `src/manifest.ts` | The manifest's shape and its validation |
| `src/status.ts`, `src/useStatuses.ts` | Deciding whether a project is live, stopped, unconnected or empty |
| `src/camera.ts`, `src/layout.ts` | Camera maths, board layout and which frames stay loaded; no framework |
| `src/storage.ts` | What is remembered per project in this browser |
| `src/branches.ts`, `src/useBranches.ts` | Turning git's output into the branch list, and reading it from the dev server |
| `server/` | The only code outside the browser. `projects.ts` reads the project list from the file on this machine; `branches.ts` runs git, read-only; `handler.ts` answers both at `/__atelier/projects` and `/__atelier/branches/<id>` for Atelier's own page only; `vite.ts` mounts that on the dev server |
| `src/components/` | Rail, sidebar and workspace, canvas, frame, status card, branch list |
| `tests/` | Checks for the framework-free modules, run by Vitest |

```bash
npm test
```

```bash
npm run typecheck
```

## Not in scope yet

Annotations, an MCP server, collaboration, starting or stopping project servers, switching or creating branches, public publishing, and shared component libraries across projects.

An installable package is no longer out of scope: Nicolas asked for it on 2026-10-02, with two projects connected. It follows `docs/package-plan.md`, whose first step, the project list read from a file, is done. Until the package exists the connector remains a documented contract.
