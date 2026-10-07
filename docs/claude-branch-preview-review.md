# Review prompt for Claude Code Opus 5.5

Paste the following into Claude Code Opus 5.5 with Atelier as the working directory. This asks for an independent review and recommendation, not implementation.

```text
Review the proposed branch-preview feature in /Users/nico/Sites/atelier.

Nicolas wants to select branches inside Atelier and explicitly confirmed:
“Prepare and start branch previews.” Selecting already-running servers alone
does not satisfy the request. We are reviewing the plan before implementation.

Read AGENTS.md, TODOS.md, the latest CHANGELOG.md entries, docs/connector.md,
docs/branch-preview-plan.md and macos/README.md. Then inspect the actual code;
do not treat the plan's assertions as established facts. The reviewed code
baseline was e0917b594f8311ca26d463527afb625518ca2586; check the current HEAD
and flag any material drift.

Focus on:
- server/{branches,projects,request,handler,serve,cli,vite}.ts
- src/{branches,projects,useBranches,useProjects,useStatuses,status,storage}.ts
- src/App.tsx and src/components/{Branches,Workspace,Canvas,Frame,Page}.tsx
- macos/helper.mjs, its tests, and the native quit/update lifecycle
- tests/{branches,projects,command,storage,manifest}.test.ts

The proposal is a small shared Node coordinator. On branch selection it
resolves a local branch to an exact commit, creates an owned detached worktree,
runs an explicit machine-local preparation/start recipe, proves readiness,
then switches the preview. It preserves the previous preview on failure.
It proposes one active managed server plus a temporary candidate, with shared
selection across tabs of a backend instance. Working preview remains an
external target whose branch is unknown. Managed snapshots omit uncommitted
changes and offer an explicit update when a branch advances.

Evaluate this as a personal local tool. Be strict about correctness and scope,
but do not turn it into a Git client, general process manager, plugin system,
container platform or remote preview service. Automatic preparation/startup
is requested; do not reject it solely because the old rules prohibited
unsolicited server management.

Review these questions specifically:
1. Does the snapshot model meet the actual review workflow? Would another
   model better support it without changing an active checkout or taking
   ownership of another session's server? Compare the real tradeoffs.
2. What is the minimum per-project recipe needed for cold worktrees,
   lockfiles/dependencies, monorepos, environment/fixture data, strict ports
   and Finder's PATH? What should fail explicitly rather than be guessed?
3. Can readiness prove the answering origin belongs to the selected run?
   Pick a concrete minimum design. A free-port probe or valid manifest alone
   does not establish ownership. Does the connector actually need a change?
4. Does cleanup handle install and server descendants, races, cancellation,
   helper death, app update and PID reuse without touching unrelated work?
   Resolve the abrupt-helper-death gap with the smallest proven mechanism.
5. Identify every place project-only identity could mix statuses, manifests,
   links, frames, camera state or persistence across branches. Specify an
   atomic switch and stale-response strategy, including multiple tabs.
6. Are POST/Host/Origin/Fetch Metadata/token boundaries sufficient across
   Vite, CLI and WKWebView? Can a framed project trigger command execution?
   Distinguish browser-origin defenses from a same-user local adversary.
7. Is the UI clear about current versus preparing branch, exact commit,
   uncommitted work, unavailable connector, error recovery and branch updates?
   Preserve Device/Size during comparison and keep controls outside frames.
8. Which complexity can be deleted now? Which unresolved choices block the
   first working increment? Consider shared-tab selection, view persistence,
   cleanup policy, unsupported platforms and resource bounds explicitly.

Return:
- Verdict: proceed, proceed with changes, or reconsider.
- Findings ordered by importance. Cite current file:line evidence and a
  concrete failure scenario; distinguish an existing bug from a future risk
  and a decision the plan already leaves open.
- A recommended v1 with explicit exclusions and resolved design choices.
- The smallest implementation sequence, with files affected and meaningful
  acceptance tests. Prioritize a real cold branch launch and safe teardown.
- Only questions that truly require Nicolas's judgment; make engineering
  recommendations for the rest.
- A short reply Nicolas can paste back to Codex containing your verdict,
  essential plan changes and the precise first increment to implement.

Review only. Do not implement, rewrite project configuration, install
dependencies, start/stop real project servers, edit neighbouring repositories,
merge, push or publish. Read their rules before any scoped inspection there.
Safe disposable fixtures and existing tests are acceptable if useful; report
what you actually ran and keep hypotheses distinct from reproduced failures.
Do not claim that this review itself authorizes implementation.
```
