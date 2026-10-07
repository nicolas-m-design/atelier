# Plan: switch between branch previews

> **Status: first runner increment implemented, 2026-10-07; API/UI integration remains next.** Nicolas confirmed that Atelier should **prepare and start branch previews**, including branches that are not running. This document incorporates the review he relayed. Nicolas subsequently authorized the runner increment, chose Palier, and accepted committed-only snapshots and one managed preview at a time. The original runtime baseline is `e0917b594f8311ca26d463527afb625518ca2586`; Claude recorded the review in `d1fd57c` after reviewing `786b8d1` (documentation-only changes).

## Recommendation

Make a branch selectable in Atelier and prepare its preview from an Atelier-owned **archive export**. Resolve the selected local branch to a full commit ID, export it with `git archive <commit>`, run the project's explicitly configured preparation and start commands under a guardian, and switch the canvas once the candidate is ready. Keep the current preview available during preparation and on failure. V1 targets macOS only.

This adds a narrowly scoped preview runner to the existing Node backend. Nicolas's clarification asks for that capability; the repository's restriction on unsolicited server management should not be interpreted as blocking this plan. The first increment now supplies an internal runner; it is not wired into the app or registry. Existing project servers remain externally owned.

The first release must actually start a branch that has no running preview. A selector limited to existing ports would be useful groundwork but would not fulfill this request.

Use committed snapshots for this release. Display **branch + short commit**, with the full commit available in details. Changes in somebody else's working copy are not copied into the snapshot. Keep the registered external preview available as **Working preview** for reviewing ongoing edits; do not infer its branch from the registered repository. Nicolas confirmed this snapshot choice before implementation.

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

These are implementation constraints for the requested feature, not claims that the existing read-only feature is broken. The original baseline passed typecheck and all 71 tests. Claude reports disposable process-group, guardian, listener-ownership, Git and Vite probes in `CHANGELOG.md`, plus passing web and Mac tests. Those findings inform this revision; Codex has since verified the runner with real process-level fixture tests and a cold Palier export. See the implementation record below; Claude’s other probes remain attributed findings.

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

Extend the machine registry with optional `preview` configuration. Keep it machine-local; do not automatically adopt commands from a selected branch or its manifest. The existing `start` string remains a manual command. The recipe has exactly these responsibilities:

| Field | Meaning |
| --- | --- |
| `dir` | Application directory relative to the export root; all steps run here. Validate containment, including symlinks. |
| `requires` | Files that must exist inside that directory before any command runs, such as `package.json` and the package manager's lockfile. Missing files fail the run. |
| `prepare` | Ordered executable/argument arrays, such as a lockfile-respecting dependency install. No implicit shell or package-manager guessing. |
| `start` | Executable/argument array containing the required literal `{port}` placeholder. Replace it with the system-assigned port; configure an explicit loopback host and strict port binding. |
| `env` | Explicit process environment entries for this recipe. No environment-file loading or automatic `.env*` copying in v1; keep values out of browser responses and diagnostics. |

Resolve executables predictably under Finder and the terminal. Commands and paths never come from mutation request bodies. Check all `requires` before preparation; also require a `package.json` in the effective working directory before any npm invocation. The review reports `/Users/nico/package.json` exists, so a missing package inside an export beneath the home directory can redirect npm into the parent. Do not rely on npm failing because this snapshot has no package. The separate correction to the repository's older parent-folder wording remains recorded in `TODOS.md`.

Dependencies and generated output stay inside the disposable export; do not share another checkout's `node_modules` or build output. Configured installs may use their ordinary package-manager cache. No automatic package-manager installation, service/database orchestration, credential copying or dependency-cache framework. Package scripts still execute project code: this is not a security sandbox.

For the first real project, inspect its rules and startup script before specifying the recipe. Claude found that Palier's `dev` script fixes the Working preview's port; blindly invoking it would defeat `{port}`. Nicolas selected Palier for the first cold-start check; its tested recipe is in `docs/local-setup.md`.

### 2. Disposable archive exports

Map the registered project ID to its canonical repository, validate the exact local branch ref and resolve its full commit ID. Generate an opaque run ID; branch labels never become paths. Run `git archive <commit>` and extract into:

`~/.cache/agent-atelier/previews/<atelier port>/<run id>/`

The namespace uses **Atelier's** port, not the ephemeral preview port. No `.git` directory or linked-worktree registration is created. Archive extraction must stay inside the newly created owned directory, including handling paths and symlinks safely. Use argument arrays, clear inherited Git routing variables and verify repository identity. No fetching, branch movement, checkout, stash, reset, clean or worktree creation/removal.

This replaces the original worktree proposal. Claude's probes found shared repository config/hooks, worktree-list noise and removal failures after a tool modified a tracked file. An export is disposable even when preparation rewrites a source file. It contains committed exported content, not another checkout's dirty state or ignored files. Tools requiring Git metadata may be incompatible; report their preparation failure rather than quietly attaching the real repository. Submodule/LFS detection and support are out of v1.

