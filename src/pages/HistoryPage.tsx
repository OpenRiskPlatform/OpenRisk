import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
    Clock,
    Search as SearchIcon,
    ChevronRight,
    CheckCircle2,
    XCircle,
    Loader2,
    FileEdit,
    Filter,
    X,
} from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ExportPdfButton } from "@/components/project/ExportPdfButton";
import { ScanResultsPanel } from "@/components/project/ScanResultsPanel";
import { useBackendClient } from "@/hooks/useBackendClient";
import { useProjectWorkspace } from "@/hooks/useProjectWorkspace";
import { unwrap } from "@/lib/utils";
import { FavoritesProvider } from "@/core/favorites-context";

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
    const [pluginFilter, setPluginFilter] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState<string | null>(null);

    const allEntries = useMemo(() => {
        return workspace.scans.map((scan) => ({
            id: scan.id,
            title: scan.preview?.trim() || `New Scan ${scan.id.slice(0, 8)}`,
            status: scan.status,
            performedAt: scan.createdAt,
            pluginName: scan.pluginName,
            resultCount: scan.resultCount,
            errorResultCount: scan.errorResultCount,
            isArchived: scan.isArchived,
        }));
    }, [workspace.scans]);

    const availablePluginNames = useMemo(() => {
        const names = new Set<string>();
        for (const e of allEntries) {
            if (e.pluginName) names.add(e.pluginName);
        }
        return [...names].sort();
    }, [allEntries]);

    const availableStatuses = useMemo(() => {
        const statuses = new Set<string>();
        for (const e of allEntries) {
            statuses.add(e.status);
        }
        return [...statuses].sort();
    }, [allEntries]);

    const filtered = useMemo(() => {
        const q = querySearch.trim().toLowerCase();
        return allEntries.filter((entry) => {
            if (pluginFilter && entry.pluginName !== pluginFilter) return false;
            if (statusFilter && entry.status !== statusFilter) return false;
            if (!q) return true;
            return (
                entry.title.toLowerCase().includes(q) ||
                entry.id.toLowerCase().includes(q) ||
                (entry.pluginName ?? "").toLowerCase().includes(q) ||
                entry.status.toLowerCase().includes(q)
            );
        });
    }, [allEntries, querySearch, pluginFilter, statusFilter]);

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

    return (
        <FavoritesProvider>
        <MainLayout
            projectDir={projectDir}
            selectedScanId={workspace.selectedScanId}
            onGoBack={() => void goBack()}
            hasPlugins={workspace.settingsData === null ? true : workspace.settingsData.plugins.length > 0}
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
                            {/* Header */}
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
                                </div>
                            </div>

                            {workspace.scansError ? (
                                <p className="text-sm text-red-600">{workspace.scansError}</p>
                            ) : null}

                            <div className="grid gap-6 xl:grid-cols-[0.7fr_1.3fr]">
                                {/* Left column: search card + scan list */}
                                <div className="flex flex-col gap-4">
                                    {/* Search & filter card */}
                                    <Card className="rounded-[24px] border-border/70">
                                        <CardContent className="p-4 space-y-3">
                                            <div className="relative">
                                                <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                                                <Input
                                                    value={querySearch}
                                                    onChange={(e) => setQuerySearch(e.target.value)}
                                                    placeholder="Search by name, ID, or plugin..."
                                                    className="h-9 pl-8 text-sm"
                                                />
                                            </div>

                                            {(availablePluginNames.length > 0 || availableStatuses.length > 1) && (
                                                <div className="flex flex-wrap items-center gap-1.5">
                                                    <Filter className="h-3 w-3 text-muted-foreground shrink-0" />

                                                    {availablePluginNames.map((name) => {
                                                        const isSelected = pluginFilter === name;
                                                        return (
                                                            <button
                                                                key={`plugin-${name}`}
                                                                type="button"
                                                                onClick={() => setPluginFilter(isSelected ? null : name)}
                                                                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border transition-colors ${
                                                                    isSelected
                                                                        ? "bg-primary text-primary-foreground border-primary"
                                                                        : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
                                                                }`}
                                                            >
                                                                {name}
                                                                {isSelected && <X className="h-2.5 w-2.5" />}
                                                            </button>
                                                        );
                                                    })}

                                                    {availablePluginNames.length > 0 && availableStatuses.length > 1 && (
                                                        <span className="w-px h-3.5 bg-border/60" />
                                                    )}

                                                    {availableStatuses.map((status) => {
                                                        const isSelected = statusFilter === status;
                                                        return (
                                                            <button
                                                                key={`status-${status}`}
                                                                type="button"
                                                                onClick={() => setStatusFilter(isSelected ? null : status)}
                                                                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border transition-colors ${
                                                                    isSelected
                                                                        ? "bg-primary text-primary-foreground border-primary"
                                                                        : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
                                                                }`}
                                                            >
                                                                {status}
                                                                {isSelected && <X className="h-2.5 w-2.5" />}
                                                            </button>
                                                        );
                                                    })}

                                                    {(pluginFilter || statusFilter) && (
                                                        <button
                                                            type="button"
                                                            onClick={() => { setPluginFilter(null); setStatusFilter(null); }}
                                                            className="text-[10px] text-muted-foreground hover:text-foreground underline ml-1"
                                                        >
                                                            Clear all
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>

                                    {/* Scan list card */}
                                    <Card className="rounded-[24px] border-border/70">
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-base flex items-center gap-2">
                                                <Clock className="h-4 w-4" />
                                                All Scans
                                                <Badge variant="secondary" className="ml-1 text-[10px]">
                                                    {filtered.length === allEntries.length ? allEntries.length : `${filtered.length}/${allEntries.length}`}
                                                </Badge>
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="p-0">
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
                                                                        isActive ? "bg-muted" :
                                                                        (entry.status === "Failed" || entry.errorResultCount > 0) ? "bg-red-50 dark:bg-red-950/30" : ""
                                                                    }`}
                                                                >
                                                                    <div className="flex items-start gap-3">
                                                                        <div className="mt-0.5">
                                                                            <StatusIcon status={entry.status} />
                                                                        </div>
                                                                        <div className="min-w-0 flex-1">
                                                                            <div className="flex items-center gap-2">
                                                                                <p className={`truncate text-sm font-medium ${(entry.status === "Failed" || entry.errorResultCount > 0) ? "text-red-700 dark:text-red-400" : ""}`}>
                                                                                    {entry.title}
                                                                                </p>
                                                                                {entry.status === "Failed" || entry.errorResultCount > 0 ? (
                                                                                    <Badge variant="destructive" className="text-[9px] px-1.5 py-0 shrink-0">
                                                                                        {entry.status === "Failed" ? "Failed" : `${entry.errorResultCount} error${entry.errorResultCount === 1 ? "" : "s"}`}
                                                                                    </Badge>
                                                                                ) : null}
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
                                                                                {entry.resultCount !== null && entry.status !== "Failed" ? (
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
                                        </CardContent>
                                    </Card>
                                </div>

                                {/* Right column: detail */}
                                <Card className={`rounded-[24px] border-border/70 self-start ${selectedEntry?.status === "Failed" ? "border-red-300 dark:border-red-800" : ""}`}>
                                    <CardHeader className="pb-2">
                                        <CardTitle className={`text-base flex items-center gap-2 ${selectedEntry?.status === "Failed" ? "text-red-700 dark:text-red-400" : ""}`}>
                                            {selectedEntry?.title ?? "Select a scan"}
                                            {selectedEntry?.status === "Failed" ? (
                                                <Badge variant="destructive" className="text-[10px]">Failed</Badge>
                                            ) : null}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                        {workspace.selectedScanId && selectedEntry ? (
                                            <>
                                                {selectedEntry.status === "Failed" ? (
                                                    <div className="rounded-md border border-red-200 bg-red-50 dark:bg-red-950/40 dark:border-red-800 px-3 py-2 text-sm text-red-700 dark:text-red-400">
                                                        This scan ended in an error. Check the logs by opening it in Scans.
                                                    </div>
                                                ) : null}
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

                                                {/* Search Criteria card with results inside */}
                                                <Card className="rounded-[16px] border-border/60">
                                                    <CardHeader className="pb-2 flex flex-row items-center justify-between">
                                                        <CardTitle className="text-sm">Search Criteria</CardTitle>
                                                        <ExportPdfButton
                                                            scanDetail={selectedScanDetail}
                                                            scanTitle={selectedEntry.title}
                                                            performedAt={selectedEntry.performedAt}
                                                            pluginNameById={workspace.pluginNameById}
                                                            label="Save PDF"
                                                            size="sm"
                                                        />
                                                    </CardHeader>
                                                    <CardContent className="space-y-4">
                                                        {selectedScanDetail && (() => {
                                                            const nonNull = selectedScanDetail.inputs.filter((inp) => inp.value.type !== "null");
                                                            if (!nonNull.length) {
                                                                return (
                                                                    <p className="text-xs text-muted-foreground">No input values were used for this scan.</p>
                                                                );
                                                            }
                                                            const seen = new Set<string>();
                                                            const unique = nonNull.filter((inp) => {
                                                                const key = `${inp.fieldName}::${"value" in inp.value ? String(inp.value.value) : ""}`;
                                                                if (seen.has(key)) return false;
                                                                seen.add(key);
                                                                return true;
                                                            });
                                                            return (
                                                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                                                                    {unique.map((inp, i) => (
                                                                        <span key={i}>
                                                                            <span className="text-muted-foreground">
                                                                                {inp.fieldName.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}:
                                                                            </span>{" "}
                                                                            <span className="font-medium">
                                                                                {"value" in inp.value ? String(inp.value.value) : "—"}
                                                                            </span>
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            );
                                                        })()}

                                                        {selectedScanDetail ? (
                                                            <>
                                                                <div className="border-t border-border/50 my-4" />

                                                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                                                                    Results
                                                                </p>
                                                                <ScanResultsPanel
                                                                    scanDetail={selectedScanDetail}
                                                                    pluginNameById={workspace.pluginNameById}
                                                                />
                                                            </>
                                                        ) : null}
                                                    </CardContent>
                                                </Card>
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
        </FavoritesProvider>
    );
}

