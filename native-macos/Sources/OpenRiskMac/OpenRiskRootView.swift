import SwiftUI

private enum InvestigationScope: String {
  case current
  case archived
}

struct OpenRiskRootView: View {
  @ObservedObject var model: OpenRiskAppModel
  @State private var historySearch = ""
  @State private var investigationScope: InvestigationScope = .current

  var body: some View {
    Group {
      if let project = model.project {
        workspace(project: project)
      } else {
        NativeProjectLauncherView(model: model)
      }
    }
    .preferredColorScheme(preferredColorScheme)
    .alert(
      "OpenRisk needs your attention",
      isPresented: Binding(
        get: { model.errorMessage != nil },
        set: { if !$0 { model.errorMessage = nil } }
      )
    ) {
      Button("OK", role: .cancel) {
        model.errorMessage = nil
      }
    } message: {
      Text(model.errorMessage ?? "Unknown error")
    }
    .sheet(
      isPresented: Binding(
        get: { model.pendingLockedProjectPath != nil },
        set: { if !$0 { model.cancelUnlock() } }
      )
    ) {
      ProjectPasswordView(
        onCancel: model.cancelUnlock,
        onUnlock: model.unlockPendingProject
      )
    }
    .sheet(
      isPresented: Binding(
        get: { model.scanPendingRename != nil },
        set: { if !$0 { model.cancelRenaming() } }
      )
    ) {
      if let scan = model.scanPendingRename {
        RenameScanView(
          currentName: scan.preview ?? "Untitled",
          onCancel: model.cancelRenaming,
          onRename: model.renamePendingScan
        )
      }
    }
    .sheet(isPresented: $model.isSettingsPresented) {
      NativeSettingsView(model: model)
    }
  }

  private func workspace(project: NativeProjectSummary) -> some View {
    NavigationSplitView {
      VStack(spacing: 0) {
        Picker("Investigations", selection: $investigationScope) {
          Text("Current").tag(InvestigationScope.current)
          Text("Archived \(model.archivedScans.count)")
            .tag(InvestigationScope.archived)
        }
        .pickerStyle(.segmented)
        .labelsHidden()
        .padding(.horizontal, 12)
        .padding(.vertical, 10)

        Divider()

        List(
          selection: Binding(
            get: { model.selectedScanID },
            set: { scanID in
              Task { @MainActor in
                await Task.yield()
                model.selectScan(scanID)
              }
            }
          )
        ) {
          if investigationScope == .current {
            Section("Investigations") {
              ForEach(filteredScans(model.activeScans), id: \.id) { scan in
                ScanRow(scan: scan, isRunning: model.isRunning(scan.id))
                  .tag(scan.id)
                  .contextMenu {
                    Button {
                      model.beginRenaming(scan)
                    } label: {
                      Label("Rename", systemImage: "pencil")
                    }

                    Button {
                      model.setArchived(scan, archived: true)
                    } label: {
                      Label("Archive", systemImage: "archivebox")
                    }
                  }
              }
              .onMove { offsets, destination in
                guard trimmedHistorySearch.isEmpty else {
                  return
                }
                model.moveActiveScans(from: offsets, to: destination)
              }
            }
          } else if filteredScans(model.archivedScans).isEmpty {
            Text(
              trimmedHistorySearch.isEmpty
                ? "No archived investigations"
                : "No archived investigations found"
            )
            .font(.subheadline)
            .foregroundStyle(.secondary)
          } else {
            Section("Archived") {
              ForEach(filteredScans(model.archivedScans), id: \.id) { scan in
                ScanRow(scan: scan, isRunning: model.isRunning(scan.id))
                  .tag(scan.id)
                  .contextMenu {
                    Button {
                      model.beginRenaming(scan)
                    } label: {
                      Label("Rename", systemImage: "pencil")
                    }

                    Button {
                      model.setArchived(scan, archived: false)
                    } label: {
                      Label(
                        "Restore",
                        systemImage: "arrow.uturn.backward"
                      )
                    }
                  }
              }
              .onMove { offsets, destination in
                guard trimmedHistorySearch.isEmpty else {
                  return
                }
                model.moveArchivedScans(from: offsets, to: destination)
              }
            }
          }
        }
        .searchable(text: $historySearch, prompt: "Search investigations")
      }
      .navigationTitle(project.name)
      .navigationSplitViewColumnWidth(min: 240, ideal: 280, max: 360)
      .toolbar {
        ToolbarItem(placement: .primaryAction) {
          Button {
            model.createInvestigation()
          } label: {
            Label("New Investigation", systemImage: "plus")
          }
          .disabled(model.isCreatingScan)
          .keyboardShortcut("n")
        }
      }
      .onChange(of: investigationScope) { _, scope in
        historySearch = ""
        model.selectScan(
          scope == .current
            ? model.activeScans.first?.id
            : model.archivedScans.first?.id
        )
      }
      .onChange(of: visibleScanIDs) { _, ids in
        if let selectedScanID = model.selectedScanID,
          ids.contains(selectedScanID)
        {
          return
        }
        model.selectScan(ids.first)
      }
    } detail: {
      scanDetail
    }
    .toolbar {
      ToolbarItem(placement: .navigation) {
        Button {
          model.closeProject()
        } label: {
          Label("Close Project", systemImage: "xmark")
        }
      }
      ToolbarItem(placement: .primaryAction) {
        Button {
          model.presentSettings()
        } label: {
          Label("Settings", systemImage: "gearshape")
        }
        .keyboardShortcut(",")
      }
    }
  }

  private func filteredScans(_ scans: [NativeScanSummary]) -> [NativeScanSummary] {
    let query = trimmedHistorySearch
    guard !query.isEmpty else {
      return scans
    }
    return scans.filter { scan in
      (scan.preview ?? "Untitled").localizedCaseInsensitiveContains(query)
        || (scan.pluginName?.localizedCaseInsensitiveContains(query) ?? false)
    }
  }

  private var trimmedHistorySearch: String {
    historySearch.trimmingCharacters(in: .whitespacesAndNewlines)
  }

  private var visibleScanIDs: [String] {
    let scans =
      investigationScope == .current
      ? model.activeScans
      : model.archivedScans
    return filteredScans(scans).map(\.id)
  }

  @ViewBuilder
  private var scanDetail: some View {
    if model.isLoadingScan {
      ProgressView("Loading investigation…")
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    } else if let detail = model.selectedScanDetail {
      if detail.status.lowercased() == "draft" {
        InvestigationEditorView(
          model: model,
          detail: detail,
          plugins: model.enabledPlugins
        )
        .id(detail.id)
      } else {
        NativeScanResultView(
          detail: detail,
          plugins: model.plugins,
          isRunning: model.isRunning(detail.id) || detail.status.lowercased() == "running",
          advancedMode: model.settingsSnapshot?.projectSettings.advancedMode ?? false
        )
        .id(detail.id)
      }
    } else {
      ContentUnavailableView(
        "No Investigation Selected",
        systemImage: "doc.text.magnifyingglass",
        description: Text(
          "Choose an investigation or create a new one."
        )
      )
    }
  }

  private var preferredColorScheme: ColorScheme? {
    switch model.settingsSnapshot?.projectSettings.theme.lowercased() {
    case "light": .light
    case "dark": .dark
    default: nil
    }
  }
}
