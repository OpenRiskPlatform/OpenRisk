/**
 * ScanHistorySidebar – right-side panel with two independent sections:
 *   1. Scan History  – past searches
 *   2. Saved Persons – starred result rows
 */

import { useState } from "react";
import { Clock, Trash2, User, Building2, Box, ChevronDown, ChevronUp, ChevronRight, ChevronLeft, Star, FileDown, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScanHistoryEntry, FavoriteEntity } from "@/types/personSearch";
import { exportFavoritesPdf, exportHistoryPdf } from "@/utils/exportPdf";
import { toast } from "sonner";

interface ScanHistorySidebarProps {
  entries: ScanHistoryEntry[];
  activeId: string | null;
  favoriteEntities: FavoriteEntity[];
  onSelect: (entry: ScanHistoryEntry) => void;
  onDelete: (id: string) => void;
  onRemoveFavorite: (favoriteId: string) => void;
  onClear: () => void;
}

function formatDateTime(date: Date): string {
  return (
    date.toLocaleDateString([], { day: "2-digit", month: "2-digit", year: "numeric" }) +
    " " +
    date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  );
}

export function ScanHistorySidebar({
  entries,
  activeId,
  favoriteEntities,
  onSelect,
  onDelete,
  onRemoveFavorite,
  onClear,
}: ScanHistorySidebarProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [savedOpen, setSavedOpen] = useState(true);

  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [removeFavId, setRemoveFavId] = useState<string | null>(null);

  const deleteTarget = entries.find((e) => e.id === deleteTargetId);
  const removeFavTarget = favoriteEntities.find((f) => f.id === removeFavId);

  return (
    <>
      <aside className={`shrink-0 border-l bg-background flex flex-col h-full transition-all duration-200 ${sidebarOpen ? "w-64" : "w-10"}`}>

        {/* Sidebar toggle strip */}
        <div className={`flex items-center py-3 border-b shrink-0 ${sidebarOpen ? "justify-between px-4" : "justify-center"}`}>
          {sidebarOpen && (
            <span className="text-sm font-semibold">Selections</span>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground"
            title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            onClick={() => setSidebarOpen((o) => !o)}
          >
            {sidebarOpen ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>

        {/* Collapsed hint icons */}
        {!sidebarOpen && (
          <div className="flex flex-col items-center pt-4 gap-1">
            <button
              className="flex flex-col items-center gap-1 hover:opacity-70 transition-opacity cursor-pointer"
              title="Open Saved Persons"
              onClick={() => { setSidebarOpen(true); setSavedOpen(true); }}
            >
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              {favoriteEntities.length > 0 && (
                <span className="text-[10px] text-muted-foreground font-medium">{favoriteEntities.length}</span>
              )}
            </button>
            <div className="h-3" />
            <button
              className="flex flex-col items-center gap-1 hover:opacity-70 transition-opacity cursor-pointer"
              title="Open Scan History"
              onClick={() => { setSidebarOpen(true); setHistoryOpen(true); }}
            >
              <Clock className="h-4 w-4 text-muted-foreground" />
              {entries.length > 0 && (
                <span className="text-[10px] text-muted-foreground font-medium">{entries.length}</span>
              )}
            </button>
          </div>
        )}

        {sidebarOpen && (
          <ScrollArea className="flex-1">

            {/* ── Saved Persons section ── */}
            <div className="border-b">
              <div className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => setSavedOpen((o) => !o)}
              >
                <div className="flex items-center gap-2">
                  <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Saved Persons
                  </span>
                  {favoriteEntities.length > 0 && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{favoriteEntities.length}</Badge>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {favoriteEntities.length > 0 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-foreground"
                      title="Export saved persons to PDF"
                      onClick={async (e) => { e.stopPropagation(); const p = await exportFavoritesPdf(favoriteEntities); if (p) toast.success("PDF saved", { description: p }); }}
                    >
                      <FileDown className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {savedOpen
                    ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                    : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                </div>
              </div>

              {savedOpen && (
                favoriteEntities.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6 px-4">
                    Star a result row to save a person here.
                  </p>
                ) : (
                  <ul className="divide-y">
                    {favoriteEntities.map((fav) => {
                      const name = fav.entity.caption || fav.entity.properties?.name?.[0] || fav.entity.id;
                      return (
                        <li key={fav.id} className="group relative px-4 py-3 hover:bg-muted/60 transition-colors">
                          <div className="flex items-start gap-2 pr-8">
                            <User className="h-3.5 w-3.5 mt-0.5 shrink-0 text-yellow-500" />
                            <div className="min-w-0 flex-1 space-y-0.5">
                              <p className="text-sm font-medium truncate leading-tight">{name}</p>
                              {fav.pluginId && (
                                <div className="flex items-center gap-1">
                                  <Box className="h-3 w-3 text-muted-foreground shrink-0" />
                                  <span className="text-[10px] text-muted-foreground truncate">{fav.pluginId}</span>
                                </div>
                              )}
                              <p className="text-[10px] text-muted-foreground/70">{formatDateTime(fav.savedAt)}</p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                            title="Remove from saved"
                            onClick={() => setRemoveFavId(fav.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                )
              )}
            </div>

            {/* ── Scan History section ── */}
            <div>
              <div
                className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => setHistoryOpen((o) => !o)}
              >
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Scan History
                  </span>
                  {entries.length > 0 && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{entries.length}</Badge>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {entries.length > 0 && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-foreground"
                        title="Export scan history to PDF"
                        onClick={async (e) => { e.stopPropagation(); const p = await exportHistoryPdf(entries); if (p) toast.success("PDF saved", { description: p }); }}
                      >
                        <FileDown className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                        title="Clear all history"
                        onClick={(e) => { e.stopPropagation(); setClearDialogOpen(true); }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                  {historyOpen
                    ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                    : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                </div>
              </div>

              {historyOpen && (
                entries.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6 px-4">
                    No scans yet.
                  </p>
                ) : (
                  <ul className="divide-y">
                    {entries.map((entry) => {
                      const isActive = entry.id === activeId;
                      const count = entry.result.results?.length ?? 0;
                      const total = entry.result.total?.value;
                      return (
                        <li key={entry.id} className={`group relative ${isActive ? "bg-muted" : ""}`}>
                          <button
                            className="w-full text-left px-4 py-3 hover:bg-muted/60 transition-colors pr-10"
                            onClick={() => onSelect(entry)}
                          >
                            <div className="flex items-start gap-2">
                              {entry.searchType === "company"
                                ? <Building2 className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${entry.result.success === false ? "text-destructive" : "text-muted-foreground"}`} />
                                : <User className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${entry.result.success === false ? "text-destructive" : "text-muted-foreground"}`} />}
                              <div className="min-w-0 flex-1 space-y-1">
                                <p className={`text-sm font-medium truncate leading-tight ${isActive ? "text-primary" : ""}`}>
                                  {entry.query || "(no name)"}
                                </p>
                                {entry.pluginId && (
                                  <div className="flex items-center gap-1">
                                    <Box className="h-3 w-3 text-muted-foreground shrink-0" />
                                    <span className="text-[10px] text-muted-foreground truncate">{entry.pluginId}</span>
                                  </div>
                                )}
                                {entry.result.success === false ? (
                                  <div className="flex items-center gap-1">
                                    <AlertCircle className="h-3 w-3 text-destructive shrink-0" />
                                    <span className="text-[10px] text-destructive font-medium">Search failed</span>
                                  </div>
                                ) : (
                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                    {count}{total !== undefined && total !== count ? ` / ${total}` : ""} result{count !== 1 ? "s" : ""}
                                  </Badge>
                                )}
                                <p className="text-[10px] text-muted-foreground/70">{formatDateTime(entry.timestamp)}</p>
                              </div>
                            </div>
                          </button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                            title="Remove this entry"
                            onClick={(e) => { e.stopPropagation(); setDeleteTargetId(entry.id); }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                )
              )}
            </div>

          </ScrollArea>
        )}
      </aside>

      {/* Delete history entry dialog */}
      <Dialog open={deleteTargetId !== null} onOpenChange={(open) => { if (!open) setDeleteTargetId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove scan from view?</DialogTitle>
            <DialogDescription>
              The scan for{" "}
              <span className="font-medium text-foreground">&ldquo;{deleteTarget?.query || "(no name)"}&rdquo;</span>{" "}
              is already saved to the project database. This will only remove it from the history list in the UI.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTargetId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => { if (deleteTargetId) onDelete(deleteTargetId); setDeleteTargetId(null); }}>
              Remove from view
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove saved person dialog */}
      <Dialog open={removeFavId !== null} onOpenChange={(open) => { if (!open) setRemoveFavId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove saved person?</DialogTitle>
            <DialogDescription>
              This will remove{" "}
              <span className="font-medium text-foreground">
                {removeFavTarget?.entity.caption || removeFavTarget?.entity.properties?.name?.[0] || "(unknown)"}
              </span>{" "}
              from your saved persons.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveFavId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => { if (removeFavId) onRemoveFavorite(removeFavId); setRemoveFavId(null); }}>
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clear all history dialog */}
      <Dialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Clear all history from view?</DialogTitle>
            <DialogDescription>
              All{" "}
              <span className="font-medium text-foreground">{entries.length}</span>{" "}
              scan{entries.length !== 1 ? "s are" : " is"} already saved to the project database. This will only remove them from the history list in the UI.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClearDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => { onClear(); setClearDialogOpen(false); }}>
              Clear from view
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
