import { RefObject } from "react";
import { Archive, ArchiveRestore, ArrowDown, ArrowUp, Plus, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ScanSummaryRecord } from "@/core/backend/bindings";

interface ProjectQueriesSidebarProps {
    scans: ScanSummaryRecord[];
    filteredScans: ScanSummaryRecord[];
    selectedScanId: string | null;
    querySearch: string;
    showArchived: boolean;
    creatingScan: boolean;
    renamingScanId: string | null;
    renamingValue: string;
    scansError?: string | null;
    searchInputRef: RefObject<HTMLInputElement | null>;
    onCreateScan: () => void;
    onSelectScan: (scanId: string) => void;
    onStartRename: (scan: ScanSummaryRecord) => void;
    onRenamingValueChange: (value: string) => void;
    onCommitRename: () => void;
    onCancelRename: () => void;
    onQuerySearchChange: (value: string) => void;
    onShowArchivedChange: (value: boolean) => void;
    onMoveScan: (scan: ScanSummaryRecord, delta: -1 | 1) => void;
    onToggleArchive: (scan: ScanSummaryRecord, archived: boolean) => void;
    onGoBack: () => void;
}

export function ProjectQueriesSidebar({
    scans,
    filteredScans,
    selectedScanId,
    querySearch,
    showArchived,
    creatingScan,
    renamingScanId,
    renamingValue,
    scansError,
    searchInputRef,
    onCreateScan,
    onSelectScan,
    onStartRename,
    onRenamingValueChange,
    onCommitRename,
    onCancelRename,
    onQuerySearchChange,
    onShowArchivedChange,
    onMoveScan,
    onToggleArchive,
    onGoBack,
}: ProjectQueriesSidebarProps) {
    return (
        <aside className="bg-card/70 overflow-hidden flex flex-col lg:grid lg:grid-cols-[42px_1fr] shrink-0 border-b lg:border-b-0 lg:border-r w-full lg:w-[var(--left-panel-width)] h-[46vh] lg:h-auto">
            <div className="lg:border-r bg-muted/10 flex items-center justify-between lg:flex-col lg:items-center gap-2 px-2 py-2">
                <div className="flex items-center gap-2 lg:flex-col">
                    <Button size="icon" variant="ghost" onClick={onCreateScan} disabled={creatingScan} title="New scan">
                        <Plus className="h-4 w-4" />
                    </Button>
                </div>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            size="icon"
                            variant="ghost"
                            className="lg:mt-auto"
                            title="Settings"
                        >
                            <Settings className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="right" align="end">
                        <DropdownMenuItem
                            onClick={() =>
                                window.dispatchEvent(new CustomEvent("openrisk:open-settings"))
                            }
                        >
                            Open Settings
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={onGoBack}>Back</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            <div className="flex flex-col min-h-0 p-2 gap-2 bg-card/80">
                <p className="text-sm font-semibold px-1">Queries</p>
                <Input
                    ref={searchInputRef}
                    placeholder="Type to search..."
                    value={querySearch}
                    onChange={(e) => onQuerySearchChange(e.target.value)}
                    className="h-9"
                />

                <div className="flex items-center justify-between px-1">
                    <Label htmlFor="show-archived-scans" className="text-xs text-muted-foreground">
                        Show archived
                    </Label>
                    <Switch
                        id="show-archived-scans"
                        checked={showArchived}
                        onCheckedChange={onShowArchivedChange}
                    />
                </div>

                {scansError ? <p className="text-xs text-red-600 px-1">{scansError}</p> : null}

                <div className="min-h-0 flex-1 overflow-y-auto space-y-0.5">
                    {filteredScans.map((scan) => (
                        <div
                            key={scan.id}
                            role="button"
                            tabIndex={0}
                            className={`w-full text-left rounded px-2.5 py-2 transition ${selectedScanId === scan.id ? "bg-primary/10" : "hover:bg-muted/30"}`}
                            onClick={() => {
                                if (selectedScanId === scan.id) {
                                    onStartRename(scan);
                                } else {
                                    onSelectScan(scan.id);
                                    onCancelRename();
                                }
                            }}
                            onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault();
                                    if (selectedScanId === scan.id) {
                                        onStartRename(scan);
                                    } else {
                                        onSelectScan(scan.id);
                                        onCancelRename();
                                    }
                                }
                            }}
                        >
                            <div className="flex items-start gap-2">
                                <div className="min-w-0 flex-1">
                                    {renamingScanId === scan.id ? (
                                        <Input
                                            value={renamingValue}
                                            autoFocus
                                            onClick={(event) => event.stopPropagation()}
                                            onChange={(event) => onRenamingValueChange(event.target.value)}
                                            onBlur={() => {
                                                void onCommitRename();
                                            }}
                                            onKeyDown={(event) => {
                                                if (event.key === "Enter") {
                                                    void onCommitRename();
                                                }
                                                if (event.key === "Escape") {
                                                    onCancelRename();
                                                }
                                            }}
                                        />
                                    ) : (
                                        <p className="text-sm font-medium truncate">
                                            {scan.preview?.trim() || `New Scan ${scan.id.slice(0, 8)}`}
                                        </p>
                                    )}
                                </div>
                                <div className="flex items-center gap-0.5 shrink-0">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        disabled={scans.find((item) => item.isArchived === scan.isArchived)?.id === scan.id}
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            onMoveScan(scan, -1);
                                        }}
                                        title="Move up"
                                    >
                                        <ArrowUp className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        disabled={(() => {
                                            const group = scans.filter((item) => item.isArchived === scan.isArchived);
                                            return group[group.length - 1]?.id === scan.id;
                                        })()}
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            onMoveScan(scan, 1);
                                        }}
                                        title="Move down"
                                    >
                                        <ArrowDown className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            onToggleArchive(scan, !scan.isArchived);
                                        }}
                                        title={scan.isArchived ? "Restore scan" : "Archive scan"}
                                    >
                                        {scan.isArchived ? (
                                            <ArchiveRestore className="h-3.5 w-3.5" />
                                        ) : (
                                            <Archive className="h-3.5 w-3.5" />
                                        )}
                                    </Button>
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 truncate">
                                {scan.status === "Draft" ? "a.k.a new request" : "a.k.a completed request"}
                            </p>
                            {scan.isArchived ? (
                                <p className="text-[11px] text-muted-foreground mt-1">Archived</p>
                            ) : null}
                        </div>
                    ))}
                    {!filteredScans.length ? (
                        <p className="text-xs text-muted-foreground px-1 py-2">
                            {showArchived ? "No queries yet" : "No active queries"}
                        </p>
                    ) : null}
                </div>
            </div>
        </aside>
    );
}
