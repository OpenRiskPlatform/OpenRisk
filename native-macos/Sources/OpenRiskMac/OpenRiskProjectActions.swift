import AppKit
import Foundation
import UniformTypeIdentifiers

@MainActor
extension OpenRiskAppModel {
    func chooseProject() {
        let panel = NSOpenPanel()
        panel.title = "Open OpenRisk Project"
        panel.prompt = "Open"
        panel.allowsMultipleSelection = false
        panel.canChooseDirectories = false
        panel.canChooseFiles = true
        if let projectType = UTType(filenameExtension: "orproj") {
            panel.allowedContentTypes = [projectType]
        }

        guard panel.runModal() == .OK, let url = panel.url else {
            return
        }

        Task {
            await prepareToOpenProject(at: url.path)
        }
    }

    func prepareToOpenProject(at path: String) async {
        isLoadingProject = true
        errorMessage = nil
        defer { isLoadingProject = false }

        do {
            let status = try await client.getProjectLockStatus(projectPath: path)
            if status.locked && !status.unlocked {
                pendingLockedProjectPath = path
            } else {
                await openProject(at: path)
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func unlockPendingProject(password: String) {
        guard let path = pendingLockedProjectPath else {
            return
        }
        pendingLockedProjectPath = nil
        Task {
            await openProject(at: path, password: password)
        }
    }

    func cancelUnlock() {
        pendingLockedProjectPath = nil
    }

    func openProject(at path: String, password: String? = nil) async {
        isLoadingProject = true
        errorMessage = nil
        defer { isLoadingProject = false }

        do {
            let openedProject = try await client.openProject(
                projectPath: path,
                password: password
            )
            let loadedScans = try await client.listScans()
            let loadedSettings = try await client.loadSettings()
            project = openedProject
            scans = loadedScans
            plugins = loadedSettings.plugins
            settingsSnapshot = loadedSettings
            recentProjectPaths = NativeRecentProjects.add(path)
            selectScan(loadedScans.first(where: { !$0.isArchived })?.id)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

}
