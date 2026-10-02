# Atelier

> **Summary:** A local workspace that shows several projects' prototype screens on one pannable, zoomable canvas, with a project switcher. Each project stays in its own repository and runs its own server; Atelier embeds its screens as live previews. Local only: nothing is published or deployed. Its full name is Agent Atelier and its package name `agent-atelier`; these documents and the interface say Atelier. What is specific to the machine it is developed on is in [docs/local-setup.md](docs/local-setup.md).

## What it is

Atelier started as the canvas inside one project, and was moved out so it can be improved once and used by every project:

- a narrow **project rail** to switch projects, each with a status dot;
- the selected project's **sidebar**: a switch between its screens and its linked pages, such as a UI library, then the list of screens, and at the foot the local branches of its repository;
- the **canvas**, with each screen shown as a live preview from the project's own server.

Atelier holds no product code. A project lists its screens in a small manifest it serves itself, and each screen is one of the project's own pages in an iframe, so it keeps its own styles, dependencies and state. The contract is in [docs/connector.md](docs/connector.md).

## Run it

Requires Node 22.12 or later, and npm.

**From this repository**, while working on Atelier itself:

```bash
npm install
```

```bash
npm run dev
```

**As the packaged command**, which serves the built page without Vite:

```bash
npx agent-atelier
```

The package is not published. `npm pack` here builds it into a tarball that another project can install; see [docs/package-plan.md](docs/package-plan.md). The command is `agent-atelier`, never `atelier`: an unrelated npm package owns that name.

Either way Atelier runs at http://localhost:3200. The port is fixed, because saved canvas positions belong to that address; if 3200 is taken, it fails instead of moving. The command takes `--port` for a second copy, which keeps its own positions. It listens on this machine only.

Start each project's own server yourself, in its own folder. Atelier never starts or stops anything.

### The project list

No project is named in Atelier's code. The list is a file on the machine, `~/.config/agent-atelier/projects.json` (or the file named by `ATELIER_PROJECTS`), read by Atelier's server each time the page asks:

```json
{
  "projects": [
    { "repo": "/path/to/project", "origin": "http://localhost:3000", "start": "npm run dev" },
    "/path/to/another/project"
  ]
}
```

An entry is a project's folder, or an object naming it. What the entry leaves out comes from that folder's `package.json`: the id from its `name`, and `origin`, `start` and `name` from an `atelier` field, when it has one. An entry may also give `id` and `name` itself, and may leave out `repo` for a project that is only an address. An entry that cannot be used is skipped; the page says why when nothing else is listed, and the browser console says so otherwise. Reload the page after editing the file.

Edit the file by hand, or let the command append to it, from the project's folder:

```bash
npx agent-atelier add --origin http://localhost:3000 --start "npm run dev"
```

`add` is the only thing in Atelier that writes the file. It never overwrites a file it cannot read, and does nothing when the folder is already listed.

Two more things the command does that `npm run dev` does not:

- **A project is shown without being listed** when the command is run in its folder and the project has `agent-atelier` among its dependencies, or an `atelier` field in its `package.json`. It appears after the listed ones, for that run.
- **`--origin <id>=<address>`** shows a listed project at another address for that run, for example a worktree's preview on another port. Under `npm run dev` the same is done with `VITE_ORIGIN_<ID>` in `.env.local`.

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
- **The project list and the branch list need Atelier's own server.** `npm run dev` and the `agent-atelier` command both provide it. The built page opened any other way says the project list is not available.
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
| `src/branches.ts`, `src/useBranches.ts` | Turning git's output into the branch list, and reading it from Atelier's server |
| `server/` | The only code outside the browser. `projects.ts` reads the project list from the file on the machine, and appends to it for `add`; `branches.ts` runs git, read-only; `handler.ts` answers both at `/__atelier/projects` and `/__atelier/branches/<id>` for Atelier's own page only. `vite.ts` mounts that on the dev server. `cli.ts`, `command.ts` and `serve.ts` are the packaged command: its arguments, and a plain Node server for the built page |
| `tsconfig.build.json` | Builds the command into `dist/server` and `dist/src`; `vite build` puts the page in `dist/app`. `npm run build` does both, and `npm pack` runs it first |
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

An installable package is no longer out of scope. It follows `docs/package-plan.md`: the project list read from a file and the `agent-atelier` command are done; the connector a project imports is next. Until then the connector remains a documented contract.
