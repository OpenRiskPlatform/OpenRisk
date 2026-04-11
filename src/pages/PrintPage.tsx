import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, FileDown, Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MainLayout } from "@/components/layout/MainLayout";
import { useBackendClient } from "@/hooks/useBackendClient";
import { ScanResultsPanel } from "@/components/project/ScanResultsPanel";
import { formatScanPerformedAt, useProjectWorkspace } from "@/hooks/useProjectWorkspace";
import { exportScanPdf } from "@/utils/exportPdf";
import { unwrap } from "@/lib/utils";

interface PrintPageProps {
  projectDir?: string;
  routeScanId?: string;
}

export function PrintPage({ projectDir, routeScanId }: PrintPageProps) {
  const navigate = useNavigate();
  const backendClient = useBackendClient();
  const workspace = useProjectWorkspace(projectDir, routeScanId);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedEntry = useMemo(() => {
    return (
      workspace.scanHistoryEntries.find(
        (entry) => entry.id === workspace.selectedScanId,
      ) ?? null
    );
  }, [workspace.scanHistoryEntries, workspace.selectedScanId]);

  const canExport =
    workspace.scanDetail !== null &&
    (workspace.scanDetail.status === "Completed" ||
      workspace.scanDetail.status === "Failed");

  const goBack = async () => {
    try {
      await unwrap(backendClient.closeProject());
    } catch {
      // Ignore close errors; the entry page can reopen the project.
    }
    await navigate({ to: "/", search: { mode: undefined } });
  };

  const handlePrint = async () => {
    setIsPrinting(true);
    setError(null);
    setFeedback(null);
    try {
      window.print();
      setFeedback("Print dialog opened.");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsPrinting(false);
    }
  };

  const handleExport = async () => {
    if (!workspace.scanDetail || !selectedEntry) {
      return;
    }

    setIsExporting(true);
    setError(null);
    setFeedback(null);
    try {
      const path = await exportScanPdf({
        scanTitle: selectedEntry.title,
        performedAt: selectedEntry.performedAt,
        detail: workspace.scanDetail,
        pluginNameById: workspace.pluginNameById,
      });
      if (path) {
        setFeedback(`PDF saved to ${path}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <MainLayout
      projectDir={projectDir}
      selectedScanId={workspace.selectedScanId}
      onGoBack={() => void goBack()}
    >
      <div className="min-h-full bg-muted/[0.18] px-6 py-6 lg:px-8 xl:px-10">
        <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-6">
          <div className="rounded-[28px] border border-border/70 bg-card px-6 py-6 shadow-[0_20px_46px_-34px_rgba(15,23,42,0.18)]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-3">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Printer className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Print</p>
                  <h1 className="text-3xl font-semibold tracking-tight">
                    {selectedEntry?.title ?? "No scan selected"}
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Minimal print/export view driven by the current scan and our
                    data model.
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

          <Card className="rounded-[24px] border-border/70 print:hidden">
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button
                onClick={() => void handlePrint()}
                disabled={!canExport || isPrinting || isExporting}
              >
                {isPrinting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Printer className="mr-2 h-4 w-4" />
                )}
                {isPrinting ? "Opening..." : "Print"}
              </Button>

              <Button
                variant="outline"
                onClick={() => void handleExport()}
                disabled={!canExport || isPrinting || isExporting}
              >
                {isExporting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FileDown className="mr-2 h-4 w-4" />
                )}
                {isExporting ? "Exporting..." : "Export as PDF"}
              </Button>

              <Button
                variant="ghost"
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
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to report
              </Button>

              {feedback ? (
                <p className="basis-full text-sm text-green-700">{feedback}</p>
              ) : null}
              {error ? (
                <p className="basis-full text-sm text-red-600">{error}</p>
              ) : null}
              {!canExport ? (
                <p className="basis-full text-sm text-muted-foreground">
                  Select a completed or failed scan to export.
                </p>
              ) : null}
            </CardContent>
          </Card>

          {workspace.settingsError ? (
            <p className="text-sm text-red-600">{workspace.settingsError}</p>
          ) : null}
          {workspace.scansError ? (
            <p className="text-sm text-red-600">{workspace.scansError}</p>
          ) : null}
          {workspace.detailError ? (
            <p className="text-sm text-red-600">{workspace.detailError}</p>
          ) : null}

          <div id="print-preview" className="rounded-[24px] border border-border/70 bg-card p-6 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.16)]">
            {workspace.selectedScan && workspace.scanDetail ? (
              <div className="space-y-5">
                <div className="grid gap-4 md:grid-cols-3">
                  <SummaryItem
                    label="Status"
                    value={workspace.selectedScan.status}
                  />
                  <SummaryItem
                    label="Performed at"
                    value={formatScanPerformedAt(workspace.selectedScan.createdAt)}
                  />
                  <SummaryItem
                    label="Results"
                    value={String(selectedEntry?.resultCount ?? 0)}
                  />
                </div>

                <ScanResultsPanel
                  scanDetail={workspace.scanDetail}
                  pluginNameById={workspace.pluginNameById}
                />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Select a scan to preview its printable report.
              </p>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-border/70 bg-background px-4 py-4">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}
