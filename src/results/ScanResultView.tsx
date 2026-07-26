import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, FileJson } from "lucide-react";
import type {
  LogEntry,
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

interface ScanResultViewProps {
  detail: ScanDetailRecord;
  pluginNameById: Record<string, string>;
  entrypointNameByKey: Record<string, string>;
  inputNameByKey: Record<string, string>;
  advancedMode: boolean;
}

interface ParsedResult {
  result: ScanPluginResultRecord;
  data: ParsedPluginData | null;
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
}: ScanResultViewProps) {
  const parsedResults = useMemo<ParsedResult[]>(
    () =>
      detail.results.map((result) => ({
        result,
        data:
          result.output.ok && result.output.dataJson
            ? parsePluginData(result.output.dataJson)
            : null,
      })),
    [detail.results],
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
  return (
    <div className="mx-auto w-full max-w-4xl">
      <header className="pb-7">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">
            {detail.preview?.trim() || `Investigation ${detail.id.slice(0, 8)}`}
          </h1>
          <ScanStatusIndicator status={detail.status} />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {formatDate(detail.createdAt, {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </p>
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
