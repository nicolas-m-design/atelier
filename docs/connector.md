# Connecting a project to Atelier

> **Summary:** The contract between Atelier and a project: one JSON manifest at `/atelier.json`, and preview routes that behave well inside a frame. Palier implements it; Marvin can adopt it when its app exists. There is no package to install yet; a project implements these two things in its own code.

## What a project provides

1. **A manifest** at `<origin>/atelier.json`, readable from another local origin.
2. **Preview routes**: ordinary pages of the project's own app, one per screen, that render the product only and take their state from the URL.

Atelier provides everything else: the project rail, the sidebar, the canvas, labels, selection and controls. None of that is ever drawn inside a preview.

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
  "links": [{ "id": "library", "title": "UI library", "route": "/ui" }]
}
```

| Field | Required | Meaning |
| --- | --- | --- |
| `atelier` | yes | Contract version. Must be `1`. |
| `name` | yes | The project's display name. |
| `frame.width`, `frame.height` | yes | Default frame size in CSS pixels (integers, 240 to 4096). |
| `groups[].id`, `groups[].title` | yes | One canvas row per group. Groups without screens are not drawn. |
| `groups[].label`, `groups[].description` | no | A short ordinal such as "01", and one line under the title. |
| `screens[].id` | yes | Unique across the whole manifest. Atelier stores the selected screen by this id, so keep it stable. |
| `screens[].title` | yes | Shown above the frame and in the sidebar. |
| `screens[].caption` | no | A short line under the title: a persona, a state, a fixture name. |
| `screens[].route` | yes | A path on the project's own origin, starting with one `/`. Full URLs are rejected. |
| `screens[].width`, `screens[].height` | no | Override the default frame size for one screen. |
| `links[]` | no | Other project pages, such as a UI library. Atelier opens them in a new tab. |

Strings are limited to 200 characters. Unknown fields are ignored. An invalid manifest is rejected as a whole, and Atelier says why.

**Derive the manifest from the project's own scenario data** instead of writing a second list by hand. Palier builds its manifest from the same module its own canvas reads (`src/components/canvas/screens.ts` and `atelier.ts` there), and a test checks that the two agree.

## Preview routes

- **State comes from the URL alone.** The same route must render the same screen on every load: fixture, snapshot time and selection are named in the path or query. A preview must not read saved user preferences (local storage, cookies), the device clock or anything another preview could change.
- **Product only.** No canvas controls, scenario navigation, back-to-canvas links or prototype banners inside the page while it is framed. If the project shows such navigation on its standalone pages, hide it when framed. Palier does this with a small client check (`window.self !== window.top`) that sets `data-embedded` on the document, and one CSS rule.
- **Allow framing.** Do not send `X-Frame-Options` or a `frame-ancestors` policy that blocks `http://localhost:3200`.
- **Fit the declared frame.** The page is shown in an iframe of exactly the declared width and height. It may scroll inside the frame.
- **In-frame navigation is fine.** Product links work once a preview is entered. Atelier cannot see where a preview has navigated; its reload control returns the frame to the manifest route.

Captures for a portfolio are taken from the project's own route in a browser window of the right size, not from Atelier.

## Registering the project in Atelier

Add or edit its entry in `src/projects.ts`: `id`, `name`, `origin` (for example `http://localhost:3300`) and, optionally, the folder and command that start its preview. An entry with `origin: null` appears as an empty project.

`VITE_ORIGIN_<ID>` in Atelier's `.env.local` points a project at a different address without editing the registry, for example a worktree's preview on another port.

## How Atelier reads a project's state

| What Atelier finds | State | What it shows |
| --- | --- | --- |
| No `origin` registered | Empty | "No preview yet" and how to connect. |
| Nothing answers at the origin | Not running | The last manifest it saw, placeholder frames, and the start command when one is registered. It rechecks every 3 seconds and when the window regains focus. |
| A server answers, but the manifest is missing, unreadable or invalid | No manifest | The reason. Typical cause: the served branch does not include the connector. |
| A valid manifest | Live | The screens, loaded near the viewport. Rechecked every 10 seconds. |

## Not part of this contract yet

No messages pass between Atelier and a preview. Because of that, Atelier cannot receive keys pressed inside a preview, cannot turn a pinch gesture over an entered preview into a canvas zoom, and cannot show a preview's current route. A small script served by the project could close those gaps later; it would be an addition to this contract, not a change to it.
