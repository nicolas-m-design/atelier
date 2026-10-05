# Plan: Atelier as a small Mac app

> **Status:** Proposal for Claude Opus review, written 2026-10-05. No Mac app has been implemented or benchmarked. Nicolas confirmed: his Mac only for now; Atelier must open without starting it in a terminal. The existing workspace is the UI. Performance, simplicity and a small footprint take priority over distribution features.

## Recommendation

Build a **Swift/AppKit window containing one `WKWebView` and Atelier's existing production React build**. Keep the canvas, project rail, sidebar and project-owned iframes. Implement only the small amount of native functionality needed to read the project registry, read Git branches, save workspace state and handle Mac window behavior.

The intended installed app needs neither a running Atelier server nor Node at runtime. Node remains a build tool and remains available to the existing browser/CLI workflow. Project preview servers continue to be started separately: opening Atelier does not start, restart or stop them.

This is a provisional architecture recommendation, not a claim that WebKit is already compatible or faster. **First prove the real workspace in a small WebKit prototype, before porting the server functions.** Use one bounded prototype to decide whether this direction is worth continuing. If the app needs extensive browser workarounds, reconsider the shell instead of turning this into a native framework project.

The recommendation is specific to a Mac-only tool with two small local read services. Tauri is a credible second choice, especially if its packaging and bridge remove more maintenance than they add. A full native UI rewrite has no justification in this brief.

## What exists today

Inspected at `2f97fbc` on `work/first-milestone`; this planning document is on `codex/macos-app-plan`.

| Area | Current implementation | Consequence for the app |
| --- | --- | --- |
| UI | React/Vite; `src/App.tsx`, `src/components/Workspace.tsx` | Reuse it. Do not create a second screen implementation. |
| Registry | `server/projects.ts`, `src/projects.ts`; file under `~/.config/agent-atelier/projects.json` | Read the same file and preserve IDs, defaults, validation and errors. |
| Branches | `server/branches.ts`, `src/branches.ts` | Two bounded, read-only Git commands, addressed by registered project ID. |
| Local API | `server/handler.ts`, `server/request.ts`, `server/serve.ts` | Today the UI needs same-origin HTTP endpoints. A webview alone cannot replace them. |
| Preview data | `src/status.ts`, `src/manifest.ts` | Fetch each project's `/atelier.json`; preview pages stay on their original origins. |
| Preview cost | `src/components/Canvas.tsx` | Nearby-frame mounting already exists, with `MAX_LIVE_FRAMES = 12`. Preserve it. |
| Project lifetime | `src/App.tsx` | Only the active project's workspace is mounted. A linked page keeps that project's canvas mounted underneath. |
| Polling | `src/useStatuses.ts`, `src/useBranches.ts` | Status checks every 10 seconds when all are live, otherwise 3 seconds; hidden-document checks are already skipped. Branches refresh when expanded and on focus. |
| Persistence | `src/storage.ts` | `atelier:v1`, validated on read, writes debounced by 250 ms. Browser storage is specific to its origin/profile. |
| Package work | `docs/package-plan.md` | Steps 1–2 done; connector steps remain separate. The Mac app need not wait for connector publication. |

The local machine reports Apple Silicon and macOS 27.0, with Xcode selected. Initial support and testing can target this machine; there is no need to promise Intel or older macOS support. Atelier was not answering on port 3200 during research. UI behavior was inspected in source; no live visual or performance result is claimed.

## Research that changes the plan

Read on 2026-10-05. Official guidance establishes platform behavior; builders' posts provide experience reports, not controlled benchmarks. Dates below identify the material, not a claim that every recommendation was introduced this year.

