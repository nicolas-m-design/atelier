import AppKit
import WebKit

private let appPort = 3201
private let homeURL = URL(string: "http://localhost:\(appPort)/")!

@MainActor
final class Atelier: NSObject, NSApplicationDelegate, NSWindowDelegate, WKNavigationDelegate, WKUIDelegate {
    private var window: NSWindow!
    private var web: WKWebView!
    private var helper: Process?
    private var lifetime: Pipe?
    private var output: Pipe?
    private var errors: Pipe?
    private var pending = Data()
    private var errorText = ""
    private var ready = false
    private var loaded = false
    private var quitting = false
    private var shutdownStarted = false
    private var replied = false
    private var failureShown = false
    private var reloadedAfterCrash = false
    private var titleObservation: NSKeyValueObservation?

    func applicationDidFinishLaunching(_ notification: Notification) {
        buildMenus()
        NSWindow.allowsAutomaticWindowTabbing = false
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        // No script-message handlers: previews get no native API.
        web = WKWebView(frame: .zero, configuration: config)
        web.isInspectable = true
        web.allowsMagnification = false // canvas zoom belongs to the web UI
        web.navigationDelegate = self
        web.uiDelegate = self
        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1280, height: 900),
                          styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
        window.title = "Atelier"
        window.contentMinSize = NSSize(width: 900, height: 600)
        window.isReleasedWhenClosed = false
        window.delegate = self
        window.contentView = web
        window.center()
        window.setFrameAutosaveName("AtelierWindow")
        if let screen = NSScreen.screens.first(where: { $0.visibleFrame.intersects(window.frame) }) ?? NSScreen.main {
            let area = screen.visibleFrame
            var frame = window.frame
            frame.size.width = min(frame.width, area.width)
            frame.size.height = min(frame.height, area.height)
            frame.origin.x = max(area.minX, min(frame.minX, area.maxX - frame.width))
            frame.origin.y = max(area.minY, min(frame.minY, area.maxY - frame.height))
            window.setFrame(frame, display: false)
        }
        titleObservation = web.observe(\.title, options: [.new]) { [weak self] view, _ in
            DispatchQueue.main.async { self?.window.title = view.title ?? "Atelier" }
        }
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        startHelper()
    }

    private func buildMenus() {
        let bar = NSMenu()
        let app = NSMenu()
        app.addItem(withTitle: "About Atelier", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
        app.addItem(.separator())
        app.addItem(withTitle: "Hide Atelier", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
        let hide = app.addItem(withTitle: "Hide Others", action: #selector(NSApplication.hideOtherApplications(_:)), keyEquivalent: "h")
        hide.keyEquivalentModifierMask = [.command, .option]
        app.addItem(withTitle: "Show All", action: #selector(NSApplication.unhideAllApplications(_:)), keyEquivalent: "")
        app.addItem(.separator())
        app.addItem(withTitle: "Quit Atelier", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        let edit = NSMenu(title: "Edit")
        for (title, action, key) in [("Undo", "undo:", "z"), ("Redo", "redo:", "Z"), ("Cut", "cut:", "x"), ("Copy", "copy:", "c"), ("Paste", "paste:", "v"), ("Select All", "selectAll:", "a")] {
            edit.addItem(withTitle: title, action: Selector(action), keyEquivalent: key)
        }
        let win = NSMenu(title: "Window")
        win.addItem(withTitle: "Close", action: #selector(NSWindow.performClose(_:)), keyEquivalent: "w")
        win.addItem(withTitle: "Minimize", action: #selector(NSWindow.performMiniaturize(_:)), keyEquivalent: "m")
        win.addItem(withTitle: "Zoom", action: #selector(NSWindow.performZoom(_:)), keyEquivalent: "")
        let full = win.addItem(withTitle: "Enter Full Screen", action: #selector(NSWindow.toggleFullScreen(_:)), keyEquivalent: "f")
        full.keyEquivalentModifierMask = [.command, .control]
        for menu in [app, edit, win] { let item = NSMenuItem(); item.submenu = menu; bar.addItem(item) }
        NSApp.mainMenu = bar
        NSApp.windowsMenu = win
    }

    private func startHelper() {
        let candidates = [UserDefaults.standard.string(forKey: "NodeExecutable"),
                          "/opt/homebrew/opt/node@22/bin/node", "/opt/homebrew/bin/node",
                          "/usr/local/opt/node@22/bin/node", "/usr/local/bin/node"].compactMap { $0 }
        guard let node = candidates.first(where: { FileManager.default.isExecutableFile(atPath: $0) }),
              let resources = Bundle.main.resourceURL else {
            fail("Install Node 22.12 or newer, then reopen Atelier. No server was started.")
            return
        }
        let process = Process()
        process.executableURL = URL(fileURLWithPath: node)
        process.arguments = [resources.appendingPathComponent("macos/helper.mjs").path, String(appPort)]
        process.currentDirectoryURL = resources
        // Do not inherit NODE_OPTIONS, shell project discovery or development overrides.
        var environment = ["HOME": FileManager.default.homeDirectoryForCurrentUser.path,
                           "PATH": "\(URL(fileURLWithPath: node).deletingLastPathComponent().path):/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin:/usr/local/bin",
                           "TMPDIR": NSTemporaryDirectory(), "LANG": "en_US.UTF-8"]
        if let registry = UserDefaults.standard.string(forKey: "ProjectsFile"), registry.hasPrefix("/") {
            environment["ATELIER_PROJECTS"] = registry
        }
        process.environment = environment
        let input = Pipe(), stdout = Pipe(), stderr = Pipe()
        process.standardInput = input
        process.standardOutput = stdout
        process.standardError = stderr
        lifetime = input; output = stdout; errors = stderr; helper = process
        stdout.fileHandleForReading.readabilityHandler = { [weak self] handle in
            let data = handle.availableData
            if data.isEmpty { handle.readabilityHandler = nil; return }
            DispatchQueue.main.async { self?.receive(data) }
        }
        stderr.fileHandleForReading.readabilityHandler = { [weak self] handle in
            let data = handle.availableData
            if data.isEmpty { handle.readabilityHandler = nil; return }
            DispatchQueue.main.async {
                guard let self else { return }
                self.errorText = String((self.errorText + (String(data: data, encoding: .utf8) ?? "")).suffix(4000))
            }
        }
        process.terminationHandler = { [weak self] process in
            DispatchQueue.main.async {
                guard let self else { return }
                if self.quitting { self.finishQuit() }
                else { self.fail(self.errorText.isEmpty ? "Atelier's helper stopped (status \(process.terminationStatus)). Reopen Atelier to retry." : self.errorText) }
            }
        }
        do { try process.run() }
        catch { fail("Could not start Node at \(node): \(error.localizedDescription)"); return }
        DispatchQueue.main.asyncAfter(deadline: .now() + 10) { [weak self] in
            guard let self, !self.ready, !self.quitting else { return }
            self.fail("Atelier's local server did not start within 10 seconds. Reopen Atelier to retry.")
        }
    }

    private func receive(_ data: Data) {
        guard !ready, !quitting else { return }
        pending.append(data)
        if pending.count > 8192 { fail("Unexpected response from Atelier's helper."); return }
        while let end = pending.firstIndex(of: 10) {
            let line = pending.prefix(upTo: end)
            pending.removeSubrange(...end)
            guard let message = try? JSONSerialization.jsonObject(with: line) as? [String: Any],
                  message["ready"] as? Bool == true, message["port"] as? Int == appPort,
                  helper?.isRunning == true else { continue }
            ready = true
            web.load(URLRequest(url: homeURL))
        }
    }

    private func isHome(_ url: URL?) -> Bool {
        guard let url else { return false }
        return url.scheme == "http" && url.host == "localhost" && url.port == appPort && url.path == "/" && url.query == nil
    }

    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if action.targetFrame == nil {
            if action.navigationType == .linkActivated { openExternal(action.request.url) }
            decisionHandler(.cancel)
        } else if action.targetFrame?.isMainFrame == true {
            // The initial app load has no web source. Thereafter only the UI
            // may reload itself; a preview cannot replace it with an API/page.
            let allowed = isHome(action.request.url) && (action.sourceFrame.isMainFrame || (!loaded && action.sourceFrame.request.url == nil))
            decisionHandler(allowed ? .allow : .cancel)
        } else { decisionHandler(.allow) }
    }

    private func openExternal(_ url: URL?) {
        guard let url, ["http", "https", "mailto"].contains(url.scheme?.lowercased() ?? "") else { return }
        NSWorkspace.shared.open(url)
    }

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if action.navigationType == .linkActivated { openExternal(action.request.url) }
        return nil
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { loaded = true; visibility() }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        if (error as NSError).code != NSURLErrorCancelled { fail("Could not load Atelier: \(error.localizedDescription)") }
    }
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        guard !quitting else { return }
        if !reloadedAfterCrash { reloadedAfterCrash = true; webView.reload() }
        else { fail("The web view stopped again. Reopen Atelier to retry.") }
    }

    // Host-to-page lifecycle events only; no page-to-native handlers. The web
    // code uses these to pause its own polling and flush its existing store.
    private func visibility() {
        guard loaded, !quitting else { return }
        let visible = NSApp.isHidden == false && window.isMiniaturized == false && window.occlusionState.contains(.visible)
        web.evaluateJavaScript("window.dispatchEvent(new CustomEvent('atelier:visibility', {detail: \(visible)}))", completionHandler: nil)
    }
    func windowDidChangeOcclusionState(_ notification: Notification) { visibility() }
    func windowDidMiniaturize(_ notification: Notification) { visibility() }
    func windowDidDeminiaturize(_ notification: Notification) { visibility() }
    func applicationDidHide(_ notification: Notification) { visibility() }
    func applicationDidUnhide(_ notification: Notification) { visibility() }
    func windowDidBecomeKey(_ notification: Notification) { if loaded { web.evaluateJavaScript("window.dispatchEvent(new Event('focus'))", completionHandler: nil) }; visibility() }
    func windowShouldClose(_ sender: NSWindow) -> Bool { NSApp.terminate(nil); return false }
    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        if quitting { return .terminateLater }
        quitting = true
        if loaded && isHome(web.url) {
            web.evaluateJavaScript("window.dispatchEvent(new Event('atelier:flush'))") { [weak self] _, _ in self?.stopHelper() }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { [weak self] in self?.stopHelper() }
        } else { DispatchQueue.main.async { [weak self] in self?.stopHelper() } }
        return .terminateLater
    }
    private func stopHelper() {
        guard !shutdownStarted else { return }
        shutdownStarted = true
        try? lifetime?.fileHandleForWriting.close()
        guard let process = helper, process.isRunning else { finishQuit(); return }
        DispatchQueue.main.asyncAfter(deadline: .now() + 4) { [weak self] in
            guard let self, process.isRunning else { return }
            process.terminate()
            DispatchQueue.main.asyncAfter(deadline: .now() + 1) { [weak self] in
                if process.isRunning { kill(process.processIdentifier, SIGKILL) }
                self?.finishQuit()
            }
        }
    }
    private func finishQuit() {
        guard !replied else { return }
        replied = true
        NSApp.reply(toApplicationShouldTerminate: true)
    }
    private func fail(_ reason: String) {
        guard !failureShown, !quitting else { return }
        failureShown = true
        let alert = NSAlert()
        alert.messageText = "Atelier couldn't open"
        alert.informativeText = reason
        alert.addButton(withTitle: "Quit")
        alert.beginSheetModal(for: window) { _ in NSApp.terminate(nil) }
    }
}

@main
struct Main {
    @MainActor static func main() {
        let app = NSApplication.shared
        app.setActivationPolicy(.regular)
        let delegate = Atelier()
        app.delegate = delegate
        withExtendedLifetime(delegate) { app.run() }
    }
}
