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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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

interface ExportResultOption {
  index: number;
  label: string;
  description: string;
}

function PdfExportControl({
  exporting,
  hasSearchDetails,
  resultOptions,
  onExport,
}: {
  exporting: boolean;
  hasSearchDetails: boolean;
  resultOptions: ExportResultOption[];
  onExport: (selection: PdfExportSelection | null) => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectiveOpen, setSelectiveOpen] = useState(false);
  const [includeSearchDetails, setIncludeSearchDetails] = useState(true);
  const [selectedResultIndices, setSelectedResultIndices] = useState<number[]>(
    [],
  );

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

  const openSelectiveExport = () => {
    setMenuOpen(false);
    setIncludeSearchDetails(hasSearchDetails);
    setSelectedResultIndices(resultOptions.map((option) => option.index));
    setSelectiveOpen(true);
  };

  const allResultsSelected =
    resultOptions.length > 0 &&
    selectedResultIndices.length === resultOptions.length;
  const selectedSectionCount =
    selectedResultIndices.length + (includeSearchDetails ? 1 : 0);

  const toggleResult = (index: number, selected: boolean) => {
    setSelectedResultIndices((current) =>
      selected
        ? Array.from(new Set([...current, index])).sort((a, b) => a - b)
        : current.filter((candidate) => candidate !== index),
    );
  };

  return (
    <>
      <div ref={menuRef} className="relative flex">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-r-none"
          disabled={exporting}
          onClick={() => onExport(null)}
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
          disabled={
            exporting || (!hasSearchDetails && resultOptions.length === 0)
          }
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
              onClick={openSelectiveExport}
            >
              <ListChecks className="h-4 w-4" />
              Selective export
            </button>
          </div>
        ) : null}
      </div>

      <Dialog open={selectiveOpen} onOpenChange={setSelectiveOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Selective PDF export</DialogTitle>
            <DialogDescription>
              Choose which investigation sections to include. The report header
              is always included.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[55vh] space-y-5 overflow-y-auto pr-1">
            {hasSearchDetails ? (
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Search details
                </h3>
                <label
                  htmlFor="pdf-export-search-details"
                  className="flex cursor-pointer items-start gap-3 rounded-md border p-3 hover:bg-muted/40"
                >
                  <Checkbox
                    id="pdf-export-search-details"
                    className="mt-0.5"
                    checked={includeSearchDetails}
                    onCheckedChange={(checked) =>
                      setIncludeSearchDetails(checked === true)
                    }
                  />
                  <span>
                    <span className="block text-sm font-medium">
                      Search details
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      Values used to run this investigation.
                    </span>
                  </span>
                </label>
              </section>
            ) : null}

            <section>
              <div className="mb-2 flex items-center justify-between gap-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Results
                </h3>
                {resultOptions.length > 0 ? (
                  <button
                    type="button"
                    className="text-xs font-medium text-muted-foreground hover:text-foreground"
                    onClick={() =>
                      setSelectedResultIndices(
                        allResultsSelected
                          ? []
                          : resultOptions.map((option) => option.index),
                      )
                    }
                  >
                    {allResultsSelected ? "Clear all" : "Select all"}
                  </button>
                ) : null}
              </div>

              {resultOptions.length > 0 ? (
                <div className="space-y-2">
                  {resultOptions.map((option) => {
                    const checkboxId = `pdf-export-result-${option.index}`;
                    return (
                      <label
                        key={option.index}
                        htmlFor={checkboxId}
                        className="flex cursor-pointer items-start gap-3 rounded-md border p-3 hover:bg-muted/40"
                      >
                        <Checkbox
                          id={checkboxId}
                          className="mt-0.5"
                          checked={selectedResultIndices.includes(option.index)}
                          onCheckedChange={(checked) =>
                            toggleResult(option.index, checked === true)
                          }
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">
                            {option.label}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {option.description}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                  No results are available for export.
                </p>
              )}
            </section>
          </div>

          <DialogFooter className="items-center sm:justify-between">
            <span className="text-xs text-muted-foreground">
              {selectedSectionCount} selected
            </span>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setSelectiveOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={exporting || selectedSectionCount === 0}
                onClick={() => {
                  setSelectiveOpen(false);
                  onExport({
                    includeSearchDetails,
                    resultIndices: selectedResultIndices,
                  });
                }}
              >
                <FileDown className="h-4 w-4" />
                Export selected
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
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
}: {
  data: ParsedPluginData | null;
  hiddenRiskTopics: boolean;
  advancedMode: boolean;
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

  const entities = hiddenRiskTopics
    ? data.entities.filter((entity) => entity.$entity !== "entity.riskTopic")
    : data.entities;

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
      {entities.map((entity, index) => (
        <EntityCard
          key={`${entity.$entity}:${entity.$id}:${index}`}
          entity={entity}
          advancedMode={advancedMode}
        />
      ))}
    </div>
  );
}

function riskTopics(results: ParsedResult[]): PluginEntity[] {
  const topics: PluginEntity[] = [];
  for (const item of results) {
    if (item.data?.kind !== "entities") {
      continue;
    }
    topics.push(
      ...item.data.entities.filter(
        (entity) => entity.$entity === "entity.riskTopic",
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
  const exportResultOptions = useMemo<ExportResultOption[]>(
    () =>
      parsedResults.map((item) => {
        const key = resultKey(
          item.result.pluginId,
          item.result.entrypointId,
        );
        const entrypointName =
          entrypointNameByKey[key] ??
          humanizeIdentifier(item.result.entrypointId);
        const pluginName =
          pluginNameById[item.result.pluginId] ??
          humanizeIdentifier(item.result.pluginId);
        const itemCount = resultItemCount([item]);
        const resultDescription = !item.result.output.ok
          ? "Failed execution"
          : `${itemCount} ${itemCount === 1 ? "item" : "items"}`;

        return {
          index: item.index,
          label: `Result ${item.index + 1}: ${entrypointName}`,
          description: `${pluginName} / ${resultDescription}`,
        };
      }),
    [entrypointNameByKey, parsedResults, pluginNameById],
  );
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
            {onExportPdf ? (
              <PdfExportControl
                exporting={exportingPdf}
                hasSearchDetails={detail.inputs.length > 0}
                resultOptions={exportResultOptions}
                onExport={onExportPdf}
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

      {visibleInputs.length > 0 ? (
        <section className="border-t py-6">
          <h2 className="mb-3 text-sm font-semibold">Search details</h2>
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
                  {failed ? (
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
                  topics={topics}
                  advancedMode={advancedMode}
                />
              </div>
            ) : null}

            {activeResults.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                This check returned no results.
              </p>
            ) : (
              visibleResults.map(({ result, data }, resultIndex) => (
                <div
                  key={`${activeKey}:${resultIndex}`}
                  className="border-b py-6 first:pt-0 last:border-b-0 last:pb-0"
                >
                  <ResultBoundary rawOutput={result.output.dataJson}>
                    {result.output.ok ? (
                      <ResultData
                        data={data}
                        hiddenRiskTopics={topics.length > 0}
                        advancedMode={advancedMode}
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
              ))
            )}
          </div>
        </section>
      )}
    </div>
  );
}
