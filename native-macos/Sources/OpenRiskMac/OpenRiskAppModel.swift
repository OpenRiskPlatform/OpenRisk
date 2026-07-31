import SwiftUI

@MainActor
final class OpenRiskAppModel: ObservableObject {
    @Published var project: NativeProjectSummary?
    @Published var scans: [NativeScanSummary] = []
    @Published var plugins: [NativePlugin] = []
    @Published var settingsSnapshot: NativeSettingsSnapshot?
    @Published var pluginRegistry: NativePluginRegistry?
    @Published var recentProjectPaths = NativeRecentProjects.load()
    @Published var selectedScanID: String?
    @Published var selectedScanDetail: NativeScanDetail?
    @Published var errorMessage: String?
    @Published var isLoadingProject = false
    @Published var isLoadingScan = false
    @Published var isCreatingScan = false
    @Published var isPerformingSettingsAction = false
    @Published var runningScanIDs: Set<String> = []
    @Published var pendingLockedProjectPath: String?
    @Published var scanPendingRename: NativeScanSummary?
    @Published var isSettingsPresented = false
    @Published var settingsMessage: String?

    let client = NativeOpenRiskClient()
    var detailTask: Task<Void, Never>?

    var activeScans: [NativeScanSummary] {
        scans.filter { !$0.isArchived }
    }

    var archivedScans: [NativeScanSummary] {
        scans.filter(\.isArchived)
    }

    var selectedScan: NativeScanSummary? {
        scans.first { $0.id == selectedScanID }
    }

    var enabledPlugins: [NativePlugin] {
        plugins.filter(\.enabled)
    }

}
