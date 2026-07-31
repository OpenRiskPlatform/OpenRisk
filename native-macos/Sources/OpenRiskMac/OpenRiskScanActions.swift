import SwiftUI

@MainActor
extension OpenRiskAppModel {
    func selectScan(_ scanID: String?) {
        guard selectedScanID != scanID || selectedScanDetail?.id != scanID else {
            return
        }

        detailTask?.cancel()
        selectedScanID = scanID
        selectedScanDetail = nil
        isLoadingScan = scanID != nil

        guard let scanID else {
            isLoadingScan = false
            return
        }

        detailTask = Task {
            do {
                let detail = try await client.getScan(scanId: scanID)
                guard !Task.isCancelled, selectedScanID == scanID else {
                    return
                }
                selectedScanDetail = detail
                isLoadingScan = false
            } catch {
                guard !Task.isCancelled else {
                    return
                }
                isLoadingScan = false
                errorMessage = error.localizedDescription
            }
        }
    }

    func createInvestigation() {
        guard !isCreatingScan else {
            return
        }

        isCreatingScan = true
        Task {
            defer { isCreatingScan = false }
            do {
                let scan = try await client.createScan(preview: "Untitled")
                scans.insert(scan, at: 0)
                selectScan(scan.id)
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }

    @discardableResult
    func saveDraft(
        scanID: String,
        name: String,
        selections: [NativePluginSelection],
        inputs: [NativeScanInput]
    ) async -> Bool {
        guard !runningScanIDs.contains(scanID) else {
            return false
        }

        do {
            let summary = try await client.saveScanDraft(
                scanId: scanID,
                preview: name,
                selectedPlugins: selections,
                inputs: inputs
            )
            replaceSummary(summary)
            if selectedScanID == scanID,
               !runningScanIDs.contains(scanID),
               let detail = selectedScanDetail {
                selectedScanDetail = NativeScanDetail(
                    id: detail.id,
                    status: summary.status,
                    preview: summary.preview,
                    createdAt: detail.createdAt,
                    selectedPlugins: selections,
                    inputs: inputs,
                    results: detail.results
                )
            }
            return true
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }

    func runInvestigation(
        scanID: String,
        name: String,
        selections: [NativePluginSelection],
        inputs: [NativeScanInput]
    ) {
        guard !runningScanIDs.contains(scanID) else {
            return
        }

        runningScanIDs.insert(scanID)
        markScanRunning(scanID: scanID, name: name)

        Task {
            do {
                let completed = try await client.runScan(
                    scanId: scanID,
                    preview: name,
                    selectedPlugins: selections,
                    inputs: inputs
                )
                await refreshScans()
                if selectedScanID == scanID {
                    selectedScanDetail = completed
                }
            } catch {
                await refreshScans()
                if selectedScanID == scanID {
                    await reloadSelectedScan()
                }
                errorMessage = error.localizedDescription
            }
            runningScanIDs.remove(scanID)
        }
    }

    func setArchived(_ scan: NativeScanSummary, archived: Bool) {
        Task {
            do {
                let updated = try await client.setScanArchived(
                    scanId: scan.id,
                    archived: archived
                )
                replaceSummary(updated)
                if archived, selectedScanID == scan.id {
                    selectScan(activeScans.first?.id)
                }
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }

    func beginRenaming(_ scan: NativeScanSummary) {
        scanPendingRename = scan
    }

    func cancelRenaming() {
        scanPendingRename = nil
    }

    func renamePendingScan(to name: String) {
        guard let scan = scanPendingRename else {
            return
        }
        scanPendingRename = nil

        Task {
            do {
                let updated = try await client.renameScan(
                    scanId: scan.id,
                    preview: name
                )
                replaceSummary(updated)
                if selectedScanID == scan.id {
                    await reloadSelectedScan()
                }
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }

    func moveActiveScans(from offsets: IndexSet, to destination: Int) {
        var reordered = activeScans
        reordered.move(fromOffsets: offsets, toOffset: destination)
        persistOrder(reordered + archivedScans)
    }

    func moveArchivedScans(from offsets: IndexSet, to destination: Int) {
        var reordered = archivedScans
        reordered.move(fromOffsets: offsets, toOffset: destination)
        persistOrder(activeScans + reordered)
    }

    func isRunning(_ scanID: String) -> Bool {
        runningScanIDs.contains(scanID)
    }

    func closeProject() {
        detailTask?.cancel()
        Task {
            await client.closeProject()
            project = nil
            scans = []
            plugins = []
            settingsSnapshot = nil
            pluginRegistry = nil
            selectedScanID = nil
            selectedScanDetail = nil
            runningScanIDs = []
            scanPendingRename = nil
            isSettingsPresented = false
            settingsMessage = nil
            errorMessage = nil
        }
    }

    private func refreshScans() async {
        do {
            scans = try await client.listScans()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func reloadSelectedScan() async {
        guard let selectedScanID else {
            return
        }
        do {
            selectedScanDetail = try await client.getScan(scanId: selectedScanID)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func replaceSummary(_ updated: NativeScanSummary) {
        if let index = scans.firstIndex(where: { $0.id == updated.id }) {
            scans[index] = updated
        } else {
            scans.insert(updated, at: 0)
        }
    }

    private func markScanRunning(scanID: String, name: String) {
        if let scan = scans.first(where: { $0.id == scanID }) {
            replaceSummary(
                NativeScanSummary(
                    id: scan.id,
                    status: "Running",
                    preview: name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                        ? "Untitled"
                        : name,
                    createdAt: scan.createdAt,
                    pluginName: scan.pluginName,
                    resultCount: scan.resultCount,
                    errorResultCount: scan.errorResultCount,
                    isArchived: scan.isArchived,
                    sortOrder: scan.sortOrder
                )
            )
        }

        if selectedScanID == scanID, let detail = selectedScanDetail {
            selectedScanDetail = NativeScanDetail(
                id: detail.id,
                status: "Running",
                preview: name,
                createdAt: detail.createdAt,
                selectedPlugins: detail.selectedPlugins,
                inputs: detail.inputs,
                results: detail.results
            )
        }
    }

    private func persistOrder(_ reordered: [NativeScanSummary]) {
        scans = reordered
        Task {
            do {
                scans = try await client.reorderScans(
                    orderedScanIds: reordered.map(\.id)
                )
            } catch {
                await refreshScans()
                errorMessage = error.localizedDescription
            }
        }
    }
}
