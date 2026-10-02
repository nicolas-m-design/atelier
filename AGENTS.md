# Atelier — rules for working here

> **Summary:** The rules for this repository, for humans and AI agents alike. Atelier is local presentation tooling shared by several projects; the main risks are changing a neighbouring project by accident and letting the tool grow into a platform.

## Read first

1. `TODOS.md` — the handoff note and open work.
2. `CHANGELOG.md` — the latest entries.
3. `docs/connector.md` — the contract with connected projects.

## Boundaries

- **Atelier holds no product code.** A project's screens, styles and data stay in that project. Atelier reads a manifest and frames the project's own pages.
- **Neighbouring projects are separate repositories with their own rules.** Read a project's `AGENTS.md` before touching it, work in a separate worktree there, and never edit its active checkout or replace its running server. Do not build Marvin's application from here.
- **Presentation controls stay outside previews.** Nothing Atelier draws may appear inside a frame or in a project's captures.
- **Previews are deterministic.** A screen's state comes from its route. Atelier's saved preferences must never reach a preview.
- **No project in the code.** Projects are listed in a file on the machine (`README.md`, "The project list"). No project's name, address or folder goes into `src/` or `server/`.
- **Keep it small.** No plugin system, server management, annotations or collaboration without Nicolas asking for it. The installable package he asked for on 2026-10-02 follows `docs/package-plan.md`, one step at a time. Change `docs/connector.md` and the code together, and only when a real project needs the change.

## Working rules

- **Check that `package.json` exists before running npm.** `/Users/nico/Sites` has its own `package.json`; an npm command run here without one installs into that parent folder.
- **Only stop or restart processes you started yourself.**
- **Uncommitted changes you did not make belong to someone else.** Leave them alone.
- **Commit each finished increment** on a work branch. Merging into `main`, adding a remote, pushing and publishing need an explicit instruction from Nicolas.
- **No passwords, keys or tokens** in this repository. `.env.local` holds local addresses only and is not committed.

## Finishing a session

- Update `TODOS.md` and append to `CHANGELOG.md`: what changed, and what the next person would get wrong without knowing it.
- Run `npm run typecheck` and `npm test`. After a change to `server/`, the build or `package.json`, also run `npm pack` and try the command from the tarball: a test cannot tell whether the package installs and starts.
- Keep `README.md` free of project names and local folders: npm packs it. Those belong in `docs/local-setup.md`.
- Commit.
