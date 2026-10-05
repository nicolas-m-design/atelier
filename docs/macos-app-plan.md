# Plan: Atelier as a small Mac app

> **Status:** Revised 2026-10-05 after Claude Opus returned **approve with changes**, as relayed by Nicolas. The first local app is implemented on `codex/macos-app`; see `macos/README.md` for build and verification notes. Confirmed: Nicolas's Mac only, independent launch, existing UI, small footprint and good performance. Nicolas approved installed Node and quit-on-close with “ok go”; implementation is authorized.

## Revised recommendation

Build **one Swift/AppKit window with WKWebView, starting the existing Node server as its own child process**. Bundle the production web build and compiled server modules; use Node already installed on this Mac. Load the workspace at a fixed `http://localhost:<app-port>` origin separate from the browser development server on 3200.

This retains the existing React UI, HTTP endpoints, registry/Git rules and localStorage. Remove the proposed script-message bridge, native state file, frontend transport fork and native backend port. Swift owns the window and helper lifecycle. Project preview servers remain separately operated.

The first working app is also the prototype. A custom scheme is deferred unless the installed Node dependency proves troublesome. No runtime is bundled. No marketing, accounts, onboarding, analytics, App Store/distribution work, updater, menu-bar companion, project-server management or UI rewrite.

## What changed after review

The original proposal is preserved in commit `52e1b92`. Opus's review was pasted into this chat; its scratchpad probe and raw output are not checked into this repository or independently reproduced here. Attribute those findings accordingly.

| Finding | Evidence level | Change to the plan |
| --- | --- | --- |
| `atelier-app://app/` prevented localhost iframe cookies; a localhost top-level host worked in the probe, including its Lax-cookie case | Reported as verified by Opus on macOS 27.0 | Use real HTTP localhost for v1. Include cookies and sign-in in the bundled-app test. Do not extrapolate to all auth flows or project hosts. |
| Script messages from an iframe reached the native handler | Reported as verified by Opus | Register no script-message handlers. The original frame checks were intended to reject those messages, but the bridge is unnecessary. |
| HTTP same-origin fetch sent `Sec-Fetch-Site: same-origin`; cross-port fetch sent `same-site` | Reported as verified by Opus; existing server rejects anything except same-origin | Keep the existing HTTP boundary and retest it in the bundled app. Custom-scheme header behavior remains unknown. |
| localStorage worked in the probe | Reported as verified by Opus | Keep the current store with a persistent WKWebView data store; test relaunch and immediate quit. No native state-file replacement. |
| Canvas listens for modified wheel events but has no Safari gesture handlers | Source confirmed in `src/components/Canvas.tsx`; physical pinch not tested in the probe | Check and fix Safari pinch in the shared web UI first, then verify manually on this Mac. |
| Any offline listed project selects the 3-second polling interval for all projects | Source confirmed in `src/useStatuses.ts` | Measure with the actual registry and its usual offline entries, not just an empty app. |

