import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  FileDown,
  FileJson,
  ListChecks,
} from "lucide-react";
import type {
  LogEntry,
  PdfExportSelection,
  ScanDetailRecord,
  ScanEntrypointInput,
  ScanPluginResultRecord,
} from "@/core/backend/bindings";
import { EntityCard } from "./EntityCard";
import { ResultBoundary } from "./ResultBoundary";
import { formatDate } from "@/shared/formatDate";
import { humanizeIdentifier } from "@/shared/humanizeIdentifier";
import { RiskTopicSummary } from "./RiskTopicSummary";
import {
  parsePluginData,
  type ParsedPluginData,
  type PluginEntity,
} from "./resultSchema";
import { ScanStatusIndicator } from "@/investigations/ScanStatusIndicator";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

interface ScanResultViewProps {
  detail: ScanDetailRecord;
  pluginNameById: Record<string, string>;
  entrypointNameByKey: Record<string, string>;
  inputNameByKey: Record<string, string>;
  advancedMode: boolean;
  exportingPdf?: boolean;
  onExportPdf?: (selection: PdfExportSelection | null) => void;
}

interface ParsedResult {
  index: number;
  result: ScanPluginResultRecord;
  data: ParsedPluginData | null;
}

interface ExportItem {
  resultIndex: number;
  itemIndex: number | null;
}

function exportItemKey({ resultIndex, itemIndex }: ExportItem): string {
  return `${resultIndex}:${itemIndex === null ? "all" : itemIndex}`;
}

function resultExportItems(result: ParsedResult): ExportItem[] {
  if (result.data?.kind === "entities" && result.data.entities.length > 0) {
    return result.data.entities.map((_, itemIndex) => ({
      resultIndex: result.index,
      itemIndex,
    }));
  }
  return [{ resultIndex: result.index, itemIndex: null }];
}

function PdfExportControl({
  exporting,
  canChooseContent,
  onExportAll,
  onChooseContent,
}: {
  exporting: boolean;
  canChooseContent: boolean;
  onExportAll: () => void;
  onChooseContent: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  return (
    <div ref={menuRef} className="relative flex">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="rounded-r-none"
        disabled={exporting}
        onClick={onExportAll}
      >
        <FileDown className="h-4 w-4" />
        {exporting ? "Exporting…" : "Export PDF"}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="-ml-px rounded-l-none px-2"
        aria-label="PDF export options"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        disabled={exporting || !canChooseContent}
        onClick={() => setMenuOpen((open) => !open)}
      >
        <ChevronDown className="h-4 w-4" />
      </Button>

      {menuOpen ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-40 mt-1 min-w-48 rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
        >
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
            onClick={() => {
              setMenuOpen(false);
              onChooseContent();
            }}
          >
            <ListChecks className="h-4 w-4" />
            Choose content
          </button>
        </div>
      ) : null}
    </div>
  );
}

function Logs({ logs }: { logs: LogEntry[] }) {
  if (logs.length === 0) {
    return null;
  }

  return (
    <details className="rounded-lg border p-3">
      <summary className="cursor-pointer text-sm font-medium">
        Execution logs ({logs.length})
      </summary>
      <div className="mt-3 space-y-2">
        {logs.map((log, index) => (
          <div key={index} className="grid gap-1 text-xs sm:grid-cols-[4rem_1fr]">
            <span className="font-mono text-muted-foreground">{log.level}</span>
            <span className="whitespace-pre-wrap break-words">{log.message}</span>
          </div>
        ))}
      </div>
    </details>
  );
}

function RawOutput({
  raw,
  error,
  advancedMode,
}: {
  raw: string;
  error?: string;
  advancedMode: boolean;
}) {
  if (!advancedMode) {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
        <p className="font-medium">This result has no visual presentation.</p>
        {error ? <p className="mt-1 text-xs">{error}</p> : null}
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-medium">
            Technical details
          </summary>
          <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap rounded-md border bg-background p-3 text-xs text-foreground">
            {raw}
          </pre>
        </details>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <FileJson className="h-4 w-4" />
        Raw plugin output
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap rounded-lg border bg-muted/30 p-4 text-xs">
        {raw}
      </pre>
    </div>
  );
}

