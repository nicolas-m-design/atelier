# Personal Mac build

One AppKit window contains the existing workspace in WKWebView. No script-message handlers, bundled runtime, native project service or separate state file. The app runs its bundled server code with installed Node; project servers remain independent.

## Build and install

From the repository, with its dependencies installed:

```sh
npm run build:mac
npm run test:mac
```

Requires macOS with Xcode command-line tools and Node >=22.12. The build targets the current CPU architecture and macOS 14+, and ad-hoc signs `macos/build/Atelier.app`. Copy the app to Applications and launch it normally. It works outside this checkout; it contains the full `dist` tree, module metadata, helper and third-party notices. No release/signing account, updater or distribution setup is required for this local version. Quit before replacing a build.

The native host looks for Node at the stable Homebrew `node@22` or generic `node` paths, under `/opt/homebrew` then `/usr/local`. It does not run a shell or install anything. A missing or incompatible executable produces a native error. Advanced overrides, if needed:

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
