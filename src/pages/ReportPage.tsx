import { useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { BarChart2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MainLayout } from "@/components/layout/MainLayout";
import {
  ProjectScanHistorySidebar,
  type ProjectScanHistoryEntry,
} from "@/components/project/ProjectScanHistorySidebar";
import { ScanResultsPanel } from "@/components/project/ScanResultsPanel";
import { useBackendClient } from "@/hooks/useBackendClient";
import { formatScanPerformedAt, useProjectWorkspace } from "@/hooks/useProjectWorkspace";
import { unwrap } from "@/lib/utils";

interface ReportPageProps {
  projectDir?: string;
  routeScanId?: string;
}

function ReportCount({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-[20px] border border-border/70 bg-background px-4 py-4">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

export function ReportPage({ projectDir, routeScanId }: ReportPageProps) {
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

  const selectedEntry = useMemo(() => {
    return (
      workspace.scanHistoryEntries.find(
        (entry) => entry.id === workspace.selectedScanId,
      ) ?? null
    );
  }, [workspace.scanHistoryEntries, workspace.selectedScanId]);

  const goBack = async () => {
    try {
      await unwrap(backendClient.closeProject());
    } catch {
      // Ignore close errors; the entry page can reopen the project.
    }
    await navigate({ to: "/", search: { mode: undefined } });
  };

  const hasCompletedResult =
    workspace.scanDetail?.status === "Completed" &&
    workspace.scanDetail.results.length > 0;

  const handleSelectScan = (scanId: string | null) => {
    workspace.setSelectedScanId(scanId);
    if (!projectDir) {
      return;
    }

    void navigate({
      to: "/report",
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
            <section className="flex-1 min-w-0 overflow-y-auto">
              <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 px-4 py-6 lg:px-8 xl:px-10">
                <div className="rounded-[28px] border border-border/70 bg-card px-6 py-6 shadow-[0_20px_46px_-34px_rgba(15,23,42,0.18)]">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div className="space-y-2">
                      <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <BarChart2 className="h-6 w-6" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Report</p>
                        <h1 className="text-3xl font-semibold tracking-tight">
                          {selectedEntry?.title ?? "No scan selected"}
                        </h1>
                        <p className="text-sm text-muted-foreground">
                          Results-focused view aligned with the FE branch report
                          route.
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {selectedEntry?.pluginName ? (
                        <Badge variant="secondary">{selectedEntry.pluginName}</Badge>
                      ) : null}
                      {selectedEntry?.performedAt ? (
                        <Badge variant="outline">{selectedEntry.performedAt}</Badge>
                      ) : null}
                    </div>
                  </div>
                </div>

                {workspace.settingsError ? (
                  <p className="text-sm text-red-600">{workspace.settingsError}</p>
                ) : null}
                {workspace.scansError ? (
                  <p className="text-sm text-red-600">{workspace.scansError}</p>
                ) : null}
                {workspace.detailError ? (
                  <p className="text-sm text-red-600">{workspace.detailError}</p>
                ) : null}

                {workspace.selectedScan && workspace.scanDetail ? (
                  <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-3">
                      <ReportCount
                        label="Status"
                        value={workspace.selectedScan.status}
                      />
                      <ReportCount
                        label="Performed at"
                        value={formatScanPerformedAt(workspace.selectedScan.createdAt)}
                      />
                      <ReportCount
                        label="Results"
                        value={selectedEntry?.resultCount ?? 0}
                      />
                    </div>

                    {hasCompletedResult ? (
                      <ScanResultsPanel
                        anchorId="project-results-section"
                        scanDetail={workspace.scanDetail}
                        pluginNameById={workspace.pluginNameById}
                      />
                    ) : (
                      <div className="rounded-[24px] border border-border/70 bg-card px-6 py-8 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.16)]">
                        <p className="text-sm text-muted-foreground">
                          Select a completed scan to review the report.
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-[24px] border border-border/70 bg-card px-6 py-8 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.16)]">
                    <p className="text-sm text-muted-foreground">
                      Select a scan from the history panel.
                    </p>
                  </div>
                )}
              </div>
            </section>

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
