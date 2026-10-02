# Local setup

> **Summary:** What is specific to the machine Atelier is developed on: which projects are listed there, where they answer, and leftovers to clear. Kept out of `README.md`, which goes into the package, so that the package names no project and no local folder. Not part of the package.

## The projects listed on Nicolas's machine

`~/.config/agent-atelier/projects.json` lists two projects, as complete entries. It was created on 2026-10-02; before that the same two were a constant in the code.

| Project | Address Atelier expects | Start it with |
| --- | --- | --- |
| Palier | http://localhost:3100 | `npm run dev` in `/Users/nico/Sites/palier` |
| Marvin | http://localhost:3210 | `npm run dev` in `/Users/nico/Sites/marvin` |

Neither project has an `atelier` field in its `package.json`, and neither has `agent-atelier` installed.

## Palier

Palier's connector is part of its `main` since 2026-10-02, so the server on 3100 serves `/atelier.json`. The separate worktree and its preview on port 3101 no longer exist.

Palier no longer keeps a canvas of its own: Nicolas had it removed on 2026-10-02, so Atelier is the only canvas for its screens. That removal is on Palier's branch `work/atelier-name-restored`; until it is in Palier's `main`, port 3100 still serves the old canvas at `/`.

## A leftover to delete

If `.env.local` in this repository still holds the line below, delete it: it points Palier at 3101, where nothing answers, and Atelier under `npm run dev` then shows Palier as not running. The packaged command does not read `.env.local`.

```
VITE_ORIGIN_PALIER=http://localhost:3101
```

## In the Claude desktop app

The preview uses `.claude/launch.json` (`atelier-dev`), from a session opened on this folder. A session opened on another project's folder reads that project's launch file instead.
