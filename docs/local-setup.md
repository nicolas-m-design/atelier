# Local setup

> **Summary:** What is specific to the machine Atelier is developed on: which projects are listed there, where they answer, and leftovers to clear. Kept out of `README.md`, which goes into the package, so that the package names no project and no local folder. Not part of the package.

## The projects listed on Nicolas's machine

`~/.config/agent-atelier/projects.json` lists four projects, as complete entries. It was created on 2026-10-02 with the first two; before that those were a constant in the code. Yutugy was added the same day with `agent-atelier add`, and Krux on 2026-10-05.

| Project | Address Atelier expects | Start it with |
| --- | --- | --- |
| Palier | http://localhost:3100 | `npm run dev` in `/Users/nico/Sites/palier` |
| Marvin | http://localhost:3210 | `npm run dev` in `/Users/nico/Sites/marvin` |
| Yutugy | http://localhost:3000 | `node --env-file=.env.local dev.mjs` in `/Users/nico/Sites/yutugy-portfolio` |
| Krux | http://localhost:3220 | `npm --prefix /Users/nico/Worktrees/krux/atelier-connector/web run dev -- --port 3220`, from any folder |

No project has an `atelier` field in its `package.json`, and none has `agent-atelier` installed.

Yutugy is listed but not connected: it has no `package.json` (its id, `yutugy`, is in the list), and it does not serve `/atelier.json`, so Atelier shows it as "No manifest" when it runs and has no screens to draw. Nothing in its folder was changed.

## Palier

Palier's connector is part of its `main` since 2026-10-02, so the server on 3100 serves `/atelier.json`. The separate worktree and its preview on port 3101 no longer exist.

Palier no longer keeps a canvas of its own: Nicolas had it removed on 2026-10-02, so Atelier is the only canvas for its screens. The removal is in Palier's `main`: port 3100 redirects `/` to Palier's first screen.

## Krux

Krux is the studio's website. Its repository is `/Users/nico/Sites/design-agency`, a folder not named after it; the app is in `web/` there, and its `main` is checked out at `/Users/nico/Worktrees/krux/main` for merging only.

Its connector is on the branch `claude/atelier-connector-2026-10-05`, in the worktree `/Users/nico/Worktrees/krux/atelier-connector`, and is not in its `main`. Only a dev server started from a checkout with that branch serves `/atelier.json`; from any other, Krux shows as "No manifest". The manifest is served by the dev server only and is never part of the site's build.

For that reason its start command in the list names the worktree's folder in full. The first entry had `npm --prefix web run dev -- --port 3220`, to be run in the main folder; that folder is on an older branch, and the command run there on 2026-10-05 gave a server without the manifest.

Krux has port 3220 to itself. Its dev server would otherwise take 3000, where Yutugy is listed.

Its previews keep two things the contract rules out: a theme restored from the browser's storage, and a clock showing the current time.

## In the Claude desktop app

The preview uses `.claude/launch.json` (`atelier-dev`), from a session opened on this folder. A session opened on another project's folder reads that project's launch file instead.

The same file has `marvin-dev`, which runs Marvin's own `npm run dev` from `/Users/nico/Sites/marvin` on port 3210, so that a session here can start Marvin when Nicolas asks. It changes nothing in Marvin, and it names a folder that exists on this machine only.

`krux-dev` does the same for Krux, from the worktree `/Users/nico/Worktrees/krux/atelier-connector` on port 3220. That folder goes away once Krux's branch is merged, and the entry has to name another checkout then.


## Palier cold branch-preview check (2026-10-07)

Nicolas selected Palier for the first internal runner check. This did not change the machine registry or make branch selection available in the app. The runner exported `main` at `1591aacbc9d4e39abaa53fc7de5ffca18a3d944c` under Atelier test namespace 3298 and used this explicit recipe:

```js
{
  dir: ".",
  requires: ["package.json", "package-lock.json"],
  prepare: [["npm", "ci", "--no-audit", "--no-fund"]],
  start: [process.execPath, "node_modules/next/dist/bin/next", "dev",
    "--hostname", "127.0.0.1", "--port", "{port}"],
  env: { NEXT_TELEMETRY_DISABLED: "1", PALIER_DEV_ORIGIN: "127.0.0.1" }
}
```

This invokes Next directly because `npm run dev` fixes port 3100. A new export with its own installed dependencies reached manifest readiness; `/scenarios/photo-1/accueil` returned HTTP 200, and the manifest allowed the app's localhost:3201 origin via its existing `*` CORS header. The original HEAD, tracked/untracked status, worktree inventory and 3100 listener matched before/after. The owned preview was stopped and its export removed. This was a server/process acceptance check, not visual or HMR verification. No `.env` files, existing dependencies or project servers were copied, replaced or stopped.