After the guardian has stopped, delete only the verified owned export. There is no Git-cleanliness gate and no `--force` worktree removal. These directories are caches, not editing workspaces. Leftover cleanup must be limited to this cache namespace, validate ownership/containment and avoid live runs of any instance; establish that behavior in process-level tests. Do not record PIDs or use stale process IDs to clean up. Do not scan or delete neighbouring worktrees.

### 3. Guardian and coordinator

Add `server/previews.ts` and a small guardian. Each run executes every step under its guardian, which owns its process group and watches a private stdin pipe from the coordinator. **Closing stdin makes the guardian kill its own process group**, including preparation and server descendants. The coordinator must retain exclusive ownership of the pipe's write end; a child inheriting it would prevent EOF after coordinator death.

The guardian must survive long enough to perform bounded termination/escalation of its children. Normal cancellation/disposal closes the pipe; coordinator `SIGKILL` also closes it. Do not signal a recorded PID after restart. Continuously drain bounded output and bound preparation/startup times. A plain detached child group is insufficient: Claude's probe showed it survives its parent's death, whereas the guardian ended it within 300 ms in that probe. That is reported evidence, not an acceptance measurement for future code.

Expose an idempotent dispose operation on the coordinator. Vite integration must dispose on **`httpServer` close**, including restart: Claude observed that restart can create a second handler in the same process, so process exit alone is insufficient. CLI and Mac hosts use the same coordinator/guardian mechanism; the existing native helper ownership pipe remains in place. App quit/update and helper death must also end all managed runs without touching external servers.

State flow: `resolving → preparing → starting → ready`, with `failed` and `cancelled` outcomes and bounded cleanup. Deduplicate identical requests. A new selection cancels the superseded candidate before launching another; Cancel affects the candidate only. Keep one active managed server plus one temporary candidate per backend, as confirmed by Nicolas. On promotion, retire the previous owned run. Separate Atelier ports have separate cache namespaces; multiple tabs on one backend share its state.

### 4. System-assigned port and readiness

Ask the system for an available local port, then pass the assigned number via the required `{port}` in `start` argv. If allocation uses a temporary listener that is closed before the child binds, that leaves a race: readiness must detect it. Require strict binding without silent fallback, bounded allocation retries, and loopback listeners. Never stop a port's existing occupant.

Use macOS `lsof` with machine-readable `-Fpgn` output, filtered for TCP listeners on the assigned port. Require at least one listener and verify that **every** listener belongs to the run's live process group, including IPv4/IPv6 and bound addresses. Fail closed on unavailable/incomplete ownership data, a foreign listener or a non-loopback bind. Do not mistake “one matching listener” for “all listeners match.” Keep the guardian/run alive while validating; reject stale or exited runs.

Only then fetch `/atelier.json` from the selected origin **on the server**, with a timeout and bounded response, and validate it using the existing manifest parser. A failed ownership check, missing/invalid manifest or exited run cannot promote. Check ownership remains valid through readiness/promotion, and test the bind-race/foreign-listener case. The active run carries this validated manifest. No readiness nonce, connector addition or new preview endpoint is proposed.

Direct iframe origins preserve the project's dev-server assets and WebSockets. Later browser/native acceptance must still verify real framing and CORS behavior on 3200 and 3201; a server-side fetch does not prove either. This remains the existing connector contract.

### 5. One authoritative state and target identity

Maintain **one server state with a monotonically increasing revision**. It contains the active run and candidate/failure state. The active run includes project ID, run ID, branch label, full commit, origin and validated manifest. Publish/promote that tuple atomically. All tabs consume the same revision; do not derive “active” independently from localStorage or whichever status request last finished.

Tag status results by target and request generation. Discard delayed results from a retired target. Keep ordinary Working preview status checks separate from managed-run state; a failed managed run never borrows the Working preview manifest.

Key the **inner workspace by run ID**, resetting canvas, linked-page and iframe lifetime on promotion. Keep Device/Size above that boundary so comparison retains them within one project. Preserve an outgoing selected screen/page ID only if it exists in the new manifest; otherwise focus the first screen or show Screens. Frame-local reload counters alone cannot isolate runs.

Drop per-commit saved views from v1. Existing `atelier:v1` persistence continues for Working preview only; managed views are transient and must not overwrite it. A browser reload may reconnect to the coordinator's live run, but saved browser state never starts an install or server. Branch movement produces an explicit Update preview choice; it does not mutate the running snapshot.

One preview port is not a separate browser profile. Project routes retain responsibility for deterministic preview state; do not promise cookie/auth isolation between localhost ports.

### 6. Later API boundary

The first increment has **no API or UI**. When wiring them later, keep read endpoints GET-only and add narrow POST operations with bounded JSON and exact schema validation. Require the exact allowed Host and Origin plus same-origin Fetch Metadata in shared code, before any action; reject missing headers, cross-port preview requests and arbitrary command/path/port input. No mutation token in v1. No native script-message bridge. These defend the browser boundary, not a hostile program running as the user.

## Implementation sequence

