# Plan: Atelier as an installable package

> **Summary:** A plan, not yet started, for turning Atelier into one npm package that a project adds as a development dependency, the way Agentation is installed. The package carries two things: the connector a project imports, and the workspace itself, started with one command. Written on 2026-10-02 at Nicolas's request. Nothing here is built, and publishing stays a separate, explicit decision.

## The target

Agentation (agentation.com) is installed with `npm install agentation -D`, mounted with one line in the app, and optionally paired with a local server started through `npx`. The same shape for Atelier, with `atelier-canvas` as a working name (see "Decisions"):

```bash
npm install -D atelier-canvas
```

```ts
// src/app/atelier.json/route.ts — the manifest
import { manifestResponse } from "atelier-canvas";
import { atelierManifest } from "@/components/canvas/atelier";

export const GET = () => manifestResponse(atelierManifest());
```

```tsx
// root layout — marks the page when it is shown inside Atelier
import { AtelierFrame } from "atelier-canvas/react";

<AtelierFrame />
```

```bash
npx atelier
```

That last command serves the workspace at http://localhost:3200 with the project it was run in.

**Where the comparison stops.** Agentation is an overlay drawn inside one app. Atelier is a separate page that frames several apps, and its rule that nothing it draws may appear inside a preview rules out an overlay. So the package has two halves: a connector that lives in the project, and a workspace that the command line starts. Agentation's annotations and MCP server have no counterpart here and stay out of scope.

## What stands in the way today

Found by reading the code on `work/first-milestone` at `da89a1e`.

| Obstacle | Where | Why it blocks a package |
| --- | --- | --- |
| The project list is compiled into the page | `src/registry.ts` | It holds two project names and absolute folders on Nicolas's machine. A package must read the list when it starts, and must not ship it. |
| Address overrides are read at build time | `src/projects.ts` (`VITE_ORIGIN_<ID>`) | A built package cannot read `.env.local`. |
| The branch endpoint exists only inside Vite | `server/branches.ts` (`configureServer`) | `npm run dev` is the only way to get it; a built copy says "Not available". |
| The workspace is run from source | `package.json` (`private`, no `bin`, `exports` or `files`) | Nothing to install or execute. |
| The connector is two hand-written files per project | Palier: `src/app/atelier.json/route.ts`, `src/components/canvas/EmbeddedPreview.tsx`. Marvin: its own route and manifest module | Each project repeats the CORS header, and neither validates its manifest with Atelier's own check (`parseManifest` in `src/manifest.ts`). |
| No licence file | repository root | Required before anything is published. The built page includes Inter (SIL Open Font Licence) and Lucide icons (ISC), which need their notices. |

What already helps: `answer()` and `readBranches()` in `server/branches.ts` do not depend on Vite, the manifest check has no dependencies, and the built page is about 500 kB.

## Design

One package, no monorepo. Three parts, all built into `dist/`.

### 1. The connector (what a project imports)

- **`atelier-canvas`** (no framework): the manifest types, `parseManifest`, `defineManifest(manifest)` which checks and returns it, and `manifestResponse(manifest)` which returns a `Response` with the JSON and the open CORS header.
- **`atelier-canvas/react`**: `<AtelierFrame />`, the client component that sets `data-embedded` on the document when the page is framed. It is Palier's `EmbeddedPreview.tsx`, moved. The CSS that decides what to hide stays in each project.
- React is an optional peer dependency (18 or later), needed only by `/react`. No other runtime dependency.
- The contract version stays `1`. The package's own version number is separate from it.

Each project keeps deriving its manifest from its own scenario data and keeps its own test; the test can now call `parseManifest` too.

### 2. The workspace command (`atelier`)

- A small Node server using only built-in modules: serves the built page from `dist/app`, the branch list at `/__atelier/branches/<id>`, and the project list at `/__atelier/projects`. Both endpoints keep the existing same-origin check. It listens on 127.0.0.1 only, port 3200, and fails if the port is taken, as now.
- The Vite plugin becomes a thin wrapper around the same request handler, so `npm run dev` in this repository behaves as before.
- This removes the known limit that the branch list needs the dev server.

### 3. The project list, read at start

- **Per project, in its own `package.json`:** `"atelier": { "origin": "http://localhost:3100", "start": "npm run dev" }`. The id defaults to the package name, which keeps `palier` and `marvin` and therefore the saved canvas positions.
- **Per machine, in `~/.config/atelier/projects.json`:** a list of project folders, nothing else. `atelier add` appends the current folder.
- **`npx atelier` in a folder that is not listed** runs with that one project.
- `--origin palier=http://localhost:3101` replaces the `VITE_ORIGIN_<ID>` override for a worktree's preview.

Absolute paths then exist only in a file on the machine, never in the repository or the package.

### Build and contents

