/**
 * SearchResultsPanel – header with view toggle, copy button, and either the
 * table or the raw JSON view.
 */

import { Check, Clipboard, FileDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PersonResultTable } from "@/components/personSearch/PersonResultTable";
import { SearchResult, SearchResultEntity, PersonSearchFields } from "@/types/personSearch";
import { exportResultsPdf } from "@/utils/exportPdf";

interface SearchResultsPanelProps {
  result: SearchResult;
  page: number;
  loading: boolean;
  viewMode: "table" | "json";
  copied: boolean;
  searchFields?: PersonSearchFields;
  favoriteEntityIds?: Set<string>;
  onToggleFavorite?: (entity: SearchResultEntity) => void;
  onReorder?: (ordered: SearchResultEntity[]) => void;
  onViewModeChange: (mode: "table" | "json") => void;
  onPageChange: (page: number) => void;
  onCopyJson: () => void;
}

export function SearchResultsPanel({
  result,
  page,
  loading,
  viewMode,
  copied,
  searchFields,
  favoriteEntityIds,
  onToggleFavorite,
  onReorder,
  onViewModeChange,
  onPageChange,
  onCopyJson,
}: SearchResultsPanelProps) {
  const shown = result.results?.length ?? 0;
  const total = result.total?.value;

  const usedFields = searchFields
    ? Object.entries({
        "First name":    searchFields.firstName,
        "Last name":     searchFields.lastName,
        "Personal no.":  searchFields.personalNumber,
        "Date of birth": searchFields.dateOfBirth,
        "Nationality":   searchFields.nationality,
      }).filter(([, v]) => v.trim() !== "")
    : [];

  const handleExportPdf = async () => {
    const path = await exportResultsPdf(result, {
      "First Name":       searchFields?.firstName       ?? "",
      "Last Name":        searchFields?.lastName        ?? "",
      "Personal Number":  searchFields?.personalNumber  ?? "",
      "Date of Birth":    searchFields?.dateOfBirth     ?? "",
      "Nationality":      searchFields?.nationality     ?? "",
    });
    if (path) toast.success("PDF saved", { description: path });
  };

  return (
    <div className="isolate">
      <Card className="overflow-visible">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle>Search Results</CardTitle>
              <CardDescription>
                <span>
                  {shown} result{shown !== 1 ? "s" : ""} returned
                  {total !== undefined && total !== shown && (
                    <span className="text-muted-foreground/70">
                      {" "}(out of {total} expected)
                    </span>
                  )}
                </span>
              </CardDescription>
              {usedFields.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {usedFields.map(([label, value]) => (
                    <span
                      key={label}
                      className="inline-flex items-center gap-1 rounded-md border bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                    >
                      <span className="font-medium text-foreground">{label}:</span>
                      {value}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant={viewMode === "table" ? "default" : "outline"}
                size="sm"
                onClick={() => onViewModeChange("table")}
              >
                Table
              </Button>
              <Button
                variant={viewMode === "json" ? "default" : "outline"}
                size="sm"
                onClick={() => onViewModeChange("json")}
              >
                JSON
              </Button>
              {viewMode === "json" && (
                <Button variant="outline" size="sm" onClick={onCopyJson}>
                  {copied ? (
                    <>
                      <Check className="mr-1 h-3.5 w-3.5 text-green-500" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Clipboard className="mr-1 h-3.5 w-3.5" />
                      Copy
                    </>
                  )}
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handleExportPdf} disabled={shown === 0}>
                <FileDown className="mr-1 h-3.5 w-3.5" />
                Export PDF
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className={viewMode === "table" ? "p-0 pt-0" : undefined}>
          {viewMode === "table" ? (
            <PersonResultTable
              entities={result.results ?? []}
              page={page}
              totalResults={result.results?.length ?? 0}
              onPageChange={onPageChange}
              loading={loading}
              favoriteEntityIds={favoriteEntityIds}
              onToggleFavorite={onToggleFavorite}
              onReorder={onReorder}
            />
          ) : (
            <pre className="bg-muted p-4 rounded-lg overflow-auto max-h-[600px] text-xs mx-6 mb-6">
              {JSON.stringify(result, null, 2)}
            </pre>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
