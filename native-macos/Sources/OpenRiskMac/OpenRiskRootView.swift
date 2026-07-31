import SwiftUI

struct OpenRiskRootView: View {
    @ObservedObject var model: OpenRiskAppModel
    @State private var historySearch = ""

    var body: some View {
        Group {
            if let project = model.project {
                workspace(project: project)
            } else {
                launcher
            }
        }
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
    }

    private var launcher: some View {
        VStack(spacing: 18) {
            Spacer()

            Image(systemName: "shield.lefthalf.filled.badge.checkmark")
                .font(.system(size: 58, weight: .regular))
                .foregroundStyle(.tint)
                .accessibilityHidden(true)

            VStack(spacing: 6) {
                Text("OpenRisk")
                    .font(.largeTitle.weight(.semibold))
                Text("Open a project to continue your investigations.")
                    .foregroundStyle(.secondary)
            }

            Button {
                model.chooseProject()
            } label: {
                Label("Open Project…", systemImage: "folder")
                    .frame(minWidth: 150)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
            .disabled(model.isLoadingProject)

            if model.isLoadingProject {
                ProgressView()
                    .controlSize(.small)
            }

            Spacer()
        }
        .padding(40)
    }

    private func workspace(project: NativeProjectSummary) -> some View {
        NavigationSplitView {
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
                        guard historySearch.isEmpty else {
                            return
                        }
                        model.moveActiveScans(from: offsets, to: destination)
                    }
                }

                if !filteredScans(model.archivedScans).isEmpty {
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
                            guard historySearch.isEmpty else {
                                return
                            }
                            model.moveArchivedScans(from: offsets, to: destination)
                        }
                    }
                }
            }
            .searchable(text: $historySearch, prompt: "Search investigations")
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
        }
    }

    private func filteredScans(_ scans: [NativeScanSummary]) -> [NativeScanSummary] {
        let query = historySearch.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !query.isEmpty else {
            return scans
        }
        return scans.filter { scan in
            (scan.preview ?? "Untitled").localizedCaseInsensitiveContains(query) ||
                (scan.pluginName?.localizedCaseInsensitiveContains(query) ?? false)
        }
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
                    isRunning: model.isRunning(detail.id) ||
                        detail.status.lowercased() == "running"
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
}

private struct ScanRow: View {
    let scan: NativeScanSummary
    let isRunning: Bool

    var body: some View {
        HStack(spacing: 10) {
            if isRunning {
                ProgressView()
                    .controlSize(.mini)
                    .frame(width: 18)
            } else if let statusSymbol {
                Image(systemName: statusSymbol)
                    .foregroundStyle(statusColor)
                    .frame(width: 18)
            } else {
                Color.clear
                    .frame(width: 18)
            }

            VStack(alignment: .leading, spacing: 3) {
                Text(scan.preview ?? "Untitled")
                    .lineLimit(1)

                HStack(spacing: 5) {
                    if isRunning {
                        Text("Running")
                    } else if scan.status.lowercased() == "draft" {
                        Text("Draft")
                    } else if let pluginName = scan.pluginName {
                        Text(pluginName)
                    }
                    if scan.resultCount > 0 {
                        Text("· \(scan.resultCount) results")
                    }
                }
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(1)
            }
        }
        .padding(.vertical, 3)
    }

    private var statusSymbol: String? {
        switch scan.status.lowercased() {
        case "completed", "complete", "success":
            return nil
        case "failed", "error":
            return "exclamationmark.circle.fill"
        case "draft":
            return "pencil.circle"
        case "running":
            return "clock"
        default:
            return "questionmark.circle.fill"
        }
    }

    private var statusColor: Color {
        switch scan.status.lowercased() {
        case "failed", "error":
            return .red
        case "draft", "running", "completed", "complete", "success":
            return .secondary
        default:
            return .orange
        }
    }
}

private struct ProjectPasswordView: View {
    let onCancel: () -> Void
    let onUnlock: (String) -> Void

    @State private var password = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            VStack(alignment: .leading, spacing: 5) {
                Text("Unlock Project")
                    .font(.title2.weight(.semibold))
                Text("Enter this project’s password.")
                    .foregroundStyle(.secondary)
            }

            SecureField("Password", text: $password)
                .onSubmit(unlock)

            HStack {
                Spacer()
                Button("Cancel", role: .cancel, action: onCancel)
                Button("Unlock", action: unlock)
                    .buttonStyle(.borderedProminent)
                    .disabled(password.isEmpty)
            }
        }
        .padding(24)
        .frame(width: 380)
    }

    private func unlock() {
        guard !password.isEmpty else {
            return
        }
        onUnlock(password)
    }
}

private struct RenameScanView: View {
    let onCancel: () -> Void
    let onRename: (String) -> Void

    @State private var name: String

    init(
        currentName: String,
        onCancel: @escaping () -> Void,
        onRename: @escaping (String) -> Void
    ) {
        self.onCancel = onCancel
        self.onRename = onRename
        _name = State(initialValue: currentName)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            VStack(alignment: .leading, spacing: 5) {
                Text("Rename Investigation")
                    .font(.title2.weight(.semibold))
                Text("The name is changed only when you edit it.")
                    .foregroundStyle(.secondary)
            }

            TextField("Investigation name", text: $name)
                .onSubmit(rename)

            HStack {
                Spacer()
                Button("Cancel", role: .cancel, action: onCancel)
                Button("Rename", action: rename)
                    .buttonStyle(.borderedProminent)
            }
        }
        .padding(24)
        .frame(width: 420)
    }

    private func rename() {
        onRename(name)
    }
}
