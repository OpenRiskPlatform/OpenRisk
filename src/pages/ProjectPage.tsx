import { useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { FolderKanban, Search, BarChart2 } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useBackendClient } from "@/hooks/useBackendClient";
import { formatScanPerformedAt, useProjectWorkspace } from "@/hooks/useProjectWorkspace";
import { unwrap } from "@/lib/utils";

interface ProjectPageProps {
  projectDir?: string;
}

function CountCard({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-[22px] border border-border/70 bg-card px-5 py-5 shadow-[0_18px_40px_-30px_rgba(15,23,42,0.15)]">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-border/70 bg-card px-4 py-4">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-medium">{value}</p>
    </div>
  );
}

export function ProjectPage({ projectDir }: ProjectPageProps) {
  const navigate = useNavigate();
  const backendClient = useBackendClient();
  const workspace = useProjectWorkspace(projectDir);

  const scanStats = useMemo(() => {
    let draft = 0;
    let running = 0;
    let completed = 0;
    let failed = 0;

    for (const scan of workspace.scans) {
      if (scan.isArchived) {
        continue;
      }
      if (scan.status === "Draft") draft += 1;
      if (scan.status === "Running") running += 1;
      if (scan.status === "Completed") completed += 1;
      if (scan.status === "Failed") failed += 1;
    }

    return { draft, running, completed, failed };
  }, [workspace.scans]);

  const latestActiveScan = useMemo(() => {
    return workspace.scans.find((scan) => !scan.isArchived) ?? null;
  }, [workspace.scans]);

  const goBack = async () => {
    try {
      await unwrap(backendClient.closeProject());
    } catch {
      // Ignore close errors; the entry page can reopen the project.
    }
    await navigate({ to: "/", search: { mode: undefined } });
  };

  return (
    <MainLayout
      projectDir={projectDir}
      selectedScanId={workspace.selectedScanId}
      onGoBack={() => void goBack()}
    >
      <div className="min-h-full bg-muted/[0.18] px-6 py-6 lg:px-8 xl:px-10">
        <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-6">
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
              <div className="rounded-[28px] border border-border/70 bg-card px-6 py-6 shadow-[0_20px_46px_-34px_rgba(15,23,42,0.18)]">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-3">
                    <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <FolderKanban className="h-6 w-6" />
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-sm text-muted-foreground">Project overview</p>
                      <h1 className="text-3xl font-semibold tracking-tight">
                        {workspace.settingsData?.project.name ?? "Project"}
                      </h1>
                      <p className="max-w-2xl text-sm text-muted-foreground">
                        This view matches the FE branch project screen: project
                        metadata, plugin inventory, and scan summary.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button
                      className="gap-2"
                      onClick={() =>
                        void navigate({
                          to: "/scans",
                          search: {
                            dir: projectDir,
                            scan: workspace.selectedScanId ?? undefined,
                          },
                        })
                      }
                    >
                      <Search className="h-4 w-4" />
                      Open Search
                    </Button>
                    <Button
                      variant="outline"
                      className="gap-2"
                      onClick={() =>
                        void navigate({
                          to: "/report",
                          search: {
                            dir: projectDir,
                            scan: workspace.selectedScanId ?? undefined,
                          },
                        })
                      }
                    >
                      <BarChart2 className="h-4 w-4" />
                      View Report
                    </Button>
                  </div>
                </div>
              </div>

              {workspace.settingsError ? (
                <p className="text-sm text-red-600">{workspace.settingsError}</p>
              ) : null}
              {workspace.scansError ? (
                <p className="text-sm text-red-600">{workspace.scansError}</p>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <CountCard
                  label="Enabled plugins"
                  value={
                    workspace.settingsData?.plugins.filter((plugin) => plugin.enabled)
                      .length ?? 0
                  }
                />
                <CountCard label="Draft scans" value={scanStats.draft} />
                <CountCard label="Completed scans" value={scanStats.completed} />
                <CountCard label="Failed scans" value={scanStats.failed} />
              </div>

              <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                <div className="space-y-4 rounded-[28px] border border-border/70 bg-card p-6 shadow-[0_18px_40px_-30px_rgba(15,23,42,0.16)]">
                  <h2 className="text-lg font-semibold">Project details</h2>
                  <div className="grid gap-3 md:grid-cols-2">
                    <InfoRow
                      label="Project name"
                      value={workspace.settingsData?.project.name ?? "Unknown"}
                    />
                    <InfoRow
                      label="Project ID"
                      value={workspace.settingsData?.project.id ?? "Unknown"}
                    />
                    <InfoRow label="Directory" value={projectDir} />
                    <InfoRow
                      label="Audit"
                      value={workspace.settingsData?.project.audit ?? "Not configured"}
                    />
                  </div>
                </div>

                <div className="space-y-4 rounded-[28px] border border-border/70 bg-card p-6 shadow-[0_18px_40px_-30px_rgba(15,23,42,0.16)]">
                  <h2 className="text-lg font-semibold">Current activity</h2>
                  {latestActiveScan ? (
                    <div className="space-y-3">
                      <InfoRow
                        label="Latest scan"
                        value={
                          latestActiveScan.preview?.trim() ||
                          `New Scan ${latestActiveScan.id.slice(0, 8)}`
                        }
                      />
                      <InfoRow
                        label="Performed at"
                        value={formatScanPerformedAt(latestActiveScan.createdAt)}
                      />
                      <InfoRow
                        label="Status"
                        value={latestActiveScan.status}
                      />
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No active scans yet.
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
