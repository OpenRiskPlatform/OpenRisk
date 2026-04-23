import { RefObject, useMemo, useState } from "react";
import {
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    ChevronUp,
    Clock,
    Printer,
    CheckCircle2,
    XCircle,
    Loader2,
    FileEdit,
    Star,
    X,
} from "lucide-react";
import { toast } from "sonner";
import { openPath } from "@tauri-apps/plugin-opener";
import { useFavorites } from "@/core/favorites-context";
import type { DataModelEntity } from "@/core/data-model/types";
import { exportFavoritesPdf } from "@/utils/exportPdf";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface ProjectScanHistoryEntry {
    id: string;
    title: string;
    status: string;
    performedAt: string;
    pluginName: string | null;
    resultCount: number;
    errorResultCount: number;
    isArchived: boolean;
}

interface ProjectScanHistorySidebarProps {
    entries: ProjectScanHistoryEntry[];
    totalEntryCount: number;
    activeId: string | null;
    querySearch: string;
    creatingScan: boolean;
    renamingScanId: string | null;
    renamingValue: string;
    scansError?: string | null;
    searchInputRef: RefObject<HTMLInputElement | null>;
    onCreateScan: () => void;
    onSelect: (scanId: string) => void;
    onStartRename: (scanId: string) => void;
    onRenamingValueChange: (value: string) => void;
    onCommitRename: () => void;
    onCancelRename: () => void;
    onQuerySearchChange: (value: string) => void;
    onArchive: (scanId: string) => void;
    onPrintAll?: () => void;
    onOpenSettings: () => void;
    onGoBack: () => void;
    onOpenHistoryPage?: () => void;
}

