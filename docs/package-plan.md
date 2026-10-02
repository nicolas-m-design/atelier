# Plan: Atelier as an installable package

> **Summary:** A plan, not yet started, for turning Atelier into one npm package, `agent-atelier`, that a project adds as a development dependency, the way Agentation is installed. The package carries two things: the connector a project imports, and the workspace itself, started with one command. Written on 2026-10-02 at Nicolas's request. Nothing here is built, and publishing stays a separate, explicit decision.

## The name

The product is **Agent Atelier**, shortened to **Atelier** in the interface and in these documents. The package and the command are both `agent-atelier`. Decided by Nicolas on 2026-10-02, after a rename to "Canvagent" was made and undone the same day (see `CHANGELOG.md`).

The contract keeps its names: the manifest stays at `/atelier.json` with its version in the field `atelier`. Neither connected project changes.

**The command is never `atelier`.** An unrelated build tool owns the npm name `atelier` and installs a command of that name. `npx atelier` in a folder without this package would download and run that other tool. Every instruction therefore says `npx agent-atelier`.

## The target

Agentation (agentation.com) is installed with `npm install agentation -D`, mounted with one line in the app, and optionally paired with a local server started through `npx`. The same shape for Atelier:

```bash
npm install -D agent-atelier
```

```ts
// src/app/atelier.json/route.ts — the manifest
import { manifestResponse } from "agent-atelier";
import { atelierManifest } from "@/components/scenarios/atelier";

export const GET = () => manifestResponse(atelierManifest());
```

```tsx
// root layout — marks the page when it is shown inside Atelier
import { AtelierFrame } from "agent-atelier/react";

<AtelierFrame />
```

```bash
npx agent-atelier
```

That last command serves the workspace at http://localhost:3200 with the project it was run in.

**Where the comparison stops.** Agentation is an overlay drawn inside one app. Atelier is a separate page that frames several apps, and its rule that nothing it draws may appear inside a preview rules out an overlay. So the package has two halves: a connector that lives in the project, and a workspace that the command line starts. Agentation's annotations and MCP server have no counterpart here and stay out of scope.

**What the name promises.** "Agent Atelier" is aimed at people who design and build websites with AI, and the phrase is more often used for a workshop where agents are built. Atelier has no agent feature today: it shows what was built, whoever or whatever built it. The package's README should say that plainly.

## What stands in the way today

Found by reading the code on `work/first-milestone`.

| Obstacle | Where | Why it blocks a package |
| --- | --- | --- |
| The project list is compiled into the page | `src/registry.ts` | It holds two project names and absolute folders on Nicolas's machine. A package must read the list when it starts, and must not ship it. |
| Address overrides are read at build time | `src/projects.ts` (`VITE_ORIGIN_<ID>`) | A built package cannot read `.env.local`. |
| The branch endpoint exists only inside Vite | `server/branches.ts` (`configureServer`) | `npm run dev` is the only way to get it; a built copy says "Not available". |
| The workspace is run from source | `package.json` (`private`, no `bin`, `exports` or `files`) | Nothing to install or execute. |
| The connector is two hand-written files per project | Palier: `src/app/atelier.json/route.ts`, `src/components/workspace/EmbeddedPreview.tsx` (paths as on its branch `work/atelier-name-restored`). Marvin: its own route and manifest module | Each project repeats the CORS header, and neither validates its manifest with Atelier's own check (`parseManifest` in `src/manifest.ts`). |
| No licence file | repository root | Required before anything is published. The built page includes Inter (SIL Open Font Licence) and Lucide icons (ISC), which need their notices. |

What already helps: `answer()` and `readBranches()` in `server/branches.ts` do not depend on Vite, the manifest check has no dependencies, and the built page is about 500 kB.

## Design

One package, no monorepo. Three parts, all built into `dist/`.

### 1. The connector (what a project imports)

- **`agent-atelier`** (no framework): the manifest types, `parseManifest`, `defineManifest(manifest)` which checks and returns it, and `manifestResponse(manifest)` which returns a `Response` with the JSON and the open CORS header.
- **`agent-atelier/react`**: `<AtelierFrame />`, the client component that sets `data-embedded` on the document when the page is framed. It is Palier's `EmbeddedPreview.tsx`, moved; Palier now uses it for its UI library only, since its scenario pages keep their navigation bar when framed. The CSS that decides what to hide stays in each project.
- React is an optional peer dependency (18 or later), needed only by `/react`. No other runtime dependency.
- The contract version stays `1`. The package's own version number is separate from it.

Each project keeps deriving its manifest from its own scenario data and keeps its own test; the test can now call `parseManifest` too.

### 2. The workspace command (`agent-atelier`)

- A small Node server using only built-in modules: serves the built page from `dist/app`, the branch list at `/__atelier/branches/<id>`, and the project list at `/__atelier/projects`. Both endpoints keep the existing same-origin check. It listens on 127.0.0.1 only, port 3200, and fails if the port is taken, as now.
- The Vite plugin becomes a thin wrapper around the same request handler, so `npm run dev` in this repository behaves as before.
- This removes the known limit that the branch list needs the dev server.

### 3. The project list, read at start

- **Per project, in its own `package.json`:** `"atelier": { "origin": "http://localhost:3100", "start": "npm run dev" }`. The id defaults to the package name, which keeps `palier` and `marvin` and therefore the saved canvas positions.
- **Per machine, in `~/.config/agent-atelier/projects.json`:** a list of project folders, nothing else. `agent-atelier add` appends the current folder.
- **`npx agent-atelier` in a folder that is not listed** runs with that one project.
- `--origin palier=http://localhost:3101` replaces the `VITE_ORIGIN_<ID>` override for a worktree's preview.

