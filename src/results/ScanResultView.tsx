import { AlertTriangle, CheckCircle2, FileJson } from "lucide-react";
import type {
  LogEntry,
  ScanDetailRecord,
  ScanEntrypointInput,
  ScanPluginResultRecord,
} from "@/core/backend/bindings";
import { EntityCard } from "./EntityCard";
import { ResultBoundary } from "./ResultBoundary";
import { formatDate } from "@/shared/formatDate";
import { RiskTopicSummary } from "./RiskTopicSummary";
import {
  parsePluginData,
  type ParsedPluginData,
  type PluginEntity,
} from "./resultSchema";

interface ScanResultViewProps {
  detail: ScanDetailRecord;
  pluginNameById: Record<string, string>;
  entrypointNameByKey: Record<string, string>;
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
    <div className="space-y-3">
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

export function ScanResultView({
  detail,
  pluginNameById,
  entrypointNameByKey,
  advancedMode,
}: ScanResultViewProps) {
  const parsedResults: ParsedResult[] = detail.results.map((result) => ({
    result,
    data:
      result.output.ok && result.output.dataJson
        ? parsePluginData(result.output.dataJson)
        : null,
  }));
  const topics = riskTopics(parsedResults);
  const visibleInputs = advancedMode
    ? detail.inputs
    : dedupeInputs(detail.inputs);
  const visibleResults = advancedMode
    ? parsedResults
    : parsedResults.filter(
        ({ data }) =>
          data?.kind !== "entities" ||
          !data.entities.every(
            (entity) => entity.$entity === "entity.riskTopic",
          ),
      );
  const completed = detail.status === "Completed";
  const StatusIcon = completed ? CheckCircle2 : AlertTriangle;

  return (
    <div className="mx-auto w-full max-w-4xl">
      <header className="pb-7">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">
            {detail.preview?.trim() || `Investigation ${detail.id.slice(0, 8)}`}
          </h1>
          <span
            className={
              completed
                ? "inline-flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-300"
                : "inline-flex items-center gap-1.5 text-sm text-red-700 dark:text-red-300"
            }
          >
            <StatusIcon className="h-4 w-4" />
            {detail.status}
          </span>
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
                    {input.fieldName}
                    {advancedMode ? (
                      <span className="mt-1 block text-[10px]">
                        {input.pluginId} / {input.entrypointId}
                      </span>
                    ) : null}
                  </dt>
                  <dd className="break-words text-sm">
                    {input.value.type === "null"
                      ? "null"
                      : String(input.value.value)}
                  </dd>
                </div>
              ))}
          </dl>
        </section>
      ) : null}

      {topics.length > 0 ? (
        <section className="border-t py-6">
          <h2 className="mb-4 text-sm font-semibold">
            Risk topics ({topics.length})
          </h2>
          <RiskTopicSummary topics={topics} advancedMode={advancedMode} />
        </section>
      ) : null}

      {parsedResults.length === 0 ? (
        <p className="border-t py-10 text-center text-sm text-muted-foreground">
          The investigation has no plugin results.
        </p>
      ) : (
        visibleResults.map(({ result, data }, resultIndex) => {
          const key = `${result.pluginId}::${result.entrypointId}`;
          const pluginName = pluginNameById[result.pluginId] ?? result.pluginId;
          const entrypointName =
            entrypointNameByKey[key] ?? result.entrypointId;

          return (
            <section
              key={`${key}:${resultIndex}`}
              className="border-t py-6"
            >
              <header className="mb-4">
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  {result.output.ok ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                  )}
                  <span>{pluginName}</span>
                  <span className="text-muted-foreground">/</span>
                  <span>{entrypointName}</span>
                </h2>
              </header>
              <div>
                <ResultBoundary rawOutput={result.output.dataJson}>
                  {result.output.ok ? (
                    <ResultData
                      data={data}
                      hiddenRiskTopics={topics.length > 0}
                      advancedMode={advancedMode}
                    />
                  ) : (
                    <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                      {result.output.error ?? "Plugin execution failed."}
                    </div>
                  )}
                </ResultBoundary>
                {advancedMode ? <Logs logs={result.output.logs} /> : null}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