export function ProjectScanHistorySidebar({
    entries,
    totalEntryCount,
    activeId,
    querySearch,
    renamingScanId,
    renamingValue,
    scansError,
    searchInputRef,
    onSelect,
    onStartRename,
    onRenamingValueChange,
    onCommitRename,
    onCancelRename,
    onQuerySearchChange,
    onPrintAll,
    onOpenHistoryPage,
}: ProjectScanHistorySidebarProps) {
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [historyOpen, setHistoryOpen] = useState(true);
    const [favoritesOpen, setFavoritesOpen] = useState(false);
    const countLabel = useMemo(() => {
        if (entries.length === totalEntryCount) return `${totalEntryCount}`;
        return `${entries.length}/${totalEntryCount}`;
    }, [entries.length, totalEntryCount]);
    const { favorites, toggleFavorite } = useFavorites();

    const printFavorites = async (subset: DataModelEntity[]) => {
        if (!subset.length) return;
        const savedPath = await exportFavoritesPdf(subset);
        if (savedPath) {
            toast.success("Favourites PDF saved", {
                description: savedPath,
                action: {
                    label: "Open file",
                    onClick: () => void openPath(savedPath),
                },
            });
        }
    };

    return (
        <aside className={`shrink-0 border-l bg-background flex flex-col h-full transition-all duration-200 ${sidebarOpen ? "w-80" : "w-10"}`}>
            {/* Top strip – panel title + collapse toggle */}
            <div className={`flex items-center py-3 border-b shrink-0 ${sidebarOpen ? "justify-between px-4" : "justify-center"}`}>
                {sidebarOpen ? (
                    <button
                        type="button"
                        className="text-sm font-semibold hover:underline"
                        title="Open full Scan History page"
                        onClick={() => onOpenHistoryPage?.()}
                        disabled={!onOpenHistoryPage}
                    >
                        Scan Informations
                    </button>
                ) : null}
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground"
                    title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
                    onClick={() => setSidebarOpen((open) => !open)}
                >
                    {sidebarOpen ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                </Button>
            </div>

            {/* Collapsed hint */}
            {!sidebarOpen ? (
                <div className="flex flex-col items-center pt-4 gap-3">
                    <button
                        className="flex flex-col items-center gap-1 hover:opacity-70 transition-opacity cursor-pointer"
                        title="Open scan history"
                        onClick={() => { setSidebarOpen(true); setHistoryOpen(true); }}
                    >
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        {totalEntryCount > 0 ? (
                            <span className="text-[10px] text-muted-foreground font-medium">{countLabel}</span>
                        ) : null}
                    </button>
                    {favorites.length > 0 && (
                        <button
                            className="flex flex-col items-center gap-1 hover:opacity-70 transition-opacity cursor-pointer"
                            title={`${favorites.length} favourite${favorites.length === 1 ? "" : "s"} — open panel`}
                            onClick={() => { setSidebarOpen(true); setFavoritesOpen(true); }}
                        >
                            <Star className="h-4 w-4 text-amber-500 fill-amber-400" />
                            <span className="text-[10px] text-amber-500 font-medium">{favorites.length}</span>
                        </button>
                    )}
                </div>
            ) : (
                <ScrollArea className="flex-1">
                    <div className="flex flex-col gap-3 py-3">

                        {/* ── Favorites section ── */}
                        <div className="rounded-lg border border-border/60 mx-3 overflow-hidden">
                            <button
                                type="button"
                                className="w-full flex items-center justify-center gap-2 px-4 py-2 hover:bg-muted/50 transition-colors relative"
                                onClick={() => setFavoritesOpen((o) => !o)}
                            >
                                <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-400" />
                                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                    Favorites
                                </span>
                                {favorites.length > 0 && (
                                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                        {favorites.length}
                                    </Badge>
                                )}
                                <span className="absolute right-2 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                    {favorites.length > 0 && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 text-muted-foreground"
                                            title="Print all favourites"
                                            onClick={() => void printFavorites(favorites)}
                                        >
                                            <Printer className="h-3.5 w-3.5" />
                                        </Button>
                                    )}
                                    {favoritesOpen
                                        ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                                        : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                                </span>
                            </button>
                            {favoritesOpen && (
                                favorites.length === 0 ? (
                                    <p className="text-xs text-muted-foreground text-center py-4 px-4 border-t">
                                        No favourites yet.
                                    </p>
                                ) : (
                                    <ul className="divide-y border-t">
                                        {favorites.map((entity) => (
                                            <FavoriteEntityItem
                                            key={entity.$id}
                                            entity={entity}
                                            onRemove={() => toggleFavorite(entity)}
                                            onPrint={() => void printFavorites([entity])}
                                        />
                                        ))}
                                    </ul>
                                )
                            )}
                        </div>

                        {/* ── Scan History section ── */}
                        <div className="rounded-lg border border-border/60 mx-3 overflow-hidden">
                            <button
                                type="button"
                                className="w-full flex items-center justify-center gap-2 px-4 py-2 hover:bg-muted/50 transition-colors relative"
                                onClick={() => setHistoryOpen((o) => !o)}
                            >
                                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                    Scan History
                                </span>
                                {totalEntryCount > 0 && (
                                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                        {countLabel}
                                    </Badge>
                                )}
                                <span className="absolute right-2 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                    {onPrintAll && totalEntryCount > 0 && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 text-muted-foreground"
                                            title="Export all scans as PDF"
                                            onClick={onPrintAll}
                                        >
                                            <Printer className="h-3.5 w-3.5" />
                                        </Button>
                                    )}
                                    {historyOpen
                                        ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                                        : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                                </span>
                            </button>

                            {historyOpen && (
                                <>
                                    <div className="px-3 py-2 border-t space-y-2">
                                        <Input
                                            ref={searchInputRef}
                                            placeholder="Search for scan"
                                            value={querySearch}
                                            onChange={(event) => onQuerySearchChange(event.target.value)}
                                            className="h-8 text-sm"
                                            disabled={!totalEntryCount}
                                        />
                                    </div>

                                    {scansError ? <p className="px-4 py-2 text-xs text-red-600">{scansError}</p> : null}

                                    {!totalEntryCount ? (
                                        <p className="text-xs text-muted-foreground text-center py-6 px-4 border-t">
                                            No active scans.
                                        </p>
                                    ) : !entries.length ? (
                                        <p className="text-xs text-muted-foreground text-center py-6 px-4 border-t">
                                            No scans matching "{querySearch}".
                                        </p>
                                    ) : (
                                        <ul className="divide-y border-t">
                                            {entries.map((entry) => {
                                                const isActive = entry.id === activeId;
                                                return (
                                                    <li key={entry.id} className={`group relative ${isActive ? "bg-muted" : (entry.status === "Failed" || entry.errorResultCount > 0) ? "bg-red-50 dark:bg-red-950/30" : ""}`}>
                                                        <button
                                                            type="button"
                                                            className="w-full text-left px-4 py-3 hover:bg-muted/60 transition-colors pr-12"
                                                            onClick={() => {
                                                                if (isActive) {
                                                                    onStartRename(entry.id);
                                                                } else {
                                                                    onSelect(entry.id);
                                                                    onCancelRename();
                                                                }
                                                            }}
                                                        >
                                                            <div className="flex items-start gap-2">
                                                                <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${statusTone(entry.status)}`}>
                                                                    <StatusIcon status={entry.status} />
                                                                </div>
                                                                <div className="min-w-0 flex-1 space-y-1">
                                                                    {renamingScanId === entry.id ? (
                                                                        <Input
                                                                            value={renamingValue}
                                                                            autoFocus
                                                                            className="w-full"
                                                                            onClick={(event) => event.stopPropagation()}
                                                                            onChange={(event) => onRenamingValueChange(event.target.value)}
                                                                            onBlur={() => { void onCommitRename(); }}
                                                                            onKeyDown={(event) => {
                                                                                event.stopPropagation();
                                                                                if (event.key === "Enter") { event.preventDefault(); void onCommitRename(); }
                                                                                if (event.key === "Escape") { event.preventDefault(); onCancelRename(); }
                                                                            }}
                                                                        />
                                                                    ) : (
                                                                        <p
                                                                            className={`max-w-full overflow-hidden text-sm font-medium leading-tight [overflow-wrap:anywhere] ${isActive ? "text-primary" : ""}`}
                                                                            style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}
                                                                        >
                                                                            {entry.title}
                                                                        </p>
                                                                    )}

                                                                    {entry.pluginName ? (
                                                                        <p className="text-[10px] text-muted-foreground truncate">
                                                                            {entry.pluginName}
                                                                        </p>
                                                                    ) : null}

                                                                    <div className="flex flex-wrap items-center gap-1.5">
                                                                        {entry.status === "Failed" || entry.errorResultCount > 0 ? (
                                                                            <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                                                                                {entry.status === "Failed" ? "Failed" : `${entry.errorResultCount} error${entry.errorResultCount === 1 ? "" : "s"}`}
                                                                            </Badge>
                                                                        ) : null}
                                                                        {entry.resultCount !== null && entry.status !== "Failed" ? (
                                                                            <Badge variant={isActive ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
                                                                                {entry.resultCount} result{entry.resultCount === 1 ? "" : "s"}
                                                                            </Badge>
                                                                        ) : null}
                                                                    </div>

                                                                    <p className="text-[10px] text-muted-foreground/70">
                                                                        {entry.performedAt}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </button>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    )}
                                </>
                            )}
                        </div>

                    </div>
                </ScrollArea>
            )}
        </aside>
    );
}

function FavoriteEntityItem({ entity, onRemove, onPrint }: { entity: DataModelEntity; onRemove: () => void; onPrint: () => void }) {
    const label = entity.$props?.name?.[0]?.value as string | undefined
        ?? entity.$props?.fullName?.[0]?.value as string | undefined
        ?? entity.$id;
    return (
        <li className="flex items-center gap-2 px-4 py-2 bg-amber-50/40 dark:bg-amber-900/10 group">
            <Star className="h-3.5 w-3.5 shrink-0 text-amber-500 fill-amber-400" />
            <span className="min-w-0 flex-1 text-xs font-medium truncate" title={label}>{label}</span>
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground p-0.5"
                    title="Print this entry"
                    onClick={() => onPrint()}
                >
                    <Printer className="h-3 w-3" />
                </button>
                <button
                    type="button"
                    className="text-muted-foreground hover:text-red-500 p-0.5"
                    title="Remove from favourites"
                    onClick={onRemove}
                >
                    <X className="h-3 w-3" />
                </button>
            </div>
        </li>
    );
}

function StatusIcon({ status }: { status: string }) {
    switch (status) {
        case "Running":
            return <Loader2 className="h-3.5 w-3.5 text-sky-600 animate-spin" />;
        case "Completed":
            return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />;
        case "Failed":
            return <XCircle className="h-3.5 w-3.5 text-red-600" />;
        case "Draft":
            return <FileEdit className="h-3.5 w-3.5 text-amber-600" />;
        default:
            return <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
    }
}

function statusTone(status: string): string {
    switch (status) {
        case "Running":
            return "border-sky-200 bg-sky-50 dark:bg-sky-950";
        case "Completed":
            return "border-emerald-200 bg-emerald-50 dark:bg-emerald-950";
        case "Failed":
            return "border-red-200 bg-red-50 dark:bg-red-950";
        case "Draft":
            return "border-amber-200 bg-amber-50 dark:bg-amber-950";
        default:
            return "border-border bg-muted/40";
    }
}
