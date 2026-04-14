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
import { useProjectWorkspace } from "@/hooks/useProjectWorkspace";
import { unwrap } from "@/lib/utils";

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
    if (!q) {
      return workspace.scanHistoryEntries;
    }

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

  return (
    <MainLayout
      projectDir={projectDir}
      selectedScanId={workspace.selectedScanId}
      onGoBack={() => void goBack()}
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
                onSelectPlugin={(pluginId) => workspace.setSelectedPluginId(pluginId)}
                onSetPluginEnabled={workspace.setPluginEnabled}
                onSetPluginField={workspace.setPluginField}
                onRunScan={() => void workspace.runScan()}
              />
            </div>

            <ProjectScanHistorySidebar
              entries={filteredEntries}
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
              onMoveScan={(scanId, delta) => {
                const scan = workspace.scans.find((candidate) => candidate.id === scanId);
                if (scan) {
                  void workspace.moveScan(scan, delta);
                }
              }}
              onArchive={(scanId) => {
                const scan = workspace.scans.find((candidate) => candidate.id === scanId);
                if (scan) {
                  void workspace.archiveScan(scan);
                }
              }}
              onOpenSettings={() =>
                window.dispatchEvent(new CustomEvent("openrisk:open-settings"))
              }
              onGoBack={() => void goBack()}
            />
          </>
        )}
      </div>
    </MainLayout>
  );
}
