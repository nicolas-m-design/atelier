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

Palier no longer keeps a canvas of its own: Nicolas had it removed on 2026-10-02, so Atelier is the only canvas for its screens. The removal is in Palier's `main`: port 3100 redirects `/` to Palier's first screen.

## In the Claude desktop app

The preview uses `.claude/launch.json` (`atelier-dev`), from a session opened on this folder. A session opened on another project's folder reads that project's launch file instead.
