# Plan: switch between branch previews

> **Status: proposal for Claude Code Opus 5.5 review, 2026-10-07.** Nicolas requested a code review, plan and review prompt, and clarified that Atelier should **prepare and start branch previews**, including branches that are not running. No feature implementation, project configuration or neighbouring repository change is included here. Code reviewed at `e0917b594f8311ca26d463527afb625518ca2586`.

## Recommendation

Make a branch selectable in Atelier and prepare its preview in an isolated, Atelier-owned worktree. Resolve the selected local branch to a full commit ID, create a detached checkout of that commit, run the project's explicitly configured preparation and start commands, and switch the canvas once the candidate is ready. Keep the current preview available during preparation and on failure.

This adds a narrowly scoped preview runner to the existing Node backend. Nicolas's clarification asks for that capability; the repository's restriction on unsolicited server management should not be interpreted as blocking this plan. It does not authorize implementing it in this planning session. At implementation, update the relevant repository rules and documentation to distinguish owned previews from existing project servers.

The first release must actually start a branch that has no running preview. A selector limited to existing ports would be useful groundwork but would not fulfill this request.

Use committed snapshots for this release. Display **branch + short commit**, with the full commit available in details. Changes in somebody else's working copy are not copied into the snapshot. Keep the registered external preview available as **Working preview** for reviewing ongoing edits; do not infer its branch from the registered repository. This snapshot choice is a recommendation for review, not an additional preference Nicolas has confirmed.

## What the current code establishes

| Finding | Evidence | Consequence |
| --- | --- | --- |
| Branches are an inventory, not preview targets. | `server/branches.ts:37` reads local refs and worktree metadata; `src/components/Branches.tsx:9` explicitly describes the list as read-only. | Making the rows clickable is insufficient. There is no launch operation or branch-to-server association. |
| A project has one origin and a display-only command. | `src/projects.ts:8`; `server/projects.ts:61`. | Add an optional managed-preview recipe, separate from the current `start` string. Preserve existing registry entries. |
| Address overrides intentionally drop repo/start from the browser's project. | `src/projects.ts`, `withOverrides`; `server/handler.ts` still reads branches in the registered repo. | Keep repository identity and preview target separate; never use an overridden address as proof of branch identity. |
| State and component lifetime are keyed by project alone. | `src/App.tsx`, `Projects`; `src/components/Workspace.tsx:30–65`; `src/storage.ts`. | A branch transition needs an explicit target identity, a fresh manifest and new preview instances. Otherwise stale screens, links and camera state can cross targets. |
| Status checks know only an origin. | `src/status.ts`, `checkProject`; `src/useStatuses.ts`. | HTTP availability and a valid manifest do not prove which code is being served. Guard async results by target and request generation. |
| Current APIs cannot mutate anything. | `server/request.ts`; `server/handler.ts`. | Add a separate, bounded mutation route; do not broadly relax the GET-only gate. |
| Native process ownership exists only for Atelier's helper and Git reads. | `macos/helper.mjs`; `server/branches.ts`, `cancelBranchReads`; `server/cli.ts`; `server/vite.ts`. | Extend one shared lifecycle implementation to all three hosts. Native wrapper behavior alone will not clean up CLI/Vite previews. |
| The branch list is capped at 200 refs. | `server/branches.ts`, `--count=200`. | Avoid silent incompleteness: show a truncation indicator or bounded pagination. Remote-only refs stay out of v1. |

These are implementation constraints for the requested feature, not claims that the existing read-only feature is broken. The current baseline passes typecheck and all 71 tests. No live branch runner or native lifecycle prototype has been tested in this review.

## User experience

**Job:** Nicolas reviews versions of a project's screens without leaving Atelier or disturbing an agent's checkout. This is an Operate surface within Atelier's established restrained UI. Existing components are the visual reference; no `PRODUCT.md` or `DESIGN.md` is present. Impeccable's context launcher was unavailable, so this proposal uses repository context and code, not a rendered UX verification.

