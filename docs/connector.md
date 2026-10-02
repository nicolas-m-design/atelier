# Connecting a project to Canvagent

> **Summary:** The contract between Canvagent and a project: one JSON manifest at `/canvagent.json`, preview routes that behave well inside a frame, and optionally linked pages such as a UI library. Palier and Marvin both implement it. There is no package to install yet; a project implements these two things in its own code.

## What a project provides

1. **A manifest** at `<origin>/canvagent.json`, readable from another local origin.
2. **Preview routes**: ordinary pages of the project's own app, one per screen, that render the product only and take their state from the URL.

A project may also name **linked pages**, such as its UI library, which Canvagent shows whole in place of the canvas.

Canvagent provides everything else: the project rail, the sidebar, the canvas, labels, selection and controls. None of that is ever drawn inside a preview or a linked page.

## The manifest

Served with `Content-Type: application/json` and `Access-Control-Allow-Origin: *` (Canvagent runs on a different port, so the browser needs that header to let it read the response).

```json
{
  "canvagent": 1,
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
| `canvagent` | yes | Contract version. Must be `1`. |
| `name` | yes | The project's display name. |
| `frame.width`, `frame.height` | yes | Default frame size in CSS pixels (integers, 240 to 4096). |
| `groups[].id`, `groups[].title` | yes | One canvas row per group. Groups without screens are not drawn. |
| `groups[].label`, `groups[].description` | no | A short ordinal such as "01", and one line under the title. |
| `screens[].id` | yes | Unique across the whole manifest. Canvagent stores the selected screen by this id, so keep it stable. |
| `screens[].title` | yes | Shown above the frame and in the sidebar. |
| `screens[].caption` | no | A short line under the title: a persona, a state, a fixture name. |
| `screens[].route` | yes | A path on the project's own origin, starting with one `/`. Full URLs are rejected. |
| `screens[].width`, `screens[].height` | no | Override the default frame size for one screen. |
| `links[].id`, `links[].title`, `links[].route` | no | Other project pages, such as a UI library. See "Linked pages" below. Canvagent stores the open page by its id; the id `library` gets a library icon. |
| `links[].width` | no | The narrowest width the page is designed for, in CSS pixels (integer, 240 to 4096). With less room Canvagent lays the page out at this width and scales it down. Leave it out for a page that adapts to any width. |

Strings are limited to 200 characters. Unknown fields are ignored. An invalid manifest is rejected as a whole, and Canvagent says why.

**Derive the manifest from the project's own scenario data** instead of writing a second list by hand. Palier builds its manifest from the same module its own canvas reads (`src/components/canvas/screens.ts` and `canvagent.ts` there), and a test checks that the two agree. Marvin builds its manifest from its preview frame registry (`src/preview/frames.ts` and `manifest.ts` there), with the same kind of test.

## Names from before the rename

Canvagent was called Atelier until 2026-10-02. The manifest was then served at `/atelier.json`, with the version in a field named `atelier`. Canvagent still reads both: it asks for `/canvagent.json` first, and when a server answers without it, asks for `/atelier.json`; either version field is accepted. A project connected earlier therefore keeps working until it is updated.

This is a bridge, not part of the contract. New connections use the current names only, and the old ones stop being read once Palier's and Marvin's running previews serve the new address (`legacy-names` in `TODOS.md`).

## Preview routes

- **State comes from the URL alone.** The same route must render the same screen on every load: fixture, snapshot time and selection are named in the path or query. A preview must not read saved user preferences (local storage, cookies), the device clock or anything another preview could change.
- **Product only.** No canvas controls, scenario navigation, back-to-canvas links or prototype banners inside the page while it is framed. If the project shows such navigation on its standalone pages, hide it when framed. Palier does this with a small client check (`window.self !== window.top`) that sets `data-embedded` on the document, and one CSS rule.
- **Allow framing.** Do not send `X-Frame-Options` or a `frame-ancestors` policy that blocks `http://localhost:3200`.
- **Fit the declared frame.** The page is shown in an iframe of exactly the declared width and height. It may scroll inside the frame.
- **In-frame navigation is fine.** Product links work once a preview is entered. Canvagent cannot see where a preview has navigated; its reload control returns the frame to the manifest route.

Captures for a portfolio are taken from the project's own route in a browser window of the right size, not from Canvagent.

## Linked pages

When a manifest has `links`, Canvagent's sidebar opens with a page switcher: "Screens" for the canvas, then one entry per link. A linked page is shown whole, in a frame that fills the workspace, under a bar holding Canvagent's reload and open-in-a-new-tab controls.

- **Not a preview.** A linked page has no fixed frame size and is always interactive. Its state is its own business; Canvagent passes it nothing but its route.
- **Allow framing**, as for preview routes.
- **Keep the page's own navigation, hide the prototype's.** A library's section list belongs to the page and stays. A wordmark, a page switcher or a link back to the project's own canvas duplicates what Canvagent already shows; hide those when framed. Palier does this with the same `data-embedded` check as its previews. Marvin's library has only its section list and a logotype, and hides nothing.
- **Declare `width` if the page has a minimum width.** Marvin's library shares its product's 1280 px minimum and declares it; Palier's adapts and does not.

Canvagent keeps the canvas mounted underneath an open page, so previews and position are unchanged on return.

## Registering the project in Canvagent

Add or edit its entry in `src/registry.ts`: `id`, `name`, `origin` (for example `http://localhost:3300`) and, optionally, the folder and command that start its preview. An entry with `origin: null` appears as an empty project.

An optional `repo` names the project's main folder. Canvagent's dev server reads the local branches there for the sidebar's "Local branches" list, and never writes to it. This is outside the contract: the project provides nothing for it, and without `repo` the list says no folder is registered.

`VITE_ORIGIN_<ID>` in Canvagent's `.env.local` points a project at a different address without editing the registry, for example a worktree's preview on another port.

## How Canvagent reads a project's state

| What Canvagent finds | State | What it shows |
| --- | --- | --- |
| No `origin` registered | Empty | "No preview yet" and how to connect. |
| Nothing answers at the origin | Not running | The last manifest it saw, placeholder frames, and the start command when one is registered. It rechecks every 3 seconds and when the window regains focus. |
| A server answers, but the manifest is missing, unreadable or invalid | No manifest | The reason. Typical cause: the served branch does not include the connector. |
| A valid manifest | Live | The screens, loaded near the viewport. Rechecked every 10 seconds. |

## Not part of this contract yet

No messages pass between Canvagent and a preview. Because of that, Canvagent cannot receive keys pressed inside a preview, cannot turn a pinch gesture over an entered preview into a canvas zoom, and cannot show a preview's current route. A small script served by the project could close those gaps later; it would be an addition to this contract, not a change to it.
