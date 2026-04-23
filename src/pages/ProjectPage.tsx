import { useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { FolderKanban, Search, BarChart2, Puzzle } from "lucide-react";
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

  // While settings are loading, assume plugins exist to avoid flash of empty state
  const hasPlugins = workspace.settingsData === null
    ? true
    : workspace.settingsData.plugins.length > 0;

  return (
    <MainLayout
      projectDir={projectDir}
      selectedScanId={workspace.selectedScanId}
      onGoBack={() => void goBack()}
      hasPlugins={hasPlugins}
    >
      <div className="min-h-full bg-muted/[0.18] px-16 py-10 lg:px-24 xl:px-32">
        <div className="flex w-full flex-col gap-6">
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
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    {hasPlugins ? (
                      <>
                        <Button
                          variant="outline"
                          className="gap-2"
                          onClick={() =>
                            window.dispatchEvent(new CustomEvent("openrisk:open-settings"))
                          }
                        >
                          <Puzzle className="h-4 w-4" />
                          Add Plugin
                        </Button>
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
                      </>
                    ) : null}
                  </div>
                </div>

                {/* Project details inline */}
                <div className="mt-6 pt-5 border-t border-border/50 grid gap-3 sm:grid-cols-2">
                  <InfoRow
                    label="Project ID"
                    value={workspace.settingsData?.project.id ?? "Unknown"}
                  />
                  <InfoRow label="Directory" value={projectDir} />
                </div>
              </div>

              {workspace.settingsError ? (
                <p className="text-sm text-red-600">{workspace.settingsError}</p>
              ) : null}
              {workspace.scansError ? (
                <p className="text-sm text-red-600">{workspace.scansError}</p>
              ) : null}

              {hasPlugins ? (
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
              ) : null}

              {!hasPlugins ? (
                <div className="rounded-[24px] border-2 border-amber-400/60 bg-amber-50 dark:bg-amber-950/40 px-6 py-6 shadow-[0_12px_32px_-16px_rgba(245,158,11,0.25)] flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-4">
                    <div className="shrink-0 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 dark:bg-amber-900 text-amber-600 dark:text-amber-300">
                      <Puzzle className="h-6 w-6" />
                    </div>
                    <div className="space-y-1">
                      <p className="font-semibold text-amber-900 dark:text-amber-200 text-base">
                        No plugins installed
                      </p>
                      <p className="text-sm text-amber-700 dark:text-amber-400 max-w-lg">
                        This project has no plugins yet. Install at least one plugin to unlock scanning, reports, history and all other features.
                      </p>
                    </div>
                  </div>
                  <Button
                    className="shrink-0 gap-2 bg-amber-500 hover:bg-amber-600 text-white dark:bg-amber-600 dark:hover:bg-amber-500"
                    onClick={() =>
                      window.dispatchEvent(new CustomEvent("openrisk:open-settings"))
                    }
                  >
                    <Puzzle className="h-4 w-4" />
                    Install a Plugin
                  </Button>
                </div>
              ) : null}

              <div className="grid gap-6 xl:grid-cols-[1fr]">
                {hasPlugins ? (
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
                ) : null}
              </div>
            </>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
