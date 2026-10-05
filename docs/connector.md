# Connecting a project to Atelier

> **Summary:** The contract between Atelier and a project: one JSON manifest at `/atelier.json`, preview routes that behave well inside a frame, and optionally linked pages such as a UI library. Palier and Marvin both implement it. There is no package to install yet; a project implements these two things in its own code.

## What a project provides

1. **A manifest** at `<origin>/atelier.json`, readable from another local origin.
2. **Preview routes**: ordinary pages of the project's own app, one per screen, that show the product only while at rest and take their state from the URL.

A project may also name **linked pages**, such as its UI library, which Atelier shows whole in place of the canvas.

Atelier provides everything else: the project rail, the sidebar, the canvas, labels, selection and controls. None of that is ever drawn inside a preview or a linked page.

## The manifest

Served with `Content-Type: application/json` and `Access-Control-Allow-Origin: *` (Atelier runs on a different port, so the browser needs that header to let it read the response).

```json
{
  "atelier": 1,
  "name": "Marvin",
  "frame": { "width": 1440, "height": 900 },
  "groups": [
    {
      "id": "fleet",
      "label": "01",
      "title": "Fleet",
      "description": "Where the fleet stands at the incident snapshot.",
      "screens": [
        { "id": "overview-amr-04", "title": "Overview", "caption": "AMR-04 selected", "route": "/preview/overview?snapshot=incident&robot=amr-04" }
      ]
    }
  ],
  "links": [{ "id": "library", "title": "UI library", "route": "/ui", "width": 1280 }]
}
```

| Field | Required | Meaning |
| --- | --- | --- |
| `atelier` | yes | Contract version. Must be `1`. |
| `name` | yes | The project's display name. |
| `frame.width`, `frame.height` | yes | Source default frame size in CSS pixels (integers, 240 to 4096). Inherited desktop frames may be enlarged by Atelier's desktop minimum; see below. |
| `groups[].id`, `groups[].title` | yes | One canvas row per group. Groups without screens are not drawn. |
| `groups[].label`, `groups[].description` | no | A short ordinal such as "01", and one line under the title. |
| `screens[].id` | yes | Unique across the whole manifest. Atelier stores the selected screen by this id, so keep it stable. |
| `screens[].title` | yes | Shown above the frame and in the sidebar. |
| `screens[].caption` | no | A short line under the title: a persona, a state, a fixture name. |
| `screens[].route` | yes | A path on the project's own origin, starting with one `/`. Full URLs are rejected. |
| `screens[].width`, `screens[].height` | no | Exact review dimensions for one screen. Setting either opts that screen out of the desktop minimum; an omitted dimension still inherits from `frame`. |
| `links[].id`, `links[].title`, `links[].route` | no | Other project pages, such as a UI library. See "Linked pages" below. Atelier stores the open page by its id; the id `library` gets a library icon. |
| `links[].width` | no | The narrowest width the page is designed for, in CSS pixels (integer, 240 to 4096). With less room Atelier lays the page out at this width and scales it down. Leave it out for a page that adapts to any width. |

Strings are limited to 200 characters. Unknown fields are ignored. An invalid manifest is rejected as a whole, and Atelier says why.

### Desktop presentation sizes

Atelier starts each project with a **1440 × 900 CSS pixel desktop minimum**. It applies only to screens inheriting both dimensions from a landscape default at least 1024 px wide. Each dimension is enlarged independently to that minimum; larger source dimensions are never reduced. This is a presentation convention, not detection of a physical device or a guarantee that a layout is responsive.

The **Desktop minimum** control also offers 1600 × 1000 and 1920 × 1080. **Project sizes** restores every declared dimension exactly. The choice lasts for the current project view and is not saved. Every frame's caption shows its effective dimensions; canvas zoom changes only how large it looks on the board. Resizing retains the iframe and its route, so the page handles the change like a browser resize.

Explicit per-screen sizes always win, including compact desktop checks, phones and tablets. For a landscape tablet or any exact-size review, declare both dimensions on that screen. Narrow and portrait defaults are left as declared. Linked pages retain their separate sizing behavior.

New desktop connectors should declare `frame: { width: 1440, height: 900 }` so their source agrees with the initial presentation. Keep small-width regression checks as explicitly sized screens (for example 1280 × 720), rather than making a constrained review size the default for every preview. Captures should use the effective dimensions shown beside the frame.

**Derive the manifest from the project's own scenario data** instead of writing a second list by hand. Palier builds its manifest from the one list of screens its entry redirect also reads (`src/components/scenarios/screens.ts` and `atelier.ts` there), and a test checks that the two agree. Marvin builds its manifest from its preview frame registry (`src/preview/frames.ts` and `manifest.ts` there), with the same kind of test.

## Preview routes

