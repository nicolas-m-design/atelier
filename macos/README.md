# Personal Mac build

One AppKit window contains the existing workspace in WKWebView. No script-message handlers, bundled runtime, native project service or separate state file. The app runs its bundled server code with installed Node; project servers remain independent.

## Build and install

From the repository, with its dependencies installed:

```sh
npm run build:mac
npm run test:mac
```

Requires macOS with Xcode command-line tools and Node >=22.12. The build targets the current CPU architecture and macOS 14+, and ad-hoc signs `macos/build/Atelier.app`. For the first installation, copy the app to Applications and launch it normally. It works outside this checkout; it contains the full `dist` tree, module metadata, helper and third-party notices. No release/signing account or distribution setup is required for this local version. Quit before manually replacing a build.

## Updating from the app

Use **Update available** at the bottom of the sidebar when it appears, or choose **Atelier → Update Atelier… → Update and Reopen**. The sheet shows which local source folder will be built. The build records its source folder in native-only bundle metadata; **Choose Source Folder…** can change it if the checkout moves (saved as `SourceDirectory` in the app's defaults). A missing source opens the folder picker.

The native host compares a SHA-256 fingerprint of saved build inputs with the bundle’s fingerprint at startup, on focus and every 30 seconds while visible. Saved source edits, additions and deletions count, including uncommitted work; timestamps, Git commits, documentation, tests, dependencies and generated builds do not. This detects a different local build, not a published release or Git ancestry. Missing/unreadable source is unknown and hides the notice; the menu still works. Checking reads files without executing source scripts. A build refuses to finish if its inputs change during compilation.

The updater builds the **current saved checkout**, including its active branch and uncommitted changes. It does not fetch, merge, install dependencies, publish or download releases. Node, npm, installed source dependencies and Xcode command-line tools are required. A release updater would be a separate future feature.

Atelier stays open with a “Building update…” window subtitle and disabled update menu item. It builds with a bounded, clean environment, stages a copy beside the installed app, checks the bundle signature and identity, and only then asks the native host to quit. The existing WebKit flush and owned-helper shutdown complete before the replacement. The worker is copied to a temporary folder so rebuilding or replacing either bundle cannot remove its running script. The sidebar link opens the same native confirmation through a guarded navigation: only a link click from Atelier’s main document to its exact local update address is accepted. Framed previews, new windows and arbitrary navigation cannot invoke it. There is no update HTTP endpoint or script-message bridge. During the build the sidebar says “Updating Atelier…”.

Build/verification failures keep the running app intact and show an error. Quitting during a build cancels its process group. Replacement or launch-command failure restores the previous app; a failure after quitting is reported when Atelier opens again. The updater does not kill another app or port owner. It cannot update an app running directly inside its own build output; install that first.

Each successful update retains its previous bundle as `Previous.app` inside a hidden `.atelier-update-*` folder beside the installed app. These recovery copies are not automatically deleted. App preferences, WebKit data and the machine project list are never replaced. Verification covers signature integrity, bundle identity and the launch command; it does not guarantee the new app has no runtime regressions.

The native shutdown follows Apple's [`applicationShouldTerminate`](https://developer.apple.com/documentation/appkit/nsapplicationdelegate/applicationshouldterminate(_:)) / [`reply(toApplicationShouldTerminate:)`](https://developer.apple.com/documentation/appkit/nsapplication/terminate(_:)) flow; build completion is observed through [`Process.terminationHandler`](https://developer.apple.com/documentation/foundation/process/terminationhandler).

The native host looks for Node at the stable Homebrew `node@22` or generic `node` paths, under `/opt/homebrew` then `/usr/local`. Normal startup does not run a shell or install anything. An explicitly requested local update invokes the checkout's npm build script. A missing or incompatible executable produces a native error. Advanced overrides, if needed:

```sh
defaults write local.agent-atelier.mac NodeExecutable -string /absolute/path/to/node
defaults write local.agent-atelier.mac ProjectsFile -string /absolute/path/to/projects.json
```

These take effect on the next launch. Without overrides the machine's usual project list is used. Shell `.env.local`, cwd discovery and inherited `NODE_OPTIONS` do not affect the app.

## Runtime

- Fixed origin `http://localhost:3201/`, loopback only. Browser development keeps 3200. An occupied port produces an error; Atelier never attaches to or stops its occupant.
- Normal title bar, Edit/Window menus, frame restoration, fullscreen and inspectable WebKit. Links opening new windows go to the default browser; main-frame navigation away from Atelier is refused.
- Closing the only window, Cmd-W and Cmd-Q all quit. Before quitting, the host asks the page to flush its existing localStorage store, with a bounded wait. Browser preferences do not migrate automatically into WebKit.
- Helper readiness comes from the owned child's stdout. A parent-owned stdin pipe stops it on EOF, including unexpected host exit. Shutdown reaps its Git reads, escalating only its own children if needed.
- App hide/minimize/occlusion events supplement `document.hidden` to pause repeated status checks. Initial loads still work when the window is covered. Project pages control their own activity.
- The first renderer crash reloads once; repeated failure uses a normal native alert.

## Verification and remaining acceptance

On the development Mac, the native window loaded the existing project list, branch reports and live preview pages. Zoom changed from 27% to 32%, followed immediately by Cmd-Q through automation, and returned at 32% after reopening. Normal quit and Cmd-W released 3201 while the existing dev server remained available on 3200. The installed copy also exited its helper after its own native process was forcibly killed, and reopened successfully. Its files total 701,007 bytes. Nicolas confirmed that physical pinch is smooth in Safari after the shared gesture fix.

`npm run test:mac` uses temporary registries and owned processes. It checks ready/HTTP responses, same-origin API and Host boundaries, port collision, stdin EOF, SIGTERM, and in-flight Git cleanup including an uncooperative command. Run `npm run build` before it so compiled server code is current.

Still pending: physical native gesture feedback and measured hide/minimize/occlusion behavior. Still unmeasured: controlled cold/warm startup, whole-process-tree memory/idle CPU and canvas frame timing against Safari/Chrome on the same display. Bundle size excludes installed Node and WebKit runtime memory. Still needs a real acceptance case: signed-in preview cookies and development WebSocket hot reload. No neighboring project was changed to simulate those checks. Physical gestures inside an entered preview remain the preview's responsibility.

The update notice was checked in an isolated native bundle on port 3297: absent for matching source, present after a saved source addition, opening the normal confirmation, and absent again after restoring the source. The installed app and its active branch preview were left running.
