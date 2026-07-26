import { useMemo, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  Check,
  GripVertical,
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
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const archivedCount = scans.filter((scan) => scan.isArchived).length;

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
    targetScanId: string | null,
    direction?: "up" | "down",
  ) => {
    const activeIds = scans
      .filter((scan) => !scan.isArchived)
      .map((scan) => scan.id);
    const currentIndex = activeIds.indexOf(scanId);
    if (currentIndex < 0) {
      return;
    }

    let nextActiveIds = [...activeIds];
    if (direction) {
      const nextIndex =
        direction === "up" ? currentIndex - 1 : currentIndex + 1;
      if (nextIndex < 0 || nextIndex >= nextActiveIds.length) {
        return;
      }
      [nextActiveIds[currentIndex], nextActiveIds[nextIndex]] = [
        nextActiveIds[nextIndex],
        nextActiveIds[currentIndex],
      ];
    } else if (targetScanId && targetScanId !== scanId) {
      nextActiveIds = nextActiveIds.filter((id) => id !== scanId);
      const targetIndex = nextActiveIds.indexOf(targetScanId);
      nextActiveIds.splice(
        targetIndex < 0 ? nextActiveIds.length : targetIndex,
        0,
        scanId,
      );
    } else {
      return;
    }

    const archivedIds = scans
      .filter((scan) => scan.isArchived)
      .map((scan) => scan.id);
    setOperatingId(scanId);
    try {
      await onReorder([...nextActiveIds, ...archivedIds]);
    } finally {
      setOperatingId(null);
      setDraggedId(null);
      setDragOverId(null);
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
              return (
                <li
                  key={scan.id}
                  className={cn(
                    "group",
                    dragOverId === scan.id && "border-t-2 border-t-primary",
                  )}
                  onDragOver={(event) => {
                    if (draggedId && draggedId !== scan.id) {
                      event.preventDefault();
                      setDragOverId(scan.id);
                    }
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (draggedId) {
                      void reorder(draggedId, scan.id);
                    }
                  }}
                >
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
                        "flex border-l-2 border-transparent hover:bg-muted/50",
                        selected && "border-l-primary bg-muted/60",
                      )}
                    >
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => onSelect(scan.id)}
                        className="min-w-0 flex-1 px-3 py-2.5 text-left disabled:pointer-events-none disabled:opacity-50"
                      >
                        <div className="flex items-start gap-3">
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
                      <div
                        className={cn(
                          "flex shrink-0 items-center pr-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100",
                          selected && "opacity-100",
                        )}
                      >
                        {!scan.isArchived ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 cursor-grab focus:opacity-100 active:cursor-grabbing"
                            draggable={!disabled && !operating}
                            disabled={disabled || operating}
                            aria-label={`Reorder ${preview}`}
                            title="Drag to reorder. Use Up or Down arrow with the keyboard."
                            onDragStart={(event) => {
                              event.dataTransfer.effectAllowed = "move";
                              event.dataTransfer.setData(
                                "text/plain",
                                scan.id,
                              );
                              setDraggedId(scan.id);
                            }}
                            onDragEnd={() => {
                              setDraggedId(null);
                              setDragOverId(null);
                            }}
                            onKeyDown={(event) => {
                              if (
                                event.key === "ArrowUp" ||
                                event.key === "ArrowDown"
                              ) {
                                event.preventDefault();
                                void reorder(
                                  scan.id,
                                  null,
                                  event.key === "ArrowUp" ? "up" : "down",
                                );
                              }
                            }}
                          >
                            <GripVertical className="h-3.5 w-3.5" />
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 focus:opacity-100"
                          disabled={disabled || operating}
                          aria-label={`Rename ${preview}`}
                          onClick={() => {
                            setEditingId(scan.id);
                            setEditingPreview(preview);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 focus:opacity-100"
                          disabled={
                            disabled || operating || scan.status === "Running"
                          }
                          aria-label={`${scan.isArchived ? "Restore" : "Archive"} ${preview}`}
                          onClick={() =>
                            void archive(scan.id, !scan.isArchived)
                          }
                        >
                          {scan.isArchived ? (
                            <ArchiveRestore className="h-3.5 w-3.5" />
                          ) : (
                            <Archive className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
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