- Put the current preview selector below the project name. The existing branch section supplies the choices, with one selection state; avoid two independent branch controls. Keep the current branch/commit visible in the canvas toolbar when the sidebar is hidden.
- Offer **Working preview** and local branches. Selecting a branch immediately shows **Preparing…**, then **Installing dependencies…** when applicable, **Starting…**, and **Loading screens…**. Keep the old canvas clearly labelled with its actual source throughout. Include Cancel, and prevent repeated clicks from creating duplicate jobs.
- Promote the candidate only after readiness succeeds. Update the source label, manifest, frame URLs and linked pages together. Announce completion accessibly and keep keyboard focus in Atelier. A successfully started server is not proof that every screen works; normal per-frame loading/failure behavior remains necessary.
- Show failures next to the requested branch with a concise reason and Retry. Offer bounded diagnostic output on demand. A branch without `/atelier.json` says **This branch is not connected to Atelier**; it does not borrow another branch's manifest. A project without a recipe says **Branch previews need setup** and points to its local configuration.
- Keep Device/Size unchanged when comparing branches within the same project. Reset them on project changes, as today. Exit any entered iframe on a successful branch switch. Retain the selected screen ID if the new manifest contains it, otherwise focus the first screen; fall back to Screens if a linked page disappeared.
- On refresh/focus, notice when the branch tip changes and offer **Update preview**. Do not silently replace the commit being reviewed. A deleted branch leaves an already-running snapshot labelled with its commit until the user switches away. Retrying or updating resolves the latest commit again and displays it explicitly.

No diff viewer, Git editing UI, branch creation, merging, fetching, pushing, side-by-side comparison, warm-server pool or plugin architecture is needed for this release.

## Proposed architecture

### 1. An explicit local recipe

Extend the machine registry with an optional `preview` configuration for a project. Keep executable recipes machine-local for v1; do not take them from the selected branch's `package.json` or its manifest automatically. The existing `start` string stays a copyable manual command.

The recipe needs a project-relative application directory (for monorepos), explicit preparation steps, a start executable and argument list, and an agreed port/host input. Use structured executable/argument arrays with no implicit shell, and a single literal port placeholder or environment variable. Resolve tools predictably under Finder as well as a terminal. Paths and arguments from the browser are never executable configuration. Validate the application directory stays inside the owned worktree, including symlink resolution.

Configure one real connected project first after reading its own rules. Do not guess npm versus pnpm, install a package manager, discover arbitrary scripts to execute, or assume every project has `package.json`. Check it exists in the correct directory before npm. Preparation may run a configured lockfile-respecting install automatically: opting the project into managed previews makes that behavior concrete. Package scripts and lifecycle hooks still execute project code; argument arrays are not a sandbox. Missing lockfiles, unsupported runtimes or unavailable private dependencies should fail with a useful explanation.

Use a separate dependency directory inside each snapshot. Never symlink another checkout's `node_modules`, mutate its lockfile or build into its output directory. Initially accept cold installs and ordinary package-manager caches; cross-worktree dependency caches can wait for measured need.

Environment support must be explicit: use configured local environment-file references or a named allowlist of variables, supplied at process launch where the project's tool supports it. Keep secret values out of the registry response, API output and logs. Do not automatically copy `.env*`, databases, uploads, credentials or ignored files from the working checkout. Prefer deterministic local fixture data; the recipe must define any required isolated mutable state. Unsupported environment loading should be reported, not improvised. Do not add general database/container/service orchestration.

### 2. Owned snapshots

The backend maps a registered project ID to its canonical repository, validates the requested exact local ref and resolves its full commit ID before creation. Generate opaque run IDs and safe directory names; branch names are labels, never path fragments. Use argument arrays, strip inherited Git routing variables and verify repository identity. Ignore a ref's display hash as an execution input.

