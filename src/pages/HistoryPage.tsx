import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
    Archive,
    Clock,
    Search as SearchIcon,
    ChevronRight,
    CheckCircle2,
    XCircle,
    Loader2,
    FileEdit,
} from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ExportPdfButton } from "@/components/project/ExportPdfButton";
import { useBackendClient } from "@/hooks/useBackendClient";
import { useProjectWorkspace } from "@/hooks/useProjectWorkspace";
import { unwrap } from "@/lib/utils";

interface HistoryPageProps {
    projectDir?: string;
    routeScanId?: string;
}

function StatusIcon({ status }: { status: string }) {
    switch (status) {
        case "Running":
            return <Loader2 className="h-4 w-4 text-sky-600 animate-spin" />;
        case "Completed":
            return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
        case "Failed":
            return <XCircle className="h-4 w-4 text-red-600" />;
        case "Draft":
            return <FileEdit className="h-4 w-4 text-amber-600" />;
        default:
            return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
}

export function HistoryPage({ projectDir, routeScanId }: HistoryPageProps) {
    const navigate = useNavigate();
    const backendClient = useBackendClient();
    const workspace = useProjectWorkspace(projectDir, routeScanId);
    const [querySearch, setQuerySearch] = useState("");
    const [showArchived, setShowArchived] = useState(false);

    const allEntries = useMemo(() => {
        return workspace.scans.map((scan) => ({
            id: scan.id,
            title: scan.preview?.trim() || `New Scan ${scan.id.slice(0, 8)}`,
            status: scan.status,
            performedAt: scan.createdAt,
            pluginName: scan.pluginName,
            resultCount: scan.resultCount,
            isArchived: scan.isArchived,
        }));
    }, [workspace.scans]);

    const filtered = useMemo(() => {
        const q = querySearch.trim().toLowerCase();
        return allEntries
            .filter((entry) => (showArchived ? true : !entry.isArchived))
            .filter((entry) => {
                if (!q) return true;
                return (
                    entry.title.toLowerCase().includes(q) ||
                    entry.id.toLowerCase().includes(q) ||
                    (entry.pluginName ?? "").toLowerCase().includes(q) ||
                    entry.status.toLowerCase().includes(q)
                );
            });
    }, [allEntries, querySearch, showArchived]);

    const selectedScanDetail = workspace.scanDetail;
    const selectedEntry =
        workspace.scanHistoryEntries.find((e) => e.id === workspace.selectedScanId) ?? null;

    const goBack = async () => {
        try {
            await unwrap(backendClient.closeProject());
        } catch {
            // ignore
        }
        await navigate({ to: "/", search: { mode: undefined } });
    };

    const openScan = (scanId: string) => {
        workspace.setSelectedScanId(scanId);
        if (!projectDir) return;
        void navigate({
            to: "/history",
            search: { dir: projectDir, scan: scanId },
            replace: true,
        });
    };

    const gotoScansPage = (scanId: string) => {
        if (!projectDir) return;
        void navigate({
            to: "/scans",
            search: { dir: projectDir, scan: scanId },
        });
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
                                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                                    <div className="space-y-2">
                                        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                                            <Clock className="h-6 w-6" />
                                        </div>
                                        <h1 className="text-3xl font-semibold tracking-tight">
                                            Scan History
                                        </h1>
                                        <p className="text-sm text-muted-foreground">
                                            Browse every scan performed in this project.
                                        </p>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2">
                                        <div className="relative">
                                            <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                                            <Input
                                                value={querySearch}
                                                onChange={(e) => setQuerySearch(e.target.value)}
                                                placeholder="Search scans..."
                                                className="h-9 w-64 pl-8 text-sm"
                                            />
                                        </div>
                                        <Button
                                            type="button"
                                            variant={showArchived ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => setShowArchived((v) => !v)}
                                        >
                                            <Archive className="mr-1 h-3.5 w-3.5" />
                                            {showArchived ? "Hide archived" : "Show archived"}
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            {workspace.scansError ? (
                                <p className="text-sm text-red-600">{workspace.scansError}</p>
                            ) : null}

                            <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
                                <Card className="rounded-[24px] border-border/70">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-base flex items-center gap-2">
                                            <Clock className="h-4 w-4" />
                                            All Scans
                                            <Badge variant="secondary" className="ml-1 text-[10px]">
                                                {filtered.length}
                                            </Badge>
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-0">
                                        <ScrollArea className="h-[60vh]">
                                            {filtered.length === 0 ? (
                                                <p className="p-4 text-sm text-muted-foreground">
                                                    No scans found.
                                                </p>
                                            ) : (
                                                <ul className="divide-y">
                                                    {filtered.map((entry) => {
                                                        const isActive =
                                                            entry.id === workspace.selectedScanId;
                                                        return (
                                                            <li key={entry.id}>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => openScan(entry.id)}
                                                                    className={`w-full text-left px-4 py-3 hover:bg-muted/60 transition-colors ${
                                                                        isActive ? "bg-muted" : ""
                                                                    }`}
                                                                >
                                                                    <div className="flex items-start gap-3">
                                                                        <div className="mt-0.5">
                                                                            <StatusIcon status={entry.status} />
                                                                        </div>
                                                                        <div className="min-w-0 flex-1">
                                                                            <div className="flex items-center gap-2">
                                                                                <p className="truncate text-sm font-medium">
                                                                                    {entry.title}
                                                                                </p>
                                                                                {entry.isArchived ? (
                                                                                    <Badge
                                                                                        variant="outline"
                                                                                        className="text-[9px] px-1 py-0"
                                                                                    >
                                                                                        archived
                                                                                    </Badge>
                                                                                ) : null}
                                                                            </div>
                                                                            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                                                                                <span>{entry.status}</span>
                                                                                {entry.pluginName ? (
                                                                                    <>
                                                                                        <span>·</span>
                                                                                        <span>{entry.pluginName}</span>
                                                                                    </>
                                                                                ) : null}
                                                                                {entry.resultCount !== null ? (
                                                                                    <>
                                                                                        <span>·</span>
                                                                                        <span>
                                                                                            {entry.resultCount} result
                                                                                            {entry.resultCount === 1 ? "" : "s"}
                                                                                        </span>
                                                                                    </>
                                                                                ) : null}
                                                                            </div>
                                                                            <p className="mt-0.5 text-[10px] text-muted-foreground/70">
                                                                                {entry.performedAt}
                                                                            </p>
                                                                        </div>
                                                                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                                                                    </div>
                                                                </button>
                                                            </li>
                                                        );
                                                    })}
                                                </ul>
                                            )}
                                        </ScrollArea>
                                    </CardContent>
                                </Card>

                                <Card className="rounded-[24px] border-border/70">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-base">
                                            {selectedEntry?.title ?? "Select a scan"}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                        {workspace.selectedScanId && selectedEntry ? (
                                            <>
                                                <div className="grid gap-2 md:grid-cols-3 text-xs">
                                                    <div className="rounded-md border px-3 py-2">
                                                        <p className="text-muted-foreground">Status</p>
                                                        <p className="mt-0.5 font-medium">
                                                            {selectedEntry.status}
                                                        </p>
                                                    </div>
                                                    <div className="rounded-md border px-3 py-2">
                                                        <p className="text-muted-foreground">Performed</p>
                                                        <p className="mt-0.5 font-medium">
                                                            {selectedEntry.performedAt}
                                                        </p>
                                                    </div>
                                                    <div className="rounded-md border px-3 py-2">
                                                        <p className="text-muted-foreground">Results</p>
                                                        <p className="mt-0.5 font-medium">
                                                            {selectedEntry.resultCount ?? 0}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        onClick={() => gotoScansPage(workspace.selectedScanId!)}
                                                    >
                                                        Open in Scans
                                                    </Button>
                                                    <ExportPdfButton
                                                        scanDetail={selectedScanDetail}
                                                        scanTitle={selectedEntry.title}
                                                        performedAt={selectedEntry.performedAt}
                                                        pluginNameById={workspace.pluginNameById}
                                                    />
                                                </div>
                                                {selectedScanDetail ? (
                                                    <div className="text-xs text-muted-foreground">
                                                        {selectedScanDetail.selectedPlugins.length} plugin run(s),{" "}
                                                        {selectedScanDetail.results.length} result row(s)
                                                    </div>
                                                ) : null}
                                            </>
                                        ) : (
                                            <p className="text-sm text-muted-foreground">
                                                Click any scan on the left to see details.
                                            </p>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </MainLayout>
    );
}

