import AppKit

/// Only the native menu can start an update. Preview pages have no bridge to it.
@MainActor
final class LocalUpdate {
    private weak var window: NSWindow?
    private var process: Process?
    private var input: Pipe?
    private var output: Pipe?
    private var pending = Data()
    private var reported = false
    private var installing = false
    private var cancelled = false
    private var menu: NSMenuItem?
    private var workerFolder: URL?
    private let report = FileManager.default.homeDirectoryForCurrentUser
        .appendingPathComponent("Library/Application Support/Atelier/update-result.json")

    init(window: NSWindow) { self.window = window }

    func showPreviousFailure() {
        guard let data = try? Data(contentsOf: report),
              let result = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return }
        try? FileManager.default.removeItem(at: report)
        if result["ok"] as? Bool == false {
            showError(result["error"] as? String ?? "The update failed. The previous app was restored.")
        }
    }

    func start(menu: NSMenuItem, node: URL, helperPID: Int32) {
        guard process == nil, let window, let resources = Bundle.main.resourceURL else { return }
        self.menu = menu
        let metadata = (try? Data(contentsOf: resources.appendingPathComponent("macos/source.json")))
            .flatMap { try? JSONSerialization.jsonObject(with: $0) as? [String: String] }
        let source = UserDefaults.standard.string(forKey: "SourceDirectory") ?? metadata?["path"]
        guard let source, FileManager.default.fileExists(atPath: source + "/package.json") else {
            chooseSource(menu: menu, node: node, helperPID: helperPID)
            return
        }
        let alert = NSAlert()
        alert.messageText = "Update Atelier?"
        alert.informativeText = "Build the current saved code in:\n\(source)\n\nAtelier stays open while it builds, then installs the update and reopens. Your project list and canvas preferences are kept."
        alert.addButton(withTitle: "Update and Reopen")
        alert.addButton(withTitle: "Cancel")
        alert.addButton(withTitle: "Choose Source Folder…")
        alert.beginSheetModal(for: window) { [weak self] response in
            guard let self else { return }
            if response == .alertFirstButtonReturn { self.run(source: source, node: node, helperPID: helperPID) }
            else if response == .alertThirdButtonReturn { self.chooseSource(menu: menu, node: node, helperPID: helperPID) }
        }
    }

    private func chooseSource(menu: NSMenuItem, node: URL, helperPID: Int32) {
        guard let window else { return }
        let panel = NSOpenPanel()
        panel.message = "Choose the Atelier source folder. Local updates need its installed dependencies and Xcode command-line tools."
        panel.canChooseDirectories = true
        panel.canChooseFiles = false
        panel.allowsMultipleSelection = false
        panel.beginSheetModal(for: window) { [weak self] response in
            guard response == .OK, let path = panel.url?.path else { return }
            UserDefaults.standard.set(path, forKey: "SourceDirectory")
            self?.start(menu: menu, node: node, helperPID: helperPID)
        }
    }

    private func run(source: String, node: URL, helperPID: Int32) {
        guard process == nil, let resources = Bundle.main.resourceURL else { return }
        do {
            let fm = FileManager.default
            let folder = fm.temporaryDirectory.appendingPathComponent("atelier-update-\(UUID().uuidString)", isDirectory: true)
            try fm.createDirectory(at: folder, withIntermediateDirectories: true)
            workerFolder = folder
            let script = folder.appendingPathComponent("update.mjs")
            try fm.copyItem(at: resources.appendingPathComponent("macos/update.mjs"), to: script)
            try fm.createDirectory(at: report.deletingLastPathComponent(), withIntermediateDirectories: true)
            try? fm.removeItem(at: report)
            let worker = Process(), stdin = Pipe(), stdout = Pipe()
            worker.executableURL = node
            worker.arguments = [script.path, source, Bundle.main.bundleURL.path,
                                String(ProcessInfo.processInfo.processIdentifier), String(helperPID), report.path]
            worker.environment = ["HOME": fm.homeDirectoryForCurrentUser.path, "TMPDIR": NSTemporaryDirectory()]
            worker.currentDirectoryURL = folder
            worker.standardInput = stdin
            worker.standardOutput = stdout
            worker.standardError = FileHandle.nullDevice
            process = worker; input = stdin; output = stdout
            reported = false; installing = false; cancelled = false; pending = Data()
            stdout.fileHandleForReading.readabilityHandler = { [weak self] handle in
                let data = handle.availableData
                if data.isEmpty { handle.readabilityHandler = nil; return }
                DispatchQueue.main.async { self?.receive(data) }
            }
            worker.terminationHandler = { [weak self] worker in
                DispatchQueue.main.async {
                    guard let self, !self.installing else { return }
                    if !self.reported && !self.cancelled { self.showError("The update worker stopped (status \(worker.terminationStatus)). Your installed app is unchanged.") }
                    self.cleanup()
                }
            }
            menu?.isEnabled = false
            menu?.title = "Updating Atelier…"
            window?.subtitle = "Building update…"
            try worker.run()
        } catch {
            cleanup()
            showError(error.localizedDescription)
        }
    }

    private func receive(_ data: Data) {
        guard !cancelled, !installing else { return }
        pending.append(data)
        guard pending.count <= 20000 else { cancel(); showError("Unexpected update response. The installed app is unchanged."); return }
        while let end = pending.firstIndex(of: 10) {
            let line = pending.prefix(upTo: end)
            pending.removeSubrange(...end)
            guard let message = try? JSONSerialization.jsonObject(with: line) as? [String: Any] else { continue }
            if let error = message["error"] as? String {
                reported = true
                showError(error)
            } else if message["ready"] as? Bool == true {
                do {
                    try input?.fileHandleForWriting.write(contentsOf: Data("install\n".utf8))
                    installing = true
                    // Leave this main-queue callback first. terminateLater runs
                    // a nested AppKit loop; calling it here can starve the main
                    // queue that finishes the WebKit flush/helper shutdown.
                    NSApp.perform(#selector(NSApplication.terminate(_:)), with: nil, afterDelay: 0)
                } catch { cancel(); showError(error.localizedDescription) }
            }
        }
    }

    func cancel() {
        if !installing { cancelled = true }
        try? input?.fileHandleForWriting.close()
    }

    private func cleanup() {
        output?.fileHandleForReading.readabilityHandler = nil
        try? input?.fileHandleForWriting.close()
        process = nil; input = nil; output = nil
        menu?.title = "Update Atelier…"
        menu?.isEnabled = true
        window?.subtitle = ""
        if let workerFolder { try? FileManager.default.removeItem(at: workerFolder) }
        workerFolder = nil
    }

    private func showError(_ message: String) {
        guard let window else { return }
        let alert = NSAlert()
        alert.messageText = "Atelier couldn't update"
        alert.informativeText = message
        alert.addButton(withTitle: "OK")
        alert.beginSheetModal(for: window)
    }
}