Create a detached worktree at that commit under `~/Worktrees/<repo>/atelier-<run-id>`. Do not switch, stash, reset or clean an existing checkout; do not reuse another agent's worktree. Handle branches already checked out elsewhere by using the detached snapshot. Git documents detached worktrees for testing without disturbing existing development; linked worktrees still share repository metadata, so this is isolation of files, not a security sandbox. See [Git's worktree documentation](https://git-scm.com/docs/git-worktree).

No automatic fetching or local branch movement. An unborn repository, invalid/deleted ref or missing repository returns a specific failure before preparation. Initially fail explicitly on unsupported submodule/LFS requirements instead of downloading or initializing them unexpectedly; record which project actually needs expanded support.

### 3. One coordinator and a bounded launch lifecycle

Add a small framework-independent coordinator in `server/` used by Vite, the installed command and the Mac helper. Proposed state flow:

`resolving → preparing → starting → ready`, with `failed` and `cancelled` terminal outcomes and explicit owned-resource cleanup.

Start with **one selected managed server per Atelier backend instance**, plus one temporary candidate during a switch. After successful promotion stop the prior owned server and release its snapshot. Switching to Working preview stops the owned server once the UI has left it. There is no background pool per project. Separate app/CLI instances have unique runs and never adopt each other's processes or worktrees. Multiple browser tabs on one backend share the managed selection; all tabs must observe its revision so none continues presenting a server the coordinator has replaced.

Each operation has a run ID and generation. Deduplicate identical requests; a newer selection cancels the superseded candidate and waits for bounded cleanup before starting another. Cancel affects the candidate only. A disconnect alone must not create duplicate jobs on retry. Resolve operations from authoritative coordinator state after a browser reload. Preparation/startup deadlines and bounded output prevent indefinite waiting or memory growth.

Allocate from a configured local port range and require a strict bind with no fallback to another port. Never terminate the process occupying a port. Handle collisions by bounded allocation/retry, not a port-kill command. Bind previews only to loopback through the recipe.

Readiness must bind the answering server to the owned run. A free-port check followed by a valid manifest is insufficient because of the bind race or an unrelated listener. Before committing the design, prove one minimal method on the first project: a startup handshake tied to the spawned process and actual bound port, or a run nonce echoed through a narrowly scoped dev-only readiness response. If a connector addition is necessary, change its implementation and `docs/connector.md` together in the proper project worktree; do not inject Atelier controls into previews. Static production-build provenance is a separate case and is out of v1.

After owned-server readiness, validate the manifest using the existing parser and verify browser CORS/framing from both Atelier origins. Keep the old preview active if either step fails. Direct iframe origins preserve normal dev-server assets and WebSockets; no reverse proxy is proposed.

### 4. Mutation boundary and process cleanup

Keep the current read APIs read-only. Add start/cancel/stop operations using POST with bounded JSON bodies, exact schema validation and server-resolved IDs. Require the exact allowed Host/Origin, same-origin Fetch Metadata, and a per-instance mutation token obtainable only by Atelier's page. Reject cross-port preview requests, missing headers, arbitrary commands/paths/ports and unexpected methods before any filesystem or process action. Apply equivalent protection through Vite and the packaged server. Do not add a native script-message bridge. This protects against browser-origin attacks, not a malicious program already running as the user.

Own process groups, not merely the npm wrapper PID. Continuously drain bounded output; cancel setup, start and server descendants on replacement, stop, CLI/Vite shutdown, native close, helper EOF and app update. Use TERM then bounded KILL only for verified owned groups. Cover forced native-host exit using the helper's existing ownership pipe. Abrupt helper death needs an explicit design/probe: a child guardian or equivalent must prevent orphaned servers; do not assume Node exit automatically kills descendants.

Keep an ownership record for directories created by each run. Never adopt or kill a PID from a stale record after restart; process IDs can be reused. Recovery may report an interrupted run and verify its resources, but must not sweep ports or unrelated worktrees.

Remove snapshots only after their processes have stopped, ownership is verified, and tracked/untracked work is absent. Never force-remove a worktree. Generated ignored dependency/build files need a narrow, documented cleanup policy; unexpected files or commits preserve the folder and produce a recoverable message. Detached snapshots start from existing commits, so removal must not require pushing or moving the selected branch; protect any commits created inside the snapshot. Lock cleanup against concurrent launch/removal. Do not add broad Git pruning.

### 5. Separate preview identity from project identity

Use a stable project ID for the rail and repository lookup; use a distinct preview target for rendering and storage. At minimum the runtime target contains project ID, source kind, branch label if known, full commit, run ID, origin and coordinator revision. A branch name, checkout path and origin are not interchangeable identities.

Status responses and manifest caches must carry the target identity and generation. Abort/invalidate old checks at selection change; delayed results must never overwrite the new target. Remount the canvas/linked-page content on a successful target change, while lifting Device/Size above that boundary. Frame-local reload counters alone do not isolate target state.

Retain the old `atelier:v1` project view only for Working preview. Add a versioned, bounded set of managed views keyed by project and full commit (reuse across runs at the same commit); do not key them by ephemeral port. Keep screen/page selection only when valid in the destination manifest. Preserve a target's camera when returning to it, otherwise focus the shared selected screen or first screen. No automatic restart or dependency installation merely because localStorage names a branch: restoration shows a stopped selection with Start preview unless the coordinator still owns a live run.

An origin change resets iframe browsing context but does not guarantee isolated cookies: localhost cookies are not separated by port. Project previews must continue taking deterministic state from their route. Validate any real auth/fixture requirements without promising full browser-profile isolation.

## Implementation increments after review

1. **Prove launch and teardown on one project.** Use an owned temporary fixture repository for automated tests and one real connected project under its rules for acceptance. Settle the recipe, readiness proof, environment needs, process-tree death and snapshot cleanup. This is the first working part of the shared runner, not a disposable second backend. Prove a cold branch with no server starts without changing any existing checkout or server.
2. **Connect selection to the canvas.** Add coordinator APIs, branch selection, cancellation/progress/failure UI, atomic target promotion, branch-aware status and saved state, and multiple-tab synchronization. Cover a missing connector and slow/out-of-order results before calling switching complete.
3. **Finish all hosts and handoff.** Exercise Vite, the installed tarball and the bundled Mac app, including quit/update during install/start. Update connector documentation only for actual contract changes, plus local setup and ownership rules. Commit each finished increment; no merge, push or publication without instruction.

Increment 1 must settle readiness and child lifetime before the UI depends on the runner. Do not declare the feature complete after only a registry schema or clickable branch list.

## Acceptance evidence

| Scenario | Required evidence |
| --- | --- |
| Branch A → B → A, including a cold start | Correct branch/commit, manifest, frame URLs and linked pages; no inherited iframe navigation; Device/Size retained; valid selection restored. |
| Dirty active checkout and branch checked out elsewhere | Original HEAD, index, tracked/untracked files and running server unchanged; managed snapshot contains only its selected commit plus explicitly prepared artifacts. |
| Setup failure, timeout, missing connector, invalid manifest, occupied port, child exit | Previous preview remains usable and truthfully labelled; failed candidate resources are reaped or clearly preserved for recovery. |
| Repeated clicks, cancel, project switch, out-of-order replies, two tabs | No duplicate launches, stale promotion or manifest mixing; authoritative selection reaches both tabs. |
| Branch advances, is renamed/deleted, or has no commit | Snapshot remains accurately labelled; update is explicit; unavailable choices fail predictably. |
| Unexpected helper death, Cmd-Q/Cmd-W, app update, CLI/Vite exit | No owned server/install descendants survive; existing external servers remain available. Use real child/grandchild integration tests. |
| Host/origin/token/body validation | Negative browser/API tests perform no Git write, install or spawn; preserve existing GET protection. |
| Clean versus modified/unknown snapshot at cleanup | Remove only verified owned disposable content; preserve user work and never force/prune unrelated metadata. |
| Packaging and real browser/native behavior | Typecheck, unit/integration tests, required native tests/build, `npm pack` plus install/start from tarball. Verify real iframe/HMR and CORS/framing on 3200 and 3201; do not equate a 200 response with visual acceptance. |

## What Claude should challenge

The main tradeoff is snapshot reliability versus seeing uncommitted work. The proposed explicit Working preview entry covers the latter without copying dirty trees. Challenge that UX before building a second live-worktree mode.

The unresolved engineering choices are the smallest reliable readiness proof for the first project, abrupt-helper-death cleanup, and its exact preparation/environment recipe. Also challenge the single-server shared-tab policy and whether retaining per-commit camera state earns its complexity. Recommend a simpler alternative where it preserves automatic preparation, correct provenance and the repository boundaries.

Review prompt: [claude-branch-preview-review.md](claude-branch-preview-review.md). No Claude review has occurred yet.