Absolute paths then exist only in a file on the machine, never in the repository or the package.

### Build and contents

- `vite build` to `dist/app`; `tsc` with a second config for the server and the connector. No new build tool.
- React, Lucide and Inter move to development dependencies: the page is prebuilt, so installing the package adds no transitive dependency.
- `"files": ["dist", "README.md", "LICENSE"]`, one `bin` entry named `agent-atelier`, and `exports` for `.` and `./react`.
- `"private": true` stays until Nicolas decides to publish. It blocks `npm publish` and does not block `npm pack`.

## Steps

Each step is one increment, committed on a work branch, with `docs/connector.md` and the README changed in the same commit as the code.

| Step | What | Done when |
| --- | --- | --- |
| 0 | Settle the open decisions below. Delete the leftover `VITE_ORIGIN_PALIER` line (`palier-env-override`). Update the scope lines in `AGENTS.md` and the README, which still exclude an installer and a connector package. | Nicolas has answered; Atelier shows Palier live on 3100. |
| 1 | Move the project list out of the page: runtime endpoint, `package.json` field, machine-level list. Extract the request handler from the Vite plugin. | `npm run dev` works as today with no project named in `src/`. Typecheck and tests pass, with new tests for reading the list. |
| 2 | Add the `agent-atelier` command and the package build. | `npm pack`, then the tarball run from an empty folder serves the workspace on 3200 with the branch list working. The tarball contains no `/Users/` path and no project name (checked with `npm pack --dry-run` and a search of `dist`). |
| 3 | Add the connector entry points. | Types resolve from a project on TypeScript 5.9 (Palier) as well as 7. `<AtelierFrame />` keeps its `"use client"` line in the built file. |
| 4 | Adopt it in Palier, then Marvin, from the tarball. In Palier: a work branch in a worktree under `~/Worktrees/palier/`, replacing the route's header code and `EmbeddedPreview.tsx`. Read each project's `AGENTS.md` first, and the Next.js guide in its `node_modules/next/dist/docs/`. | Palier: typecheck, the same test result as before the change, production build lists `/atelier.json`; framed pages behave as its documents say. Marvin: its manifest test passes. Both show live in Atelier started with `npx agent-atelier`. |
| 5 | Publish, only on Nicolas's explicit instruction. | See "Publishing". |

Steps 1 to 3 change only this repository. Step 4 changes two neighbouring projects and needs their rules followed; Marvin is not a Git repository, so its change cannot be isolated on a branch.

## Decisions for Nicolas

| Decision | Options | Recommendation |
| --- | --- | --- |
| Package name | **Decided, 2026-10-02: `agent-atelier`.** Unclaimed on the npm registry that day, as was `agentatelier`, so npm's rule against names that differ only by punctuation does not block it. | Before publishing, check the registry again and check trademarks: a name is not reserved until something is published under it. See "What the name is up against". |
| How it is distributed | (a) Public npm. (b) Straight from the private GitHub repository: `npm install -D github:nicolas-m-design/atelier`, which needs a build-on-install script. (c) A local tarball. | (c) for steps 2 to 4, then (b) if only your machines use it, (a) if others should. Only (a), or a paid private registry, gives the exact `npm install agent-atelier` of Agentation. |
| Licence | MIT, or none (all rights reserved, private use only) | Needed only for (a). |
| Whether the manifest route answers in production builds | Always, or only when a flag is set | Always, as now: Palier's preview on 3100 is a production build. It lists titles and routes only. |

### What the name is up against

Found on 2026-10-02 through the npm registry, GitHub, DNS records and a web search. This is not a trademark search.

- About ten small GitHub repositories are named agent-atelier, mostly kits for building agents.
- "The Agent Atelier" (theagentatelier.com) teaches people to build agents. "Atelier Agent" is a Windows desktop workspace for coding agents.
- "Atelier" alone is used by an AI agent marketplace, an "agentic workspace" and an AI website builder app.
- agentatelier.com and agent-atelier.com are registered. The .dev, .ai and .app names had no DNS record, which does not prove they are free.

None of this blocks a private or local package. For a public one, the name is usable and not distinctive.

## Publishing

Publishing makes the package public and cannot be fully undone: an unpublished version number stays burnt. It needs an explicit instruction, and Nicolas runs `npm login` and `npm publish` himself, since they need his credentials.

Before that:

- A README written for a stranger: no local paths, no neighbouring project named without Nicolas agreeing to it, and `npx agent-atelier` wherever a command is shown.
- The licence file and third-party notices.
- `npm publish --dry-run`, and the tarball searched again for `/Users/`, `.env` and source maps.
- The `repository` field left out while the GitHub repository is private.

## Not in this plan

- Annotations, an MCP server, webhooks: Agentation's other half. Still out of scope.
- Messages between a preview and Atelier (Escape, pinch, current route: `preview-keys`, `preview-pinch`). `<AtelierFrame />` is where that script would go later, as an addition to the contract.
- A canvas component mounted inside a project. It would be the closest match to Agentation's one-line mount, but it needs Atelier's styles isolated from the host app's. Worth its own plan once the package exists.
- Starting or stopping project servers, a plugin system, thumbnails.

## What was checked for this plan

Read on 2026-10-02: this repository's source and documents; Palier's and Marvin's connector files; Agentation's home and install pages; the npm registry for the names above and for Agentation's package shape (React 18 or later as its only peer dependency, a separate `agentation-mcp` package for its server). Nothing in the plan was built or run. The design is a proposal, not a tested result.
