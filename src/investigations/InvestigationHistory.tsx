import { useMemo, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  ArrowDown,
  ArrowUp,
  Check,
  MoreHorizontal,
  PanelLeftClose,
  Pencil,
  Plus,
  Search,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ScanSummaryRecord } from "@/core/backend/bindings";
import { cn } from "@/lib/utils";
import { formatDate } from "@/shared/formatDate";
import { ScanStatusIndicator } from "./ScanStatusIndicator";

interface InvestigationHistoryProps {
  scans: ScanSummaryRecord[];
  selectedScanId: string | null;
  disabled: boolean;
  onNew: () => void;
  onSelect: (scanId: string) => void;
  onCollapse: () => void;
  onRename: (scanId: string, preview: string) => Promise<void>;
  onArchive: (scanId: string, archived: boolean) => Promise<void>;
  onReorder: (orderedScanIds: string[]) => Promise<void>;
}

export function InvestigationHistory({
  scans,
  selectedScanId,
  disabled,
  onNew,
  onSelect,
  onCollapse,
  onRename,
  onArchive,
  onReorder,
}: InvestigationHistoryProps) {
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingPreview, setEditingPreview] = useState("");
  const [operatingId, setOperatingId] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const archivedCount = scans.filter((scan) => scan.isArchived).length;
  const activeScanIds = useMemo(
    () => scans.filter((scan) => !scan.isArchived).map((scan) => scan.id),
    [scans],
  );

  const visibleScans = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return scans.filter((scan) => {
      if (scan.isArchived !== showArchived) {
        return false;
      }
      if (!normalized) {
        return true;
      }
      return (
        scan.id.toLowerCase().includes(normalized) ||
        (scan.preview ?? "").toLowerCase().includes(normalized) ||
        (scan.pluginName ?? "").toLowerCase().includes(normalized)
      );
    });
  }, [query, scans, showArchived]);

  const saveRename = async (scanId: string) => {
    const preview = editingPreview.trim();
    if (!preview) {
      return;
    }
    setOperatingId(scanId);
    try {
      await onRename(scanId, preview);
      setEditingId(null);
    } finally {
      setOperatingId(null);
    }
  };

  const archive = async (scanId: string, archived: boolean) => {
    setOperatingId(scanId);
    try {
      await onArchive(scanId, archived);
    } finally {
      setOperatingId(null);
    }
  };

  const reorder = async (
    scanId: string,
    direction: "up" | "down",
  ) => {
    const currentIndex = activeScanIds.indexOf(scanId);
    if (currentIndex < 0) {
      return;
    }

    const nextIndex =
      direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (nextIndex < 0 || nextIndex >= activeScanIds.length) {
      return;
    }
    const nextActiveIds = [...activeScanIds];
    [nextActiveIds[currentIndex], nextActiveIds[nextIndex]] = [
      nextActiveIds[nextIndex],
      nextActiveIds[currentIndex],
    ];

    const archivedIds = scans
      .filter((scan) => scan.isArchived)
      .map((scan) => scan.id);
    setOperatingId(scanId);
    try {
      await onReorder([...nextActiveIds, ...archivedIds]);
    } finally {
      setOperatingId(null);
    }
  };

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r bg-background">
      <div className="border-b p-3">
        <div className="mb-3 flex items-center justify-between px-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Investigations
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title="Hide history"
            onClick={onCollapse}
          >
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        </div>
        <Button
          className="h-10 w-full gap-2"
          disabled={disabled}
          onClick={onNew}
        >
          <Plus className="h-4 w-4" />
          New investigation
        </Button>
        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search history"
            className="h-9 pl-9"
          />
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 h-8 px-2 text-xs text-muted-foreground"
          aria-pressed={showArchived}
          onClick={() => setShowArchived((visible) => !visible)}
        >
          {showArchived ? "Back to history" : `Archived (${archivedCount})`}
        </Button>
      </div>

      <div className="min-h-0 flex-1 overscroll-contain overflow-y-auto">
        {visibleScans.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            No investigations found.
          </p>
        ) : (
          <ul className="divide-y">
            {visibleScans.map((scan) => {
              const selected = scan.id === selectedScanId;
              const preview =
                scan.preview?.trim() || `Investigation ${scan.id.slice(0, 8)}`;
              const operating = operatingId === scan.id;
              const activeIndex = activeScanIds.indexOf(scan.id);
              const canMoveUp = activeIndex > 0;
              const canMoveDown =
                activeIndex >= 0 && activeIndex < activeScanIds.length - 1;
              return (
                <li key={scan.id} className="group relative">
                  {editingId === scan.id ? (
                    <form
                      className="flex items-center gap-1 border-l-2 border-l-primary bg-muted/60 p-2"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void saveRename(scan.id);
                      }}
                    >
                      <Input
                        autoFocus
                        value={editingPreview}
                        disabled={operating}
                        aria-label="Investigation name"
                        className="h-8 min-w-0"
                        onChange={(event) =>
                          setEditingPreview(event.target.value)
                        }
                        onKeyDown={(event) => {
                          if (event.key === "Escape") {
                            setEditingId(null);
                          }
                        }}
                      />
                      <Button
                        type="submit"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        disabled={operating || !editingPreview.trim()}
                        aria-label="Save name"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        disabled={operating}
                        aria-label="Cancel rename"
                        onClick={() => setEditingId(null)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </form>
                  ) : (
                    <div
                      className={cn(
                        "flex min-h-16 border-l-2 border-transparent hover:bg-muted/50",
                        selected && "border-l-primary bg-muted/60",
                      )}
                    >
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => onSelect(scan.id)}
                        className="min-w-0 flex-1 px-3 py-2 text-left disabled:pointer-events-none disabled:opacity-50"
                      >
                        <div className="flex items-start gap-2.5">
                          <ScanStatusIndicator
                            status={scan.status}
                            showLabel={false}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                              {preview}
                            </p>
                            <div className="mt-1 truncate text-xs text-muted-foreground">
                              <span>
                                {formatDate(scan.createdAt, {
                                  dateStyle: "short",
                                  timeStyle: "short",
                                })}
                              </span>
                              {scan.pluginName ? (
                                <span> · {scan.pluginName}</span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </button>
                      <details
                        open={menuId === scan.id}
                        onToggle={(event) => {
                          if (event.currentTarget.open) {
                            setMenuId(scan.id);
                          } else {
                            setMenuId((current) =>
                              current === scan.id ? null : current,
                            );
                          }
                        }}
                        className={cn(
                          "relative flex shrink-0 items-center pr-2 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100",
                          selected && "opacity-100",
                        )}
                      >
                        <summary
                          className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground [&::-webkit-details-marker]:hidden"
                          aria-label={`Actions for ${preview}`}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </summary>
                        <div className="absolute right-2 top-10 z-20 w-40 rounded-md border bg-popover p-1 shadow-md">
                          {!scan.isArchived ? (
                            <>
                              <button
                                type="button"
                                disabled={disabled || operating || !canMoveUp}
                                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-accent disabled:opacity-40"
                                aria-label={`Move ${preview} up`}
                                onClick={() => {
                                  setMenuId(null);
                                  void reorder(scan.id, "up");
                                }}
                              >
                                <ArrowUp className="h-3.5 w-3.5" />
                                Move up
                              </button>
                              <button
                                type="button"
                                disabled={
                                  disabled || operating || !canMoveDown
                                }
                                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-accent disabled:opacity-40"
                                aria-label={`Move ${preview} down`}
                                onClick={() => {
                                  setMenuId(null);
                                  void reorder(scan.id, "down");
                                }}
                              >
                                <ArrowDown className="h-3.5 w-3.5" />
                                Move down
                              </button>
                              <div className="my-1 border-t" />
                            </>
                          ) : null}
                          <button
                            type="button"
                            disabled={disabled || operating}
                            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-accent disabled:opacity-40"
                            aria-label={`Rename ${preview}`}
                            onClick={() => {
                              setMenuId(null);
                              setEditingId(scan.id);
                              setEditingPreview(preview);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Rename
                          </button>
                          <button
                            type="button"
                            disabled={
                              disabled || operating || scan.status === "Running"
                            }
                            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-accent disabled:opacity-40"
                            aria-label={`${scan.isArchived ? "Restore" : "Archive"} ${preview}`}
                            onClick={() => {
                              setMenuId(null);
                              void archive(scan.id, !scan.isArchived);
                            }}
                          >
                            {scan.isArchived ? (
                              <ArchiveRestore className="h-3.5 w-3.5" />
                            ) : (
                              <Archive className="h-3.5 w-3.5" />
                            )}
                            {scan.isArchived ? "Restore" : "Archive"}
                          </button>
                        </div>
                      </details>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