| Evidence | What it means here |
| --- | --- |
| Apple's current [Windows guidance](https://developer.apple.com/design/human-interface-guidelines/windows) recommends system window controls and warns against custom window chrome. | Use real traffic lights and standard resizing/fullscreen. Keep the existing workspace below a modest native title bar. |
| Apple's [Designing for macOS](https://developer.apple.com/design/human-interface-guidelines/designing-for-macos/) emphasizes keyboard input, menus and flexible windows. | Implement the small set of expected Mac actions; do not equate “simple UI” with removing normal window behavior. |
| [Use SwiftUI with AppKit and UIKit, WWDC26](https://developer.apple.com/videos/play/wwdc2026/272/) explicitly supports incremental adoption and mixed frameworks. | AppKit is a reasonable host. There is no need to rewrite the workspace in SwiftUI to qualify as a Mac app. This is our application of that guidance. |
| [Power and Performance Group Lab, WWDC26](https://developer.apple.com/videos/play/wwdc2026/8003/) stresses measurement, application state, deferred launch work and avoiding redundant redraws. | Measure startup, canvas interaction and hidden-window behavior separately. Use local Instruments recordings; no analytics service is needed. |
| Apple's older, still useful [energy guidance](https://developer.apple.com/library/archive/documentation/Performance/Conceptual/power_efficiency_guidelines_osx/BestPractices.html) recommends idle behavior, limited timers and work off the main thread. | Preserve existing visibility checks; verify their behavior in a native window. Avoid background Git/network loops when closed or hidden. |
| [Tauri's architecture](https://v2.tauri.app/concept/architecture/) uses the system webview rather than shipping a browser engine. [Electron's own comparison](https://www.electronjs.org/docs/latest/why-electron) explains both its bundled Chromium/Node cost and its rendering consistency benefits. | A system-webview shell is the first candidate for a small install. This does not establish which renderer will pan Atelier faster. |

Three useful first-person builder reports from social media:

- **Tandem's builder, February 2026:** reports a lighter app and faster startup after moving from Electron to Tauri. Useful evidence that this architecture can work; the post supplies no comparable workload measurements. [Reddit report](https://www.reddit.com/r/tauri/comments/1qzaqfy/switched_from_electron_to_tauri_v2_for_my/).
- **Hopp's builder, 2026:** reports WebKit rendering/audio limitations in a screen-sharing app; the linked retrospective explains the problems. Some concern Linux WebKitGTK and video, which are not Atelier's workload. The relevant lesson is to test actual content early. [Reddit report](https://www.reddit.com/r/javascript/comments/1q6hts7/we_chose_tauri_over_electron_18_months_later/), [builder's retrospective](https://www.gethopp.app/blog/hate-webkit).
- **Abstand's builder, July 2026:** reports that React in the Mac webview worked well, while native feel required deliberate work and a Swift/AppKit layer. Their glass treatment used a private mechanism. For Atelier, keep standard window chrome and the current opaque UI rather than borrowing that complexity. [Reddit report](https://www.reddit.com/r/webdev/comments/1utc0lt/i_built_an_opensource_mac_app_website_blocker/).

These reports disagree in useful ways. They support a compatibility prototype and measurement, not a blanket “Tauri/native is fast, Electron is slow” conclusion. Social research here is limited to accessible Reddit posts by the builders; no claim of a wider social-media consensus.

## Options considered

| Option | Benefit for Atelier | Cost or limitation | Decision |
| --- | --- | --- | --- |
| Swift/AppKit + WKWebView + narrow native services | Existing UI, system browser engine, direct control of one Mac window, no runtime Node/server | Native bridge and parity with existing registry/Git semantics become our responsibility | Preferred, subject to the prototype and Opus review |
| Tauri 2 + existing React + Rust services | Established asset loading, IPC, packaging and Mac integration | Adds Rust/Tauri tooling; Node services still need replacing or a sidecar; still WebKit on Mac | Alternative if it materially simplifies the actual implementation |
| Swift shell + existing Node server | Maximum backend reuse; can launch without a terminal if the app owns the helper | Runtime discovery or bundled Node, process cleanup, listening port, startup handshake | Fallback if native service duplication proves disproportionate |
| Electron + existing React/Node | Reuses most code and supplies a controlled Chromium version | Bundled runtime and larger install; still needs careful iframe isolation | Reconsider if a real WebKit blocker warrants it |
| Full SwiftUI/AppKit workspace rewrite | Native workspace controls | Rebuilds working canvas behavior; previews still need a web engine | Excluded |
| Browser “install as app” / URL wrapper | Very little work | Does not independently supply the registry/Git backend | Insufficient for the agreed launch behavior |

Do not implement these alternatives in parallel. Only investigate the next option when a named blocker rejects the preferred one. Tauri cannot fix a WebKit rendering bug merely by changing the shell.

## The window and everyday behavior

One resizable primary window, with the current interface filling its content area. Use a standard native title bar, traffic lights and the existing document title. Begin with a practical size around 1280 × 900 points, constrained to the available display, and validate a minimum around 900 × 600 against the current sidebar. These are prototype defaults, not new layout requirements.

- Preserve current colors, typography, project navigation and canvas controls. No new dashboard, welcome screen, duplicate native sidebar or decorative glass layer.
- Restore window bounds within the displays currently connected. Support normal minimize, fullscreen, tiling, Cmd-H and Cmd-Q.
- Cmd-W closes the window; the app may remain in the Dock with its webview released and no polling. Clicking the Dock icon reopens the single window with saved state. Cmd-Q ends all app-owned work. Closing never stops project servers.
- Supply standard app, Edit and Window menus. Preserve copy/paste/select-all in editable content through the normal responder chain. Add a small View menu for existing actions only, such as reloading Atelier and showing/hiding the sidebar.
- Route “open in a new tab” actions to the default browser and label them “Open in browser” in the Mac build. Ordinary project links continue navigating inside an entered preview. Handle explicit new-window links without creating more privileged Atelier windows.
- Preserve keyboard focus and visible focus indicators. Check Tab, Enter, Escape, trackpad pan/pinch, mouse wheel, text selection in previews and VoiceOver. An app-level shortcut must not casually steal a project's typing or editing commands.
- Keep current offline, empty and invalid-manifest states. A native launch/renderer failure needs a small recoverable message with Retry, not a blank white window.

The connector's existing in-frame Escape/pinch limitations remain recorded limitations unless separately addressed. Native wrapping must not silently inject scripts into projects to “fix” them.

No accounts, onboarding, analytics, payments, marketing pages, App Store work, updater service, launch-at-login, menu-bar companion, collaboration, annotations or project-server management. Build a local `.app`; replace it manually when rebuilding.

## Proposed technical boundary

Add a small `macos/` app target and reuse the output of the current web build as bundle resources. Keep the browser and npm command working. Do not add a monorepo, plugin system or a general desktop abstraction.

**Loading the UI.** Prototype a private asset origin such as `atelier-app://app/` using Apple's [WKURLSchemeHandler](https://developer.apple.com/documentation/webkit/wkurlschemehandler). It is an asset-loading API, not proof that HTTP frames, fetch, storage or secure-context APIs will behave as they do on localhost. Register only that custom scheme, serve only bundled assets, reject traversal and cancel abandoned requests. Do not use private WebKit preferences or disable web security.

**This is the first gate:** load the actual built UI from the intended origin and test HTTP localhost manifests, project iframes, fonts, module assets, CSS, hot reload/WebSockets and linked pages. Inspect frame-ancestor/CORS restrictions and redirects. `docs/connector.md` currently promises framing from `http://localhost:3200`; a custom scheme is a contract change, even if today's pages happen to allow it. Record the exact new origin only after it is proven; update the contract with the implementation. Changes needed in connected repositories require their own worktrees and rules, not edits to active checkouts from here.

If the custom origin is incompatible, stop before building the native services. Review a loopback origin using the existing Node handler as the fallback; do not invent an HTTP server merely to preserve the preferred diagram. A fallback decision must specify the runtime, port collision behavior, authentication, persistence and owned-process lifecycle. Never attach a privileged bridge to an arbitrary process already answering on port 3200, and never kill it to obtain the port.

**Reading local data.** Introduce two narrow frontend transport functions where `useProjects.ts` and `useBranches.ts` currently fetch Atelier's HTTP endpoints. Browser mode keeps those endpoints; Mac mode uses a typed native request/reply bridge. Everything above that boundary keeps the current TypeScript validation and rendering.

- Native registry reading must match `server/projects.ts`: complete objects and folder entries, package metadata/defaults, duplicates, missing/invalid files and partial errors. Port these semantics against shared fixtures drawn from existing tests. Do not independently reinterpret the format.
- Finder launch has no dependable shell working directory or login-shell environment. Default to the existing machine registry. Do not auto-discover a project from the app's working directory. CLI-only `--origin`, cwd discovery and Vite `.env.local` remain CLI/dev features; document that distinction. Any Mac registry override must be explicit and persisted, not dependent on shell startup files.
- Native branch reading accepts a listed project ID, resolves its folder itself and runs the same two Git commands with argument arrays. Preserve the 3-second timeout, output bound, ceiling directory, no-lock setting and error states. Use the system Git explicitly on this Mac; missing Git yields the existing failure UI. Work runs off the main thread, concurrent reads for a repo are coalesced, and only owned subprocesses can be cancelled.
- Prefer reusing pure TypeScript parsing where practical; if Swift duplicates parsing, require parity fixtures rather than a second evolving contract. Do not expose arbitrary file paths, shell strings or executable names as bridge operations.

**Preview isolation.** Treat every framed project as untrusted relative to the native app. Native handlers verify the actual sending webview, main-frame status and exact bundled UI URL/origin; a JavaScript flag is not authentication. Apple exposes the sending frame through [WKScriptMessage.frameInfo](https://developer.apple.com/documentation/webkit/wkscriptmessage/frameinfo) and [WKFrameInfo](https://developer.apple.com/documentation/webkit/wkframeinfo). Reject subframe requests and top-level navigation away from bundled content. Validate message types, arguments and sizes; constrain native responses. Test that a hostile iframe cannot read the registry, run Git or overwrite saved state.

Keep manifests and previews fetched from project origins, with browser framing/CORS rules intact. Use narrowly justified local networking configuration, guided by [NSAllowsLocalNetworking](https://developer.apple.com/documentation/bundleresources/information-property-list/nsapptransportsecurity/nsallowslocalnetworking); test it on the actual OS. ATS settings do not override CORS, CSP or mixed-content rules. Do not broadly enable arbitrary web loads as a shortcut.

**Saving state.** The app will not automatically share Safari/Chrome local storage. Default to its own state, keeping the `atelier:v1` schema and project IDs. For the custom-scheme build, use a bounded native state file under the app's Application Support folder, hydrated before the workspace mounts, and reuse `parseSaved` plus the existing debounce. Save atomically; flush on window close/quit with a bounded acknowledgement. This avoids making custom-scheme localStorage persistence a prerequisite. Window bounds belong in native preferences. Preview cookies/storage stay in WebKit's app-specific data store and never receive Atelier's preferences. Browser-state import is optional future work, not part of first launch.

**Recovery.** Handle web-content-process termination and failed asset loads. Offer one retry path that restores validated Atelier state; avoid infinite reload loops. Do not promise to restore transient form edits inside a crashed preview. Use a local non-App-Store build appropriate to this Mac; test launching from Finder after moving the built app out of the repository. No dependency on Vite, the source folder or a terminal session.

## Performance: what to measure and what to preserve

The largest variable is the live project pages. WebKit has content/network processes; measuring just the small Swift host would be misleading. Compare the same projects, routes, viewport, zoom and number of mounted frames across the current browser and candidate app. Report app-related processes together, and project development servers separately.

Proposed targets below are **engineering budgets for review, not measured results or framework promises**. Record the Mac/OS, release build, display refresh rate and warm/cold conditions. Adjust a budget only with a recorded reason.

| Check | Initial acceptance target |
| --- | --- |
| Startup | Usable shell within 1 second on warm launch and 2 seconds on cold launch; preview/server readiness measured separately. Record at least five launches of each kind. |
| Canvas | Aim for a 60 fps frame budget during a repeatable pan/zoom path; inspect frame-time distributions and visible stalls with five and twelve representative frames. No repeatable shell-induced stalls over 100 ms. |
| Idle | Empty app settles near zero CPU; target under 1% of one core averaged over a minute. Attribute live-project animation separately. |
| Hidden/closed | No Atelier polling or Git refresh while hidden/minimized/closed. Verify WebKit visibility/occlusion behavior rather than assuming a browser tab's semantics. |
| Memory | Record total footprint for zero, five and twelve frames. After 20 project switches and repeated open/close cycles, no monotonic retained growth; compare settled snapshots rather than demand immediate OS reclamation. |
| Bundle | Aim below 30 MB for the local release `.app`, excluding system WebKit and build tools. Measure installed size; do not substitute compressed download size. |

Preserve the existing 12-frame cap, active-project mounting, validation and debounced writes. Profile before changing them. Test 20–30 manifest entries to ensure the cap still bounds live frames. Keep project checks asynchronous so an offline server cannot delay the window. Keep branch work demand-driven. If hidden preview pages continue consuming substantial CPU, measure a deliberate suspension/unmount policy and document the loss of transient preview state before adopting it. Do not silently change linked-page/canvas retention or assume hidden iframes stop running.

Use Instruments Time Profiler/Allocations and Web Inspector, plus Activity Monitor for a coarse check. Keep results locally in a short table; no telemetry infrastructure. Thumbnails, a custom renderer and a canvas rewrite remain out unless a measured bottleneck requires a separate decision.

## Implementation increments after review

Each completed increment gets its own commit, a handoff update and the repository checks. These are ordered gates, not a promise to build every alternative.

1. **Compatibility prototype.** One standard window and webview; test bundled assets and current project content using temporary fixture data where needed. Compare with the browser. Prove asset origin, frame policies, focus, gestures, clipboard and preview hot reload. Output: evidence and a go/no-go for the preferred architecture. Timebox to roughly one focused working day; unresolved engine/security/origin blockers go back to review.
2. **Launch independently.** Add the chosen asset loading, project/branch transport, narrow native services and state persistence. Run shared parity fixtures. Output: double-clicking the app shows the same registry and branch information with no Atelier terminal/server running.
3. **Finish native behavior.** Menus, external links, window restoration, close/reopen, fullscreen, accessibility and renderer recovery. Output: all everyday behaviors above work without new navigation UI.
4. **Measure and fix demonstrated costs.** Run the performance matrix and hidden/sleep/wake checks; fix attributable regressions. Output: recorded results, remaining limits and an explicit pass/fail against agreed budgets.
5. **Local build handoff.** Reproducible release-build command, ordinary local signing as required by the toolchain, app icon using the existing identity, and a local `.app` that runs outside the repository. Keep replacing it manually. Update the connector contract only for validated changes and explain Mac/browser differences.

For every relevant increment run `npm run typecheck` and `npm test`, plus native build/tests once present. Changes to `server/`, the build or `package.json` also require `npm pack` and installing/starting the command from the tarball, per `AGENTS.md`. Verify the browser workflow still works. Merge, push and publish remain separate instructions.

Manual acceptance includes: no registered projects; missing/bad registry; stopped project; malformed manifest; missing repository/Git; linked page; twelve mounted previews; font/layout fidelity; native bridge rejection from an iframe; restart persistence; immediate close after a camera move; webview crash recovery; sleep/wake; unplugged external display; Finder launch with no terminal. Preview nondeterminism already recorded in `TODOS.md` is not fixed by packaging.

## Review request for Claude Opus

Review this document against the source, `AGENTS.md`, `docs/connector.md` and `docs/package-plan.md`. This is a plan review; do not implement, change neighbouring projects or expand the scope.

1. Is direct AppKit/WKWebView truly the smallest maintainable solution here, once native registry/Git parity, IPC and state saving are counted? If Tauri or a Node helper is simpler overall, identify the concrete code/maintenance tradeoff.
2. Can the proposed custom origin host the actual HTTP previews and existing connector policies without private APIs or security bypasses? Identify what must be proven and what would reject it.
3. Are frame/origin validation, top-level navigation, native state writes and subprocess ownership sufficiently narrow? Identify any remaining privilege path from a preview.
4. Are any existing behaviors lost, especially registry resolution, native focus, clipboard, project route navigation, hot reload, state flushing or close/reopen?
5. Are performance measurements fair, including WebKit processes and loaded preview count? Challenge budgets that are unjustified; do not replace measurements with framework marketing.
6. What can be deleted from this plan while still delivering a reliable, independently launching window around the current UI?

Return **approve / approve with changes / reject**, with blocking findings first, file references where useful, and a corrected sequence if needed. Distinguish observed defects from things the prototype must establish. Do not add distribution, growth, accounts or product features.

Nicolas's two scope decisions are settled. The architecture and budgets await review. No Claude Opus review has been run as part of writing this proposal.
