import { RefObject, useMemo, useState } from "react";
import {
    Archive,
    ArrowDown,
    ArrowUp,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    ChevronUp,
    Clock,
    Plus,
    Settings,
    CheckCircle2,
    XCircle,
    Loader2,
    FileEdit,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface ProjectScanHistoryEntry {
    id: string;
    title: string;
    status: string;
    performedAt: string;
    pluginName: string | null;
    resultCount: number | null;
    isArchived: boolean;
    canMoveUp: boolean;
    canMoveDown: boolean;
}

interface ProjectScanHistorySidebarProps {
    entries: ProjectScanHistoryEntry[];
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
    onMoveScan: (scanId: string, delta: -1 | 1) => void;
    onArchive: (scanId: string) => void;
    onOpenSettings: () => void;
    onGoBack: () => void;
}

export function ProjectScanHistorySidebar({
    entries,
    activeId,
    querySearch,
    creatingScan,
    renamingScanId,
    renamingValue,
    scansError,
    searchInputRef,
    onCreateScan,
    onSelect,
    onStartRename,
    onRenamingValueChange,
    onCommitRename,
    onCancelRename,
    onQuerySearchChange,
    onMoveScan,
    onArchive,
    onOpenSettings,
    onGoBack,
}: ProjectScanHistorySidebarProps) {
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [historyOpen, setHistoryOpen] = useState(true);
    const countLabel = useMemo(() => entries.length, [entries.length]);
    const activeEntry = useMemo(
        () => entries.find((entry) => entry.id === activeId) ?? null,
        [activeId, entries],
    );

    return (
        <aside className={`shrink-0 border-l bg-background flex flex-col h-full transition-all duration-200 ${sidebarOpen ? "w-80" : "w-10"}`}>
            {/* Toggle strip */}
            <div className={`flex items-center py-3 border-b shrink-0 ${sidebarOpen ? "justify-between px-4" : "justify-center"}`}>
                {sidebarOpen ? (
                    <span className="text-sm font-semibold">Scan History</span>
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

            {/* Collapsed hint icons */}
            {!sidebarOpen ? (
                <div className="flex flex-col items-center pt-4 gap-1">
                    <button
                        className="flex flex-col items-center gap-1 hover:opacity-70 transition-opacity cursor-pointer"
                        title="Open scan history"
                        onClick={() => { setSidebarOpen(true); setHistoryOpen(true); }}
                    >
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        {countLabel > 0 ? (
                            <span className="text-[10px] text-muted-foreground font-medium">{countLabel}</span>
                        ) : null}
                    </button>
                </div>
            ) : (
                <>
                    {/* ── Scan History section header ── */}
                    <div
                        className="border-b px-4 py-2.5 flex items-center justify-between hover:bg-muted/50 transition-colors cursor-pointer"
                        onClick={() => setHistoryOpen((o) => !o)}
                    >
                        <div className="flex items-center gap-2">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Scan History
                            </span>
                            {countLabel > 0 ? (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                    {countLabel}
                                </Badge>
                            ) : null}
                        </div>
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-muted-foreground"
                                title="New scan"
                                onClick={onCreateScan}
                                disabled={creatingScan}
                            >
                                <Plus className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-muted-foreground"
                                title="Archive active scan"
                                onClick={() => { if (activeEntry) onArchive(activeEntry.id); }}
                                disabled={!activeEntry}
                            >
                                <Archive className="h-3.5 w-3.5" />
                            </Button>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-6 w-6 text-muted-foreground"
                                        title="Actions"
                                    >
                                        <Settings className="h-3.5 w-3.5" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={onOpenSettings}>
                                        Open Settings
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={onGoBack}>Back</DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                            {historyOpen
                                ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                                : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                        </div>
                    </div>

                    {historyOpen ? (
                        <>
                            <div className="px-4 py-3 border-b">
                                <Input
                                    ref={searchInputRef}
                                    placeholder="Type to search..."
                                    value={querySearch}
                                    onChange={(event) => onQuerySearchChange(event.target.value)}
                                    className="h-8 text-sm"
                                />
                            </div>

                            {scansError ? <p className="px-4 py-2 text-xs text-red-600">{scansError}</p> : null}

                            <ScrollArea className="flex-1">
                                {!entries.length ? (
                                    <p className="text-xs text-muted-foreground text-center py-6 px-4">
                                        No active scans.
                                    </p>
                                ) : (
                                    <ul className="divide-y">
                                        {entries.map((entry) => {
                                            const isActive = entry.id === activeId;
                                            return (
                                                <li key={entry.id} className={`group relative ${isActive ? "bg-muted" : ""}`}>
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
                                                                    {entry.resultCount !== null ? (
                                                                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
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

                                                    <div className="absolute top-2 right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6 text-muted-foreground"
                                                            onClick={(event) => { event.stopPropagation(); onArchive(entry.id); }}
                                                            title="Archive scan"
                                                        >
                                                            <Archive className="h-3 w-3" />
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6 text-muted-foreground"
                                                            disabled={!entry.canMoveUp}
                                                            onClick={(event) => { event.stopPropagation(); onMoveScan(entry.id, -1); }}
                                                            title="Move up"
                                                        >
                                                            <ArrowUp className="h-3 w-3" />
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6 text-muted-foreground"
                                                            disabled={!entry.canMoveDown}
                                                            onClick={(event) => { event.stopPropagation(); onMoveScan(entry.id, 1); }}
                                                            title="Move down"
                                                        >
                                                            <ArrowDown className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                            </ScrollArea>
                        </>
                    ) : null}
                </>
            )}
        </aside>
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