- **State comes from the URL alone.** The same route must render the same screen on every load: fixture, snapshot time and selection are named in the path or query. A preview must not read saved user preferences (local storage, cookies), the device clock or anything another preview could change.
- **Product only at rest.** A framed preview that nothing is pointing at or focused in shows the product and nothing else: no canvas controls, scenario navigation, back-to-canvas links or prototype banners in view. If the project shows such things on its standalone pages, it has two ways to keep to this:
  - **Hide them when framed.** A small client check (`window.self !== window.top`) that sets an attribute on the document, and one CSS rule, are enough. Palier's library does this (see "Linked pages").
  - **Keep navigation out of sight until it is asked for.** Navigation between the project's own screens may stay in a framed page if, at rest, it shows nothing and takes no room in the layout, and appears only when the pointer reaches it or the keyboard focuses it. Palier's scenario pages do this: a bar with the screen's name and previous and next links slides over the top of the page when the pointer reaches the frame's top edge. Atelier passes pointer and keyboard input to a preview only once it is entered, so the bar cannot appear on a preview that is merely shown or selected. Two limits: the area that reveals it scales with the frame, so it is hard to reach when the canvas is zoomed far out; and a link back to the project's own canvas, or anything visible at rest such as a banner, still has to be hidden.
- **Allow framing.** Do not send `X-Frame-Options` or a `frame-ancestors` policy that blocks `http://localhost:3200` (browser) or `http://localhost:3201` (Mac app). If using an explicit CORS allowlist instead of `*`, include both origins there too.
- **Fit the frame.** The page is shown in an iframe at the effective CSS dimensions described above. It may scroll inside the frame and should respond to viewport resizing. Explicitly sized review screens use their declared dimensions exactly.
- **In-frame navigation is fine.** Product links work once a preview is entered. Atelier cannot see where a preview has navigated; its reload control returns the frame to the manifest route.

Captures for a portfolio are taken from the project's own route in a browser window of the right size, not from Atelier.

## Linked pages

When a manifest has `links`, Atelier's sidebar opens with a page switcher: "Screens" for the canvas, then one entry per link. A linked page is shown whole, in a frame that fills the workspace, under a bar holding Atelier's reload and open-in-a-new-tab controls.

- **Not a preview.** A linked page has no fixed frame size and is always interactive. Its state is its own business; Atelier passes it nothing but its route.
- **Allow framing**, as for preview routes.
- **Keep the page's own navigation, hide the prototype's.** A library's section list belongs to the page and stays. A wordmark, a page switcher or a link back to the project's own canvas duplicates what Atelier already shows; hide those when framed. Palier's library hides its wordmark and page switcher this way: the frame check sets `data-embedded` on the document (`src/components/workspace/EmbeddedPreview.tsx` there), and one CSS rule does the hiding. Marvin's library has only its section list and a logotype, and hides nothing.
- **Declare `width` if the page has a minimum width.** Marvin's library shares its product's 1280 px minimum and declares it; Palier's adapts and does not.

Atelier keeps the canvas mounted underneath an open page, so previews and position are unchanged on return.

## Listing the project in Atelier

Atelier's code names no project. Add the project to the list on the machine, `~/.config/agent-atelier/projects.json` (or the file named by `ATELIER_PROJECTS`), and reload Atelier:

```json
{ "projects": [{ "repo": "/path/to/project", "origin": "http://localhost:3300", "start": "npm run dev" }] }
```

| Field | Meaning |
| --- | --- |
| `repo` | The project's main folder, as an absolute path. Atelier's server reads the local branches there for the sidebar's "Local branches" list, and never writes to it. Without it the list says no folder is registered. |
| `origin` | Where the preview answers: scheme, host and port, no path. Left out or `null`, the project appears as an empty one. |
| `start` | The command that starts the preview, run in `repo`. Atelier shows it; it never runs it. |
| `id`, `name` | Default to the `name` in the folder's `package.json` (without its scope), and to that id with a capital. The id is lowercase letters, digits and hyphens; Atelier stores each project's canvas view under it, so keep it stable. |

An entry may be just the folder, as a string. A project can then describe itself, in an `atelier` field of its own `package.json`: `{ "origin": "http://localhost:3300", "start": "npm run dev" }`, and optionally `name`. What the list entry gives wins over that field. Neither connected project has the field yet; their entries in the list are complete.

This is outside the contract: Atelier reads only the manifest from a running project, and the list only tells it where to look.

To show a project at a different address without editing the list, for example a worktree's preview on another port: `--origin <id>=<address>` on the `agent-atelier` command, or `VITE_ORIGIN_<ID>` in Atelier's `.env.local` under `npm run dev`, where hyphens in the id become underscores.

From the project's own folder, `npx agent-atelier add --origin http://localhost:3300 --start "npm run dev"` appends the entry instead of editing the file by hand; a project without a `package.json` also needs `--id`. A project that has `agent-atelier` among its dependencies, or an `atelier` field, is also shown without being listed when the command is run in its folder.

## How Atelier reads a project's state

| What Atelier finds | State | What it shows |
| --- | --- | --- |
| No `origin` listed | Empty | "No preview yet" and how to connect. |
| Nothing answers at the origin | Not running | The last manifest it saw, placeholder frames, and the start command when one is listed. It rechecks every 3 seconds and when the window regains focus. |
| A server answers, but the manifest is missing, unreadable or invalid | No manifest | The reason. Typical cause: the served branch does not include the connector. |
| A valid manifest | Live | The screens, loaded near the viewport. Rechecked every 10 seconds. |

## Not part of this contract yet

No messages pass between Atelier and a preview. Because of that, Atelier cannot receive keys pressed inside a preview, cannot turn a pinch gesture over an entered preview into a canvas zoom, and cannot show a preview's current route. A small script served by the project could close those gaps later; it would be an addition to this contract, not a change to it.
