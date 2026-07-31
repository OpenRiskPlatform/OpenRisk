import AppKit
import Foundation
import UniformTypeIdentifiers

@MainActor
extension OpenRiskAppModel {
  func chooseNewProject() {
    let panel = NSSavePanel()
    panel.title = "Create OpenRisk Project"
    panel.prompt = "Create"
    panel.nameFieldStringValue = "new-project.orproj"
    if let projectType = UTType(filenameExtension: "orproj") {
      panel.allowedContentTypes = [projectType]
    }

    guard panel.runModal() == .OK, let url = panel.url else {
      return
    }

    let name = url.deletingPathExtension().lastPathComponent
    Task {
      await createProject(name: name, at: url.path)
    }
  }

  func createProject(name: String, at path: String) async {
    isLoadingProject = true
    errorMessage = nil
    defer { isLoadingProject = false }

    do {
      let created = try await client.createProject(
        name: name,
        projectPath: path
      )
      let settings = try await client.loadSettings()
      project = created
      scans = []
      plugins = settings.plugins
      settingsSnapshot = settings
      recentProjectPaths = NativeRecentProjects.add(path)
      selectedScanID = nil
      selectedScanDetail = nil
    } catch {
      errorMessage = error.localizedDescription
    }
  }

  func openRecentProject(_ path: String) {
    Task {
      await prepareToOpenProject(at: path)
    }
  }

  func forgetRecentProject(_ path: String) {
    recentProjectPaths = NativeRecentProjects.remove(path)
  }

  func presentSettings() {
    isSettingsPresented = true
    Task {
      await reloadSettings()
    }
  }

  func reloadSettings() async {
    guard
      let settings = await performSettingsAction({
        try await self.client.loadSettings()
      })
    else {
      return
    }
    apply(settings: settings)
  }

  func saveProjectSettings(
    name: String?,
    theme: String?,
    advancedMode: Bool?,
    interruptedScanPolicy: String? = nil
  ) async -> Bool {
    guard
      await performSettingsAction({
        try await self.client.updateProjectSettings(
          name: name,
          theme: theme,
          advancedMode: advancedMode,
          interruptedScanPolicy: interruptedScanPolicy
        )
      }) != nil
    else {
      return false
    }
    await reloadSettings()
    return true
  }

  func updatePluginEnabled(_ plugin: NativePlugin, enabled: Bool) async {
    guard
      await performSettingsAction({
        try await self.client.setPluginEnabled(
          pluginId: plugin.id,
          enabled: enabled
        )
      }) != nil
    else {
      return
    }
    await reloadSettings()
  }

  func savePluginSettings(
    pluginID: String,
    values: [String: String]
  ) async -> Bool {
    guard
      await performSettingsAction({
        for (name, valueJSON) in values.sorted(by: { $0.key < $1.key }) {
          _ = try await self.client.setPluginSetting(
            pluginId: pluginID,
            settingName: name,
            valueJson: valueJSON
          )
        }
        return true
      }) == true
    else {
      return false
    }
    await reloadSettings()
    return true
  }

  func refreshMetrics(for plugin: NativePlugin) async {
    guard
      await performSettingsAction({
        try await self.client.refreshPluginMetrics(pluginId: plugin.id)
      }) != nil
    else {
      return
    }
    await reloadSettings()
  }

  func loadPluginRegistry() async {
    pluginRegistry = await performSettingsAction {
      try await self.client.getPluginRegistry()
    }
  }

  func installRegistryPlugin(_ plugin: NativeRegistryPlugin, version: String) async {
    let manifestURL =
      "https://raw.githubusercontent.com/OpenRiskPlatform/plugins/main/\(plugin.id)/\(version)/plugin.json"
    guard
      await performSettingsAction({
        try await self.client.installPluginFromUrl(manifestUrl: manifestURL)
      }) != nil
    else {
      return
    }
    await reloadSettings()
  }

  func choosePluginDirectory() {
    let panel = NSOpenPanel()
    panel.title = "Select Plugin Directory"
    panel.prompt = "Install"
    panel.canChooseDirectories = true
    panel.canChooseFiles = false
    panel.allowsMultipleSelection = false

    guard panel.runModal() == .OK, let url = panel.url else {
      return
    }
    Task {
      guard
        await performSettingsAction({
          try await self.client.installPluginFromDirectory(
            pluginPath: url.path
          )
        }) != nil
      else {
        return
      }
      await reloadSettings()
    }
  }

  func choosePluginArchive() {
    let panel = NSOpenPanel()
    panel.title = "Select Plugin ZIP"
    panel.prompt = "Install"
    panel.canChooseDirectories = false
    panel.canChooseFiles = true
    panel.allowsMultipleSelection = false
    if let zipType = UTType(filenameExtension: "zip") {
      panel.allowedContentTypes = [zipType]
    }

    guard panel.runModal() == .OK, let url = panel.url else {
      return
    }
    Task {
      guard
        await performSettingsAction({
          try await self.client.installPluginFromZip(zipPath: url.path)
        }) != nil
      else {
        return
      }
      await reloadSettings()
    }
  }

  func loadProjectLockStatus() async -> NativeProjectLockStatus? {
    guard let project else {
      return nil
    }
    return await performSettingsAction {
      try await self.client.getProjectLockStatus(projectPath: project.directory)
    }
  }

  func enableProjectEncryption(password: String) async -> NativeProjectLockStatus? {
    await performSettingsAction {
      try await self.client.setProjectPassword(newPassword: password)
    }
  }

  func changeProjectPassword(
    currentPassword: String,
    newPassword: String
  ) async -> NativeProjectLockStatus? {
    await performSettingsAction {
      try await self.client.changeProjectPassword(
        currentPassword: currentPassword,
        newPassword: newPassword
      )
    }
  }

  func removeProjectEncryption(password: String) async -> NativeProjectLockStatus? {
    await performSettingsAction {
      try await self.client.removeProjectPassword(currentPassword: password)
    }
  }

  func exportPreview() {
    guard let project else {
      return
    }
    let panel = NSSavePanel()
    panel.title = "Export Read-only Preview"
    panel.prompt = "Export"
    panel.nameFieldStringValue = "\(project.name)-preview.orproj"
    if let projectType = UTType(filenameExtension: "orproj") {
      panel.allowedContentTypes = [projectType]
    }

    guard panel.runModal() == .OK, let url = panel.url else {
      return
    }
    Task {
      guard
        await performSettingsAction({
          try await self.client.createPreviewProject(
            destinationPath: url.path
          )
        }) != nil
      else {
        return
      }
      settingsMessage = "Preview exported to \(url.path)"
    }
  }

  private func apply(settings: NativeSettingsSnapshot) {
    settingsSnapshot = settings
    project = settings.project
    plugins = settings.plugins
  }

  private func performSettingsAction<T>(
    _ operation: () async throws -> T
  ) async -> T? {
    isPerformingSettingsAction = true
    settingsMessage = nil
    defer { isPerformingSettingsAction = false }
    do {
      return try await operation()
    } catch {
      settingsMessage = error.localizedDescription
      return nil
    }
  }
}
