import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FilePenLine,
  LoaderCircle,
  Plus,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ScanSummaryRecord } from "@/core/backend/bindings";
import { cn } from "@/lib/utils";
import { formatDate } from "@/shared/formatDate";

interface InvestigationHistoryProps {
  scans: ScanSummaryRecord[];
  selectedScanId: string | null;
  disabled: boolean;
  onNew: () => void;
  onSelect: (scanId: string) => void;
}

function StatusIcon({ status }: { status: string }) {
  if (status === "Completed") {
    return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
  }
  if (status === "Failed") {
    return <AlertTriangle className="h-4 w-4 text-destructive" />;
  }
  if (status === "Running") {
    return <LoaderCircle className="h-4 w-4 animate-spin" />;
  }
  return <FilePenLine className="h-4 w-4 text-muted-foreground" />;
}

export function InvestigationHistory({
  scans,
  selectedScanId,
  disabled,
  onNew,
  onSelect,
}: InvestigationHistoryProps) {
  const [query, setQuery] = useState("");

  const visibleScans = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return scans.filter((scan) => {
      if (scan.isArchived) {
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
  }, [query, scans]);

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r bg-background">
      <div className="border-b p-3">
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
              return (
                <li key={scan.id}>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onSelect(scan.id)}
                    className={cn(
                      "w-full border-l-2 border-transparent px-3 py-2.5 text-left hover:bg-muted/50 disabled:pointer-events-none disabled:opacity-50",
                      selected && "border-l-primary bg-muted/60",
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <StatusIcon status={scan.status} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {scan.preview?.trim() ||
                            `Investigation ${scan.id.slice(0, 8)}`}
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
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