- `vite build` to `dist/app`; `tsc` with a second config for the server and the connector. No new build tool.
- React, Lucide and Inter move to development dependencies: the page is prebuilt, so installing the package adds no transitive dependency.
- `"files": ["dist", "README.md", "LICENSE"]`, a `bin` entry named `atelier`, and `exports` for `.` and `./react`.
- `"private": true` stays until Nicolas decides to publish. It blocks `npm publish` and does not block `npm pack`.

## Steps

Each step is one increment, committed on a work branch, with `docs/connector.md` and the README changed in the same commit as the code.

| Step | What | Done when |
| --- | --- | --- |
| 0 | Settle the open decisions below. Delete the leftover `VITE_ORIGIN_PALIER` line (`palier-env-override`). Update the scope lines in `AGENTS.md` and the README, which still exclude an installer and a connector package. | Nicolas has answered; Atelier shows Palier live on 3100. |
| 1 | Move the project list out of the page: runtime endpoint, `package.json` field, machine-level list. Extract the request handler from the Vite plugin. | `npm run dev` works as today with no project named in `src/`. Typecheck and tests pass, with new tests for reading the list. |
| 2 | Add the `atelier` command and the package build. | `npm pack`, then the tarball run from an empty folder serves the workspace on 3200 with the branch list working. The tarball contains no `/Users/` path and no project name (checked with `npm pack --dry-run` and a search of `dist`). |
| 3 | Add the connector entry points. | Types resolve from a project on TypeScript 5.9 (Palier) as well as 7. `<AtelierFrame />` keeps its `"use client"` line in the built file. |
| 4 | Adopt it in Palier, then Marvin, from the tarball. In Palier: a work branch in a worktree under `~/Worktrees/palier/`, replacing the route's header code and `EmbeddedPreview.tsx`. Read each project's `AGENTS.md` first, and the Next.js guide in its `node_modules/next/dist/docs/`. | Palier: typecheck, the same test result as before the change, production build lists `/atelier.json`; framed pages hide their navigation and unframed pages keep it. Marvin: its manifest test passes. Both show live in Atelier started with `npx atelier`. |
| 5 | Publish, only on Nicolas's explicit instruction. | See "Publishing". |

Steps 1 to 3 change only this repository. Step 4 changes two neighbouring projects and needs their rules followed; Marvin is not a Git repository, so its change cannot be isolated on a branch.

## Decisions for Nicolas

| Decision | Options | Recommendation |
| --- | --- | --- |
| Package name | `atelier` is taken on npm (an unrelated build tool, 0.2.0). Unclaimed on 2026-10-02: `atelier-canvas`, `atelier-workspace`, `atelier-dev`. A scoped name such as `@<your-npm-account>/atelier` is also possible. | A scoped name under your own npm account: no collision, and it can be private or public. The command stays `atelier` either way. Check any public name for conflicts first. |
| How it is distributed | (a) Public npm. (b) Straight from the private GitHub repository: `npm install -D github:nicolas-m-design/atelier`, which needs a build-on-install script. (c) A local tarball. | (c) for steps 2 to 4, then (b) if only your machines use it, (a) if others should. Only (a), or a paid private registry, gives the exact `npm install <name>` of Agentation. |
| Licence | MIT, or none (all rights reserved, private use only) | Needed only for (a). |
| Whether the manifest route answers in production builds | Always, or only when a flag is set | Always, as now: Palier's preview on 3100 is a production build. It lists titles and routes only. |

## Publishing

Publishing makes the package public and cannot be fully undone: an unpublished version number stays burnt. It needs an explicit instruction, and Nicolas runs `npm login` and `npm publish` himself, since they need his credentials.

Before that:

- A README written for a stranger: no local paths, no neighbouring project named without Nicolas agreeing to it.
- The licence file and third-party notices.
- `npm publish --dry-run`, and the tarball searched again for `/Users/`, `.env` and source maps.
- The `repository` field left out while the GitHub repository is private.

## Not in this plan

- Annotations, an MCP server, webhooks: Agentation's other half. Still out of scope.
- Messages between a preview and Atelier (Escape, pinch, current route: `preview-keys`, `preview-pinch`). `<AtelierFrame />` is where that script would go later, as an addition to the contract.
- A canvas component mounted inside a project. It would be the closest match to Agentation's one-line mount and could answer the open question about Palier's built-in canvas (`palier-canvas-future`), but it needs Atelier's styles isolated from the host app's. Worth its own plan once the package exists.
- Starting or stopping project servers, a plugin system, thumbnails.

## What was checked for this plan

Read on 2026-10-02: this repository's source and documents; Palier's and Marvin's connector files; Agentation's home and install pages; the npm registry for the names above and for Agentation's package shape (React 18 or later as its only peer dependency, a separate `agentation-mcp` package for its server). Nothing was built or run. The design is a proposal, not a tested result.