function ResultData({
  data,
  hiddenRiskTopics,
  advancedMode,
  resultIndex,
  exportLabel,
  exportSelectionMode,
  selectedExportItemKeys,
  onExportItemChange,
}: {
  data: ParsedPluginData | null;
  hiddenRiskTopics: boolean;
  advancedMode: boolean;
  resultIndex: number;
  exportLabel: string;
  exportSelectionMode: boolean;
  selectedExportItemKeys: ReadonlySet<string>;
  onExportItemChange: (item: ExportItem, selected: boolean) => void;
}) {
  if (!data) {
    return <p className="text-sm text-muted-foreground">No output data.</p>;
  }

  if (data.kind === "invalid-json") {
    return (
      <RawOutput
        raw={data.raw}
        error={data.error}
        advancedMode={advancedMode}
      />
    );
  }

  if (data.kind === "json") {
    return <RawOutput raw={data.raw} advancedMode={advancedMode} />;
  }

  const entities = data.entities
    .map((entity, itemIndex) => ({ entity, itemIndex }))
    .filter(
      ({ entity }) =>
        !hiddenRiskTopics || entity.$entity !== "entity.riskTopic",
    );

  if (entities.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {hiddenRiskTopics
          ? "Risk topics are grouped in the summary above."
          : "The plugin returned no entities."}
      </p>
    );
  }

  return (
    <div className={advancedMode ? "space-y-4" : ""}>
      {entities.map(({ entity, itemIndex }) => {
        const exportItem = { resultIndex, itemIndex };
        const key = exportItemKey(exportItem);
        return (
          <div
            key={`${entity.$entity}:${entity.$id}:${itemIndex}`}
            className={cn(
              exportSelectionMode && "rounded-md border px-3 py-2",
              exportSelectionMode &&
                selectedExportItemKeys.has(key) &&
                "border-primary/40 bg-muted/20",
            )}
          >
            {exportSelectionMode ? (
              <div className="mb-2 flex items-center gap-2">
                <Checkbox
                  id={`pdf-export-item-${resultIndex}-${itemIndex}`}
                  aria-label={`Include ${exportLabel} item ${itemIndex + 1}`}
                  checked={selectedExportItemKeys.has(key)}
                  onCheckedChange={(checked) =>
                    onExportItemChange(exportItem, checked === true)
                  }
                />
                <label
                  htmlFor={`pdf-export-item-${resultIndex}-${itemIndex}`}
                  className="cursor-pointer text-xs font-medium"
                >
                  Include this item
                </label>
              </div>
            ) : null}
            <EntityCard entity={entity} advancedMode={advancedMode} />
          </div>
        );
      })}
    </div>
  );
}

interface RiskTopicItem extends ExportItem {
  entity: PluginEntity;
}

function riskTopics(results: ParsedResult[]): RiskTopicItem[] {
  const topics: RiskTopicItem[] = [];
  for (const item of results) {
    if (item.data?.kind !== "entities") {
      continue;
    }
    topics.push(
      ...item.data.entities.flatMap((entity, itemIndex) =>
        entity.$entity === "entity.riskTopic"
          ? [{ entity, resultIndex: item.index, itemIndex }]
          : [],
      ),
    );
  }
  return topics;
}

function resultKey(pluginId: string, entrypointId: string) {
  return `${pluginId}::${entrypointId}`;
}

function resultItemCount(results: ParsedResult[]) {
  return results.reduce((count, item) => {
    if (item.data?.kind === "entities") {
      return count + item.data.entities.length;
    }
    return count + 1;
  }, 0);
}