The [Safari pinch issue](https://github.com/d3/d3-zoom/issues/229) is a 2021 report about `gesturestart/change/end`, not a new 2026 benchmark. [CVE-2024-35222](https://github.com/advisories/GHSA-57fm-592m-34r7) documents an iframe IPC origin-check bypass in older Tauri releases, fixed in 1.6.7 and 2.0.0-beta.20. It illustrates bridge risk; it does not establish that current Tauri is vulnerable or that our unimplemented frame-checked bridge was exploitable.

Opus estimated less code for the Node helper option. Treat the line counts as estimates, not measurements. The concrete advantage is retaining the existing service implementation instead of maintaining its rules in two languages. The original plan proposed deriving shared parity fixtures; none exist as standalone shared files today, and no port means they are unnecessary.

## Existing implementation to reuse

Source assessed at `2f97fbc`; docs are on `codex/macos-app-plan`. This Mac was observed as Apple Silicon/macOS 27.0 with Xcode selected. Initial support targets this machine.

| Area | Files and existing behavior |
| --- | --- |
| Window contents | `src/App.tsx`, `src/components/Workspace.tsx`: rail, sidebar, canvas and project-owned iframes |
| Registry | `server/projects.ts`, `src/projects.ts`: machine registry, package defaults, validation and partial errors |
| Branches | `server/branches.ts`: two read-only commands, 3-second timeout, output limit and no-lock setting |
| HTTP service | `server/serve.ts`, `server/handler.ts`, `server/request.ts`: loopback-only listeners, Host validation, same-origin API checks |
| Build/launch | `server/cli.ts`, `tsconfig.build.json`: CLI with `--port`; compiled server imports modules under `dist/src` as well as `dist/server` |
| Preview cost | Canvas cap of 12 live frames; nearby-frame mounting; only active workspace mounted |
| Linked pages | Canvas stays mounted under an open linked page; preserve this behavior |
| Status | 10-second interval only when all configured origins are live, otherwise 3 seconds; timer skips checks when `document.hidden` |
| State | `src/storage.ts`: validated `atelier:v1`, 250 ms debounce; `src/App.tsx` flushes on `pagehide` |

The npm connector plan remains separate. No changes to neighbouring projects are authorized by this planning revision.

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

## One window, existing UI

Use standard native title-bar controls, resizing, minimize/fullscreen, tiling and normal window placement restoration. Keep the current workspace's visual design. Start near 1280 × 900 points, constrained to the display; verify a usable minimum against the current sidebar rather than adding a new responsive design.

Recommended behavior: closing the only window, including Cmd-W, quits Atelier and stops its own helper. Cmd-Q does the same. Project preview servers keep running. There is no background mode or close/reopen state machine. Nicolas approved this behavior.

Supply ordinary app, Edit and Window menus and standard copy/paste behavior. Keep keyboard focus indicators and check VoiceOver during normal acceptance, not as a separate development phase. Do not add a native sidebar menu item or Mac-only copy variants. Existing new-tab links open in the default browser; ordinary in-frame navigation stays in the preview. Allow only explicitly supported URL schemes for external opening, never arbitrary command URLs.

Enable `WKWebView.isInspectable` for this personal developer tool. Preserve the current select/interact behavior. Safari gesture support belongs to the shared canvas code; it must not hijack gestures inside entered project previews or apply zoom twice. Existing in-frame Escape/pinch limitations stay documented unless separately solved. No scripts are injected into project pages to change their behavior.

On web-content-process termination, attempt one reload, not an unbounded loop or a new crash-recovery screen. Startup failure or repeated failure can use a standard native alert with the useful reason. Keep existing project-offline/invalid-manifest UI.

## Helper and loading contract

These details are part of the small working app, not a new server-management feature.

1. **Bundle the complete build output.** Include `dist/app`, `dist/server` and imported `dist/src` modules, preserving relative paths and ES-module interpretation. Include the required package metadata (`type: module` and version) at the expected bundle-relative location. Verify the app outside the checkout; copying `dist/server` alone is insufficient. Keep third-party notices with the local build.
2. **Find installed Node deterministically.** Use an explicit validated executable path or a short documented set of stable installation paths. Check compatibility with `package.json` (`>=22.12` currently). Do not depend on Finder inheriting the terminal's PATH, run a login shell, use `npx`, install Node automatically or embed a versioned Homebrew Cellar path. A missing/incompatible runtime produces a native alert explaining what to restore. A Homebrew stable path still fails if its formula is removed: that is the accepted tradeoff if Nicolas chooses this option.
3. **Give the child an explicit environment and working directory.** Start the bundled entry point with argument arrays, a controlled cwd inside the bundled resources and the normal user home. Supply a usable Git PATH; Finder's environment must not accidentally disable branch reads. Avoid cwd-based project discovery and accidental `.env.local` overrides. Default to the existing registry; any nondefault `ATELIER_PROJECTS`/XDG location must be deliberately configured, not silently assumed to carry over from a shell.
4. **Use a stable, separate origin.** Choose and document an unused app port during implementation; keep browser/Vite port 3200 unchanged. Always navigate to `http://localhost:<app-port>` rather than alternating host spellings. Keep loopback-only IPv4/IPv6 binding and Host checks. Never choose a random fallback port: it would create a different localStorage origin. If occupied, show a useful error and exit without attaching to or terminating the other process.
5. **Wait for the owned server.** Show the native window promptly, but load the page only once the child confirms successful binding on its supported loopback listeners. A successful HTTP response alone does not prove ownership. Use bounded readiness tied to the spawned process (small dedicated ready signal if needed), watch early exit and continuously drain bounded stdout/stderr so pipes cannot stall the helper.
6. **Clean up only owned work.** On normal close/quit terminate and reap the child; handle a stuck exit with a bounded fallback aimed only at owned processes. Test unexpected app termination too. If the child otherwise survives, add a parent-owned pipe/EOF lifecycle hook so it exits when the host disappears. No PID/port sweeps, launch agent or external process restarts. Test in-flight Git cleanup. Reopening the app must not fail because its previous helper was orphaned.
7. **Keep the same HTTP privilege boundary.** Register no script-message handlers. Preserve GET-only/same-origin checks on the two local APIs and test rejection from cross-port previews, cross-site pages and requests missing Fetch Metadata. These checks protect browser requests, not against malicious programs already running as the user. Cancel navigation of the main frame away from Atelier's exact origin; also reject attempts by a preview to navigate the main frame, including to an API URL on that origin. Leave legitimate subframe routes alone. Test new-window handling and redirects explicitly.

An app port other than 3200 is still a new framing origin under `docs/connector.md`. Opus reports Palier had no frame policy when checked; that is not evidence for every project. Inspect each actual preview's CSP/X-Frame-Options and validate the app origin before updating the connector contract alongside implementation. Any needed edits in connected projects follow their own rules and worktrees.

Use a persistent, app-specific `WKWebsiteDataStore` and unchanged localStorage keys. Browser state and login cookies are not automatically imported from Safari or Chrome. Sharing the localhost host does not make all cookie/auth behavior safe or universal: test the actual routes, redirects and configured hosts. Keeping cookies functional does not resolve the connector's separate deterministic-state rule or automatically connect Yutugy.

Test immediate Cmd-Q and close after a camera move. If `pagehide` does not flush reliably, fix the shutdown flush narrowly; a bounded native-to-main-frame JavaScript call can be considered without adding a page-to-native handler or moving state to a native file. Prove durable storage after relaunch, not just completion of a JavaScript call.

Verify ATS in the **bundled** app; the unbundled probe is insufficient. Use only required local-network configuration, informed by [NSAllowsLocalNetworking](https://developer.apple.com/documentation/bundleresources/information-property-list/nsapptransportsecurity/nsallowslocalnetworking). Do not disable web security, bypass TLS validation or broaden arbitrary loads to make a test pass.

## Two implementation increments

### 1. Safari baseline and shared gesture fix

Run today's workspace in Safari and Chrome using the same routes, frame count, zoom, viewport and display. Reuse a running server read-only or start an owned one without replacing anything already running. Reproduce physical trackpad pinch, add the necessary Safari gesture handling, then check pointer anchoring, scale limits, wheel behavior and entered-preview interaction in both engines. Synthetic events alone do not prove physical pinch works.

Record panning, idle behavior and memory with the actual registry, including offline entries. This establishes engine behavior before Swift. Commit the web fix as its own increment after the existing checks; it is not implemented by this document revision.

### 2. Build and validate the minimal app

Implement the window/helper contract above. The prototype is the working app; do not build a separate disposable native service layer. Validate normal menus, focus, inspection, window restoration, external links, cookies, hot reload/WebSockets, localStorage across relaunch, immediate quit, minimize/hide/occlusion, sleep/wake, renderer reload and helper cleanup.

Use the comparison below during implementation. Fix demonstrated regressions before calling the increment complete. Provide a reproducible local release-build command and an ordinary `.app` launched from Finder outside the checkout with no terminal/Vite session. Replace it manually when rebuilding. No packaging pipeline or publishing step.

For each increment update `TODOS.md`/`CHANGELOG.md`, run `npm run typecheck` and `npm test`, and build/test native code once present. Server/build/package changes also require `npm pack` and a real tarball install/start check. Preserve browser/CLI behavior. Commit on a work branch; merging, pushing and publishing remain separate instructions.

## Performance and acceptance within those increments

Use Safari to separate web-engine cost from wrapper cost, then compare the app. Keep Chrome as the existing-workflow comparison. Include Swift, Node and attributed WebKit content/network processes in app totals. Report project dev servers separately; do not claim a tiny Swift host represents total memory use.

Proposed budgets are review targets, **not measured results**. Record Mac/OS, actual display model and resolution, window size, refresh mode and release-build settings. Run the primary motion comparison on the same display explicitly set to **60 Hz**; if that is unavailable, record its actual mode and compare frame times rather than claiming a measured 60 Hz result. Higher-refresh testing is optional and separately labelled.

| Check | Acceptance / measurement |
| --- | --- |
| Launch | Aim for usable shell within 1 s warm / 2 s cold; record five of each. Separate helper readiness and first-preview readiness so missing projects cannot distort the shell result. |
| Pan/zoom | Same path with five and twelve live frames; target 16.7 ms frames in the 60 Hz test and investigate repeatable shell-induced stalls over 100 ms. Compare distributions, not only mean fps. |
| Idle | Empty app plus actual registry with its usual stopped projects. Aim for near-zero empty-app CPU; investigate recurring work and report a one-minute average. Account for the existing all-project 3-second interval. |
| Hidden/minimized/occluded | Verify actual visibility/focus events. No new background loops; stop unnecessary Atelier polling while unavailable to the user. Measure iframe activity separately and preserve transient preview state unless a measured change is explicitly justified. |
| Memory | Zero/five/twelve frames; 20 project switches and repeated launches. No monotonic retained growth; compare settled footprints. Test 20–30 manifest entries to verify the live-frame cap. |
| Footprint | **No bundled Node or browser runtime.** Report actual app size; remove the arbitrary 30 MB gate. Installed Node is an external dependency, not a zero-cost runtime. |
| Lifecycle | Close/quit leaves no owned helper/listener/Git processes; forced host exit is checked; project servers remain running. |

Use local Instruments/Web Inspector recordings and Activity Monitor for a coarse check; no analytics infrastructure. Accessibility and performance remain completion criteria, integrated into the work rather than separate phases. Preserve the 12-frame cap, active-workspace mounting, linked-page retention and debounced writes unless a measured problem justifies a focused change.

## Deferred alternative: eliminate installed Node only if needed

If installed Node becomes a real maintenance problem, reconsider a `scheme://localhost/` handler serving bundled assets and the same two `/__atelier/` paths, without script-message handlers or a frontend transport fork. It still requires native registry/Git code and parity tests; it is not a free replacement.

Before choosing it, prove custom-scheme Fetch Metadata and request isolation, persistent storage, auth/cookies and every actual preview. Opus's cookie probe is promising for its tested localhost case, not a portable guarantee. If equivalent isolation cannot be established, reject the scheme rather than weakening the API check. An origin change also requires an explicit workspace-state migration or accepted reset and a connector update.

Tauri still uses WebKit on Mac and would not solve an engine issue. Electron remains a possible response to a demonstrated WebKit blocker, with a larger runtime tradeoff. Neither is part of the first implementation.

## Decisions and next handoff

Settled: personal Mac only; independent launch; current UI; project servers operated separately.

Approved by Nicolas: installed Node for v1; closing the only window quits Atelier.

Next implementation handoff, after those decisions: follow the two increments above. Do not revive the native bridge/state-file/backend port without new evidence. The original Opus verdict applies to the first proposal; this revision incorporates that review but has not itself received a second Opus review. Nicolas confirmed smooth physical Safari pinch. The app loads real previews, restores its view after quit, and has helper lifecycle integration tests. Cookies/sign-in, WebSocket hot reload and a controlled performance comparison still need acceptance checks; do not treat Opus’s scratchpad findings as bundled-app measurements.