1. **Runner and guardian only — done.** Add `server/previews.ts`, the guardian and process-level tests using a disposable fixture repository. Cover cold start, `kill -9` of the coordinator, foreign listeners, missing manifest and leftover cleanup, along with cancellation, required-file checks and tracked-file rewrites inside the export. Then perform one real cold start on Palier, after reading its rules. Nicolas authorized this increment; it includes no API or UI.
2. **Lifecycle and selection integration.** Wire disposal into Vite's `httpServer` close and the CLI/Mac lifecycle; exercise Vite restart. Add revisioned APIs, branch selection, progress/cancel/failure handling and atomic promotion. Key the inner workspace by run ID, lift Device/Size and tag status results. Verify multiple tabs and stale replies. No per-commit persistence.
3. **Complete macOS-host acceptance.** Exercise Vite, the installed tarball and bundled Mac app, including quit/update during preparation/start. Check real iframe/HMR behavior and document the recipe and disposable cache policy. Commit finished increments, update handoff/changelog and run the required package/native checks when those files change. No merge, push or publication without instruction.

Keep v1 macOS-only. Explicitly excluded: mutation token, per-commit views, environment files, configured port range, submodule/LFS detection, non-macOS support, connector changes, Git editing, comparisons, warm-server pools and general service orchestration.

## Acceptance evidence

| Scenario | Required evidence |
| --- | --- |
| Branch A → B → A, including a cold start | Correct branch/commit, manifest, frame URLs and linked pages; no inherited iframe navigation; Device/Size retained; valid selection restored. |
| Dirty active checkout and branch checked out elsewhere | Original HEAD, index, tracked/untracked files and running server unchanged; managed snapshot contains only its selected commit plus explicitly prepared artifacts. |
| Setup failure, timeout, missing connector, invalid manifest, occupied port, child exit | Previous preview remains usable and truthfully labelled; failed candidate resources are reaped or clearly preserved for recovery. |
| Repeated clicks, cancel, project switch, out-of-order replies, two tabs | No duplicate launches, stale promotion or manifest mixing; authoritative selection reaches both tabs. |
| Branch advances, is renamed/deleted, or has no commit | Snapshot remains accurately labelled; update is explicit; unavailable choices fail predictably. |
| Unexpected helper death, Cmd-Q/Cmd-W, app update, CLI/Vite exit | No owned server/install descendants survive; existing external servers remain available. Use real child/grandchild integration tests. |
| Host/origin/body validation | Negative browser/API tests perform no Git write, install or spawn; preserve existing GET protection. |
| Modified export and interrupted-run cleanup | Tool-rewritten source files do not block disposal; remove only owned disposable cache content, never a live sibling run or an external directory. No recorded PIDs. |
| Packaging and real browser/native behavior | Typecheck, unit/integration tests, required native tests/build, `npm pack` plus install/start from tarball. Verify real iframe/HMR and CORS/framing on 3200 and 3201; do not equate a 200 response with visual acceptance. |

## Implementation record and review history

Nicolas approved all three proposed defaults and the first implementation increment: Palier first, committed-only snapshots, one active managed preview plus a replacement candidate. The existing Working preview remains the route to uncommitted work.

`server/previews.ts` exposes `createPreviewRunner`, with start/cancel/stop/dispose, revisioned state and stale-cache cleanup. `server/previewGuardian.ts` owns Git/export, preparation, listener checks, manifest validation and server lifetime. Cache run directories contain `source/` (the export) and `owner.json`; a private per-run Unix socket under `/tmp` supplies a live lease without recording PIDs. Only marked, unleased directories are eligible for cleanup. Unknown/unmarked folders and symlinks are preserved. Source rewrites inside a disposable export do not prevent cleanup.

Eleven process tests cover cold starts/replacement, dirty working-copy isolation, missing files/manifests, path containment, cancellation and supersession, preparation timeout, foreign IPv4 and mixed owned-IPv4/foreign-IPv6 listeners, coordinator SIGKILL during preparation/serving, and cleanup that preserves live sibling runs and unknown directories. The runner passes from source and from an installed tarball, including its compiled guardian. Palier `main` at `1591aac` cold-started with a fresh dependency install; its manifest and first screen responded successfully and the original checkout/worktree list/3100 listener were unchanged. The owned server/export were removed afterward.

Limits of this increment: no registry recipe parsing or HTTP API, no UI, no Vite-close/CLI/Mac lifecycle wiring, and no visual/HMR acceptance. Hosts must eventually call dispose at their documented lifecycle boundaries. The guardian handles coordinator death now; directly killing the guardian itself or a recipe deliberately daemonizing outside its group is outside the trusted-recipe model. Recipes must keep descendants in the group. Child output is drained but not exposed, to avoid printing dependency credentials; richer bounded diagnostics are deferred. System port allocation is one attempt per start; a collision fails safely and can be retried without killing its occupant. This increment does not add automatic collision retries.

The next increment is lifecycle/API/UI integration, with the Vite `httpServer` close requirement unchanged. The installed app has not been updated with this internal runner.

The original [review prompt](claude-branch-preview-review.md) is retained as historical context; it describes the superseded worktree proposal. Claude's probe findings are recorded in the 2026-10-07 review entry in `CHANGELOG.md`. The full review was returned in Claude's session; this revision incorporates the essential changes Nicolas relayed and has not received a second review.