function dedupeInputs(inputs: ScanEntrypointInput[]): ScanEntrypointInput[] {
  const seen = new Set<string>();
  return inputs.filter((input) => {
    const key = `${input.fieldName}:${JSON.stringify(input.value)}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function displayInputValue(input: ScanEntrypointInput): string {
  if (input.value.type === "null") {
    return "Not provided";
  }
  if (input.value.type === "boolean") {
    return input.value.value ? "Yes" : "No";
  }
  return String(input.value.value);
}

export function ScanResultView({
  detail,
  pluginNameById,
  entrypointNameByKey,
  inputNameByKey,
  advancedMode,
  exportingPdf = false,
  onExportPdf,
}: ScanResultViewProps) {
  const parsedResults = useMemo<ParsedResult[]>(
    () =>
      detail.results.map((result, index) => ({
        index,
        result,
        data:
          result.output.ok && result.output.dataJson
            ? parsePluginData(result.output.dataJson)
            : null,
      })),
    [detail.results],
  );
  const [exportSelectionMode, setExportSelectionMode] = useState(false);
  const [includeSearchDetails, setIncludeSearchDetails] = useState(false);
  const [selectedExportItemKeys, setSelectedExportItemKeys] = useState<
    string[]
  >([]);
  const selectedExportItemKeySet = useMemo(
    () => new Set(selectedExportItemKeys),
    [selectedExportItemKeys],
  );
  const selectableExportItems = useMemo(
    () => parsedResults.flatMap(resultExportItems),
    [parsedResults],
  );
  const hasSearchDetails = detail.inputs.length > 0;
  const selectedSectionCount =
    selectedExportItemKeys.length + (includeSearchDetails ? 1 : 0);
  const totalSectionCount =
    selectableExportItems.length + (hasSearchDetails ? 1 : 0);
  const allSectionsSelected =
    totalSectionCount > 0 && selectedSectionCount === totalSectionCount;
  const selectedResults = useMemo<PdfExportSelection["results"]>(
    () =>
      parsedResults.flatMap((result) => {
        const selectedItems = resultExportItems(result).filter((item) =>
          selectedExportItemKeySet.has(exportItemKey(item)),
        );
        if (selectedItems.length === 0) {
          return [];
        }
        return [
          {
            resultIndex: result.index,
            itemIndices:
              result.data?.kind === "entities" &&
              result.data.entities.length > 0
                ? selectedItems.flatMap(({ itemIndex }) =>
                    itemIndex === null ? [] : [itemIndex],
                  )
                : null,
          },
        ];
      }),
    [parsedResults, selectedExportItemKeySet],
  );

  useEffect(() => {
    setExportSelectionMode(false);
    setIncludeSearchDetails(false);
    setSelectedExportItemKeys([]);
  }, [detail.id]);

  useEffect(() => {
    if (exportSelectionMode && exportingPdf) {
      setExportSelectionMode(false);
    }
  }, [exportSelectionMode, exportingPdf]);

  const toggleExportItems = (items: ExportItem[], selected: boolean) => {
    setSelectedExportItemKeys((current) => {
      const next = new Set(current);
      for (const item of items) {
        const key = exportItemKey(item);
        if (selected) {
          next.add(key);
        } else {
          next.delete(key);
        }
      }
      return Array.from(next).sort();
    });
  };

  const startContentSelection = () => {
    setIncludeSearchDetails(false);
    setSelectedExportItemKeys([]);
    setExportSelectionMode(true);
  };

  const cancelContentSelection = () => {
    setExportSelectionMode(false);
    setIncludeSearchDetails(false);
    setSelectedExportItemKeys([]);
  };

  const toggleAllSections = () => {
    if (allSectionsSelected) {
      setIncludeSearchDetails(false);
      setSelectedExportItemKeys([]);
      return;
    }
    setIncludeSearchDetails(hasSearchDetails);
    setSelectedExportItemKeys(selectableExportItems.map(exportItemKey));
  };
  const groupKeys = useMemo(
    () =>
      Array.from(
        new Set([
          ...detail.selectedPlugins.map((selection) =>
            resultKey(selection.pluginId, selection.entrypointId),
          ),
          ...detail.results.map((result) =>
            resultKey(result.pluginId, result.entrypointId),
          ),
        ]),
      ),
    [detail.results, detail.selectedPlugins],
  );
  const [activeKey, setActiveKey] = useState(groupKeys[0] ?? "");

  useEffect(() => {
    if (!groupKeys.includes(activeKey)) {
      setActiveKey(groupKeys[0] ?? "");
    }
  }, [activeKey, groupKeys]);

  const activeResults = parsedResults.filter(
    ({ result }) =>
      resultKey(result.pluginId, result.entrypointId) === activeKey,
  );
  const topics = riskTopics(activeResults);
  const visibleInputs = advancedMode
    ? detail.inputs
    : dedupeInputs(detail.inputs);
  const visibleResults = advancedMode
    ? activeResults
    : activeResults.filter(
        ({ data }) =>
          data?.kind !== "entities" ||
          !data.entities.every(
            (entity) => entity.$entity === "entity.riskTopic",
          ),
      );
  const [activePluginId = "", activeEntrypointId = ""] =
    activeKey.split("::");
  const activePluginName =
    pluginNameById[activePluginId] ?? humanizeIdentifier(activePluginId);
  const activeEntrypointName =
    entrypointNameByKey[activeKey] ??
    humanizeIdentifier(activeEntrypointId);
  const hasFailures = detail.results.some((result) => !result.output.ok);
  return (
    <div className="mx-auto w-full max-w-4xl">
      <header className="pb-7">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold">
              {detail.preview?.trim() ||
                `Investigation ${detail.id.slice(0, 8)}`}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatDate(detail.createdAt, {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {onExportPdf && !exportSelectionMode ? (
              <PdfExportControl
                exporting={exportingPdf}
                canChooseContent={totalSectionCount > 0}
                onExportAll={() => onExportPdf(null)}
                onChooseContent={startContentSelection}
              />
            ) : null}
            <ScanStatusIndicator
              status={detail.status}
              hasFailures={hasFailures}
              className="pt-1"
            />
          </div>
        </div>
      </header>

      {onExportPdf && exportSelectionMode ? (
        <div
          role="region"
          aria-label="PDF content selection"
          className="sticky top-3 z-30 mb-6 flex flex-wrap items-center justify-between gap-3 rounded-md border bg-background/95 px-4 py-3 shadow-sm backdrop-blur"
        >
          <div className="flex min-w-0 items-center gap-3">
            <ListChecks className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="text-sm font-medium">Choose PDF content</p>
              <p className="text-xs text-muted-foreground">
                {selectedSectionCount === 0
                  ? "Select the exact items you want below."
                  : `${selectedSectionCount} of ${totalSectionCount} items selected.`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={toggleAllSections}
            >
              {allSectionsSelected ? "Clear all" : "Select all"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={cancelContentSelection}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={exportingPdf || selectedSectionCount === 0}
              onClick={() =>
                onExportPdf({
                  includeSearchDetails,
                  results: selectedResults,
                })
              }
            >
              <FileDown className="h-4 w-4" />
              Export selected
            </Button>
          </div>
        </div>
      ) : null}

      {visibleInputs.length > 0 ? (
        <section
          className={cn(
            "border-t py-6",
            exportSelectionMode &&
              includeSearchDetails &&
              "bg-muted/20",
          )}
        >
          <div className="mb-3 flex items-center gap-2">
            {exportSelectionMode ? (
              <Checkbox
                id="pdf-export-search-details"
                aria-label="Include search details"
                checked={includeSearchDetails}
                onCheckedChange={(checked) =>
                  setIncludeSearchDetails(checked === true)
                }
              />
            ) : null}
            <h2 className="text-sm font-semibold">
              {exportSelectionMode ? (
                <label
                  htmlFor="pdf-export-search-details"
                  className="cursor-pointer"
                >
                  Search details
                </label>
              ) : (
                "Search details"
              )}
            </h2>
          </div>
          <dl>
            {visibleInputs.map((input, index) => (
              <div
                key={`${input.pluginId}:${input.entrypointId}:${input.fieldName}:${index}`}
                className="grid gap-1 border-b border-border/70 py-2.5 last:border-b-0 sm:grid-cols-[11rem_minmax(0,1fr)]"
              >
                <dt
                  className={
                    advancedMode
                      ? "break-all font-mono text-xs text-muted-foreground"
                      : "break-words text-sm text-muted-foreground"
                  }
                >
                  {advancedMode
                    ? input.fieldName
                    : (inputNameByKey[
                          `${input.pluginId}::${input.entrypointId}::${input.fieldName}`
                      ] ?? humanizeIdentifier(input.fieldName))}
                  {advancedMode ? (
                    <span className="mt-1 block text-[10px]">
                      {input.pluginId} / {input.entrypointId}
                    </span>
                  ) : null}
                </dt>
                <dd className="break-words text-sm">
                  {advancedMode
                    ? input.value.type === "null"
                      ? "null"
                      : String(input.value.value)
                    : displayInputValue(input)}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {parsedResults.length === 0 ? (
        <p className="border-t-2 border-foreground/10 py-10 text-center text-sm text-muted-foreground">
          {detail.status === "Running"
            ? "The investigation is running in the background. You can continue working elsewhere."
            : "The investigation has no plugin results."}
        </p>
      ) : (
        <section className="border-t-2 border-foreground/10 pt-6">
          <header className="mb-4">
            <h2 className="text-base font-semibold">Results</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {activePluginName} / {activeEntrypointName}
            </p>
          </header>

          <div
            role="tablist"
            aria-label="Investigation checks"
            className="flex gap-1 overflow-x-auto border-b"
          >
            {groupKeys.map((key) => {
              const [pluginId = "", entrypointId = ""] = key.split("::");
              const results = parsedResults.filter(
                ({ result }) =>
                  resultKey(result.pluginId, result.entrypointId) === key,
              );
              const label =
                entrypointNameByKey[key] ??
                humanizeIdentifier(entrypointId);
              const pluginName =
                pluginNameById[pluginId] ?? humanizeIdentifier(pluginId);
              const count = resultItemCount(results);
              const failed = results.some(({ result }) => !result.output.ok);
              const groupExportItems = results.flatMap(resultExportItems);
              const selectedInGroup = groupExportItems.filter((item) =>
                selectedExportItemKeySet.has(exportItemKey(item)),
              ).length;

              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-label={label}
                  aria-selected={activeKey === key}
                  title={`${pluginName} / ${label}`}
                  className={
                    activeKey === key
                      ? "shrink-0 border-b-2 border-primary px-3 py-2 text-sm font-medium text-foreground"
                      : "shrink-0 border-b-2 border-transparent px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
                  }
                  onClick={() => setActiveKey(key)}
                >
                  <span>{label}</span>
                  {exportSelectionMode && groupExportItems.length > 0 ? (
                    <span className="ml-1.5 text-xs text-muted-foreground">
                      {selectedInGroup}/{groupExportItems.length}
                    </span>
                  ) : failed ? (
                    <AlertTriangle className="ml-1.5 inline h-3.5 w-3.5 text-destructive" />
                  ) : count > 0 ? (
                    <span className="ml-1.5 text-xs text-muted-foreground">
                      {count}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <div role="tabpanel" className="py-6">
            {topics.length > 0 ? (
              <div className={visibleResults.length > 0 ? "mb-7" : ""}>
                <h3 className="mb-4 text-sm font-semibold">
                  Risk topics ({topics.length})
                </h3>
                <RiskTopicSummary
                  topics={topics.map(({ entity }) => entity)}
                  advancedMode={advancedMode}
                  exportSelectionMode={exportSelectionMode}
                  isTopicSelected={(topicIndex) =>
                    selectedExportItemKeySet.has(
                      exportItemKey(topics[topicIndex]),
                    )
                  }
                  onTopicSelectionChange={(topicIndex, selected) =>
                    toggleExportItems([topics[topicIndex]], selected)
                  }
                />
              </div>
            ) : null}

            {activeResults.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                This check returned no results.
              </p>
            ) : (
              visibleResults.map(({ index, result, data }) => {
                const resultItems = resultExportItems({
                  index,
                  result,
                  data,
                });
                const wholeResultItem = resultItems.find(
                  ({ itemIndex }) => itemIndex === null,
                );
                const resultSelected = resultItems.some((item) =>
                  selectedExportItemKeySet.has(exportItemKey(item)),
                );
                return (
                  <div
                    key={`${activeKey}:${index}`}
                    className={cn(
                      "border-b py-6 first:pt-0 last:border-b-0 last:pb-0",
                      exportSelectionMode && resultSelected && "bg-muted/20",
                    )}
                  >
                    {exportSelectionMode && wholeResultItem ? (
                      <div className="mb-4 flex items-center gap-2 rounded-md border bg-background px-3 py-2">
                        <Checkbox
                          id={`pdf-export-result-${index}`}
                          aria-label={`Include ${activeEntrypointName} result ${index + 1}`}
                          checked={selectedExportItemKeySet.has(
                            exportItemKey(wholeResultItem),
                          )}
                          onCheckedChange={(checked) =>
                            toggleExportItems(
                              [wholeResultItem],
                              checked === true,
                            )
                          }
                        />
                        <label
                          htmlFor={`pdf-export-result-${index}`}
                          className="cursor-pointer text-sm font-medium"
                        >
                          Include this result
                        </label>
                        <span className="ml-auto text-xs text-muted-foreground">
                          Result {index + 1}
                        </span>
                      </div>
                    ) : null}
                    <ResultBoundary rawOutput={result.output.dataJson}>
                      {result.output.ok ? (
                        <ResultData
                          data={data}
                          hiddenRiskTopics={topics.length > 0}
                          advancedMode={advancedMode}
                          resultIndex={index}
                          exportLabel={activeEntrypointName}
                          exportSelectionMode={exportSelectionMode}
                          selectedExportItemKeys={selectedExportItemKeySet}
                          onExportItemChange={(item, selected) =>
                            toggleExportItems([item], selected)
                          }
                        />
                      ) : (
                        <div
                          role="alert"
                          className="border-y border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
                        >
                          {result.output.error ?? "Plugin execution failed."}
                        </div>
                      )}
                    </ResultBoundary>
                    {advancedMode ? <Logs logs={result.output.logs} /> : null}
                  </div>
                );
              })
            )}
          </div>
        </section>
      )}
    </div>
  );
}
