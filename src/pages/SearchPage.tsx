import { useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MainLayout } from "@/components/layout/MainLayout";
import { ProjectScanPanel } from "@/components/project/ProjectScanPanel";
import {
  ProjectScanHistorySidebar,
  type ProjectScanHistoryEntry,
} from "@/components/project/ProjectScanHistorySidebar";
import { useBackendClient } from "@/hooks/useBackendClient";
import { useProjectWorkspace, formatScanPerformedAt } from "@/hooks/useProjectWorkspace";
import { unwrap } from "@/lib/utils";
import { buildAllScansPdfDoc } from "@/utils/exportPdf";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { openPath } from "@tauri-apps/plugin-opener";
import { toast } from "sonner";

interface SearchPageProps {
  projectDir?: string;
  routeScanId?: string;
}

export function SearchPage({ projectDir, routeScanId }: SearchPageProps) {
  const navigate = useNavigate();
  const backendClient = useBackendClient();
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [querySearch, setQuerySearch] = useState("");

  const workspace = useProjectWorkspace(projectDir, routeScanId);

  const filteredEntries = useMemo<ProjectScanHistoryEntry[]>(() => {
    const q = querySearch.trim().toLowerCase();
    if (!q) return workspace.scanHistoryEntries;
    return workspace.scanHistoryEntries.filter((entry) => {
      return (
        entry.title.toLowerCase().includes(q) ||
        entry.id.toLowerCase().includes(q) ||
        (entry.pluginName ?? "").toLowerCase().includes(q)
      );
    });
  }, [querySearch, workspace.scanHistoryEntries]);

  const goBack = async () => {
    try {
      await unwrap(backendClient.closeProject());
    } catch {
      // Ignore close errors; the entry page can reopen the project.
    }
    await navigate({ to: "/", search: { mode: undefined } });
  };

  const handleSelectScan = (scanId: string | null) => {
    workspace.setSelectedScanId(scanId);
    if (!projectDir) {
      return;
    }

    void navigate({
      to: "/scans",
      search: {
        dir: projectDir,
        scan: scanId ?? undefined,
      },
      replace: true,
    });
  };

  const handlePrintAll = async () => {
    const completedScans = workspace.scans.filter(
      (s) => (s.status === "Completed" || s.status === "Failed") && !s.isArchived,
    );
    if (!completedScans.length) return;

    const entries = [];
    for (const scan of completedScans) {
      try {
        const detail = await unwrap(backendClient.getScan(scan.id));
        entries.push({
          scanTitle: scan.preview?.trim() || `Scan ${scan.id.slice(0, 8)}`,
          performedAt: formatScanPerformedAt(scan.createdAt),
          detail,
          pluginNameById: workspace.pluginNameById,
        });
      } catch {
        // skip unloadable scans
      }
    }
    if (!entries.length) return;

    const doc = buildAllScansPdfDoc(entries);
    const path = await save({
      defaultPath: "openrisk-all-scans.pdf",
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });
    if (!path) return;
    const bytes = new Uint8Array(doc.output("arraybuffer"));
    await writeFile(path, bytes);
    toast.success("All history of scans successfully saved to: ", {
      description: path,
      action: {
        label: "Open file",
        onClick: () => void openPath(path),
      },
    });
  };

  return (
    <MainLayout
      projectDir={projectDir}
      selectedScanId={workspace.selectedScanId}
      onGoBack={() => void goBack()}
      hasPlugins={workspace.settingsData === null ? true : workspace.settingsData.plugins.length > 0}
    >
      <div className="flex h-full w-full min-h-0 min-w-0 overflow-hidden bg-muted/[0.18] select-none">
        {!projectDir ? (
          <Card>
            <CardHeader>
              <CardTitle>No project selected</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Open or create a project first.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="flex min-w-0 flex-1 overflow-auto">
              <ProjectScanPanel
                selectedScan={workspace.selectedScan}
                scanDetail={workspace.scanDetail}
                settingsData={workspace.settingsData}
                settingsError={workspace.settingsError}
                detailError={workspace.detailError}
                pluginNameById={workspace.pluginNameById}
                selectedPluginId={workspace.selectedPluginId}
                enabledPlugins={workspace.enabledPlugins}
                pluginInputs={workspace.pluginInputs}
                running={workspace.running}
                creatingScan={workspace.creatingScan}
                onSelectPlugin={(pluginId) => workspace.setSelectedPluginId(pluginId)}
                onSetPluginEnabled={workspace.setPluginEnabled}
                onSetPluginField={workspace.setPluginField}
                onRunScan={() => void workspace.runScan()}
                onCreateScan={() => void workspace.createScan()}
              />
            </div>

            <ProjectScanHistorySidebar
              entries={filteredEntries}
              totalEntryCount={workspace.scanHistoryEntries.length}
              activeId={workspace.selectedScanId}
              querySearch={querySearch}
              creatingScan={workspace.creatingScan}
              renamingScanId={workspace.renamingScanId}
              renamingValue={workspace.renamingValue}
              scansError={workspace.scansError}
              searchInputRef={searchInputRef}
              onCreateScan={() => void workspace.createScan()}
              onSelect={(scanId) => handleSelectScan(scanId || null)}
              onStartRename={(scanId) => {
                const scan = workspace.scans.find((candidate) => candidate.id === scanId);
                if (scan) {
                  workspace.startRename(scan);
                }
              }}
              onRenamingValueChange={workspace.setRenamingValue}
              onCommitRename={() => void workspace.commitRename()}
              onCancelRename={workspace.cancelRename}
              onQuerySearchChange={setQuerySearch}
              onArchive={(scanId) => {
                const scan = workspace.scans.find((candidate) => candidate.id === scanId);
                if (scan) {
                  void workspace.archiveScan(scan);
                }
              }}
              onOpenSettings={() =>
                window.dispatchEvent(new CustomEvent("openrisk:open-settings"))
              }
              onPrintAll={() => void handlePrintAll()}
              onOpenHistoryPage={() =>
                void navigate({
                  to: "/history",
                  search: {
                    dir: projectDir,
                    scan: workspace.selectedScanId ?? undefined,
                  },
                })
              }
              onGoBack={() => void goBack()}
            />
          </>
        )}
      </div>
    </MainLayout>
  );
}
