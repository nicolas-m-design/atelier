# Local setup

> **Summary:** What is specific to the machine Atelier is developed on: which projects are listed there, where they answer, and leftovers to clear. Kept out of `README.md`, which goes into the package, so that the package names no project and no local folder. Not part of the package.

## The projects listed on Nicolas's machine

`~/.config/agent-atelier/projects.json` lists three projects, as complete entries. It was created on 2026-10-02 with the first two; before that those were a constant in the code. Yutugy was added the same day with `agent-atelier add`.

| Project | Address Atelier expects | Start it with |
| --- | --- | --- |
| Palier | http://localhost:3100 | `npm run dev` in `/Users/nico/Sites/palier` |
| Marvin | http://localhost:3210 | `npm run dev` in `/Users/nico/Sites/marvin` |
| Yutugy | http://localhost:3000 | `node --env-file=.env.local dev.mjs` in `/Users/nico/Sites/yutugy-portfolio` |

No project has an `atelier` field in its `package.json`, and none has `agent-atelier` installed.

Yutugy is listed but not connected: it has no `package.json` (its id, `yutugy`, is in the list), and it does not serve `/atelier.json`, so Atelier shows it as "No manifest" when it runs and has no screens to draw. Nothing in its folder was changed.

## Palier

Palier's connector is part of its `main` since 2026-10-02, so the server on 3100 serves `/atelier.json`. The separate worktree and its preview on port 3101 no longer exist.

Palier no longer keeps a canvas of its own: Nicolas had it removed on 2026-10-02, so Atelier is the only canvas for its screens. The removal is in Palier's `main`: port 3100 redirects `/` to Palier's first screen.

## In the Claude desktop app

The preview uses `.claude/launch.json` (`atelier-dev`), from a session opened on this folder. A session opened on another project's folder reads that project's launch file instead.

The same file has `marvin-dev`, which runs Marvin's own `npm run dev` from `/Users/nico/Sites/marvin` on port 3210, so that a session here can start Marvin when Nicolas asks. It changes nothing in Marvin, and it names a folder that exists on this machine only.
