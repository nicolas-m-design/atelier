# Atelier

> **Summary:** A local workspace that shows several projects' prototype screens on one pannable, zoomable canvas, with a project switcher. Each project stays in its own repository and runs its own server; Atelier embeds its screens as live previews. Palier and Marvin are both connected. Local only: nothing is published or deployed.

## What it is

The scenario canvas started inside Palier. Atelier is that canvas, moved out so it can be improved once and used by every project:

- a narrow **project rail** to switch projects, each with a status dot;
- the selected project's **scenario sidebar**;
- the **canvas**, with each screen shown as a live preview from the project's own server.

Atelier holds no product code. A project lists its screens in a small manifest it serves itself, and each screen is one of the project's own pages in an iframe, so it keeps its own styles, dependencies and state. The contract is in [docs/connector.md](docs/connector.md).

Palier keeps its own built-in canvas as its standalone entry. Canvas improvements happen here from now on.

## Run it

Requires Node 22.12 or later, and npm.

```bash
npm install
```

```bash
npm run dev
```

Atelier runs at http://localhost:3200. The port is fixed, because saved canvas positions belong to that address; if 3200 is taken, the command fails instead of moving. In the Claude desktop app, the preview uses `.claude/launch.json` (`atelier-dev`).

Start each project's own server yourself, in its own folder. Atelier never starts or stops anything.

| Project | Address Atelier expects | Start it with |
| --- | --- | --- |
| Palier | http://localhost:3100 | `npm run dev` in `/Users/nico/Sites/palier` |
| Marvin | http://localhost:3210 | `npm run dev` in `/Users/nico/Sites/marvin` |

**Until Palier's connector branch is consolidated**, the server on 3100 does not serve `/atelier.json`, and Atelier reports "No manifest" for it. The connector lives on the branch `claude/atelier-connector`, checked out at `/Users/nico/Sites/palier-atelier`. To use it, build and serve that worktree on port 3101 (`npm run build`, then `npx next start --port 3101` there, or the `palier-connector-preview` entry in `.claude/launch.json`) and keep this line in `.env.local`:

```
VITE_ORIGIN_PALIER=http://localhost:3101
```

Remove the line, and the launch entry, once the canonical checkout serves the manifest.

## Using the canvas

- **Move:** drag, or scroll. **Zoom:** pinch on a trackpad, or Ctrl/Command + wheel, or the controls at the bottom. 100% is the screen's real size.
- **Keyboard, with the canvas focused:** arrow keys pan, `+` and `-` zoom, `0` shows everything, `1` is actual size, Enter enters the selected screen.
- **Sidebar:** a group name shows that row; a screen name centres that screen and selects it.
- **Select a screen:** click it. Nothing inside the screen reacts. A selected screen shows three controls above its top-right corner: interact, reload, open in a new tab.
- **Interact with a screen:** double-click it, or press Enter on a selected one. Its links, forms and scrolling now work; the rest of the canvas still pans and zooms.
- **Leave a screen:** "Exit preview" above the screen or in the bar at the bottom, a click on the bare canvas, or Escape while the keyboard is in Atelier.

Each project remembers its own position, zoom and selected screen in this browser. Previews are never affected by that memory: a screen's state comes from its route alone.

## What the project states mean

| Dot | Sidebar line | Meaning |
| --- | --- | --- |
| Green | Live | The project serves a valid manifest. Screens load when they come near the viewport. |
| Grey | Not running | Nothing answers. The last known screens stay listed as placeholders; Atelier reconnects by itself when the server is back. |
| Amber | No manifest | A server answers without a usable `/atelier.json`. |
| Hollow | No preview yet | Registered without an address. No current project is in this state. |

## Known limits

- **Escape inside a preview stays in the preview.** Once a preview has the keyboard, Atelier cannot see key presses. Use an Exit control or click the bare canvas.
- **A pinch or Ctrl/Command + wheel over an entered preview goes to the preview, not the canvas**, and the browser may zoom the whole page instead. Pinch outside the preview, or exit first. (Wheel input was confirmed to stay inside an entered preview; the browser's page zoom itself was not exercised.)
- **A preview's current page is not shown.** After you navigate inside a preview, its label still names the starting screen. Reload returns it there.
- **Loaded previews stay loaded** until more than twelve are held, so in-preview navigation survives panning. Switching projects, or a project going offline, discards them.
- **Each preview is a full page.** That is fine for a handful of screens; a project with dozens would need thumbnails, which do not exist yet.
- **Text can shimmer while zooming**, and settles when the zoom stops. At 100% a preview is not scaled at all.

## Where things are

| Path | Its job |
| --- | --- |
| `AGENTS.md` | Rules for working here |
| `TODOS.md` | Handoff note and open work |
| `CHANGELOG.md` | What changed, newest first |
| `docs/connector.md` | The manifest and preview-route contract a project implements |
| `src/projects.ts` | The registry: which projects exist and where they answer |
| `src/manifest.ts` | The manifest's shape and its validation |
| `src/status.ts`, `src/useStatuses.ts` | Deciding whether a project is live, stopped, unconnected or empty |
| `src/camera.ts`, `src/layout.ts` | Camera maths, board layout and which frames stay loaded; no framework |
| `src/storage.ts` | What is remembered per project in this browser |
| `src/components/` | Rail, sidebar and workspace, canvas, frame, status card |
| `tests/` | Checks for the framework-free modules, run by Vitest |

```bash
npm test
```

```bash
npm run typecheck
```

## Not in scope yet

Annotations, an MCP server, collaboration, starting or stopping project servers, public publishing, shared component libraries across projects, and an installable connector package. The connector is a documented contract for now; a package should wait until two projects use it.
