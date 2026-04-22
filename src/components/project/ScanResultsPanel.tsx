import { useState, useRef } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { PluginResultView } from "@/components/data-model/PluginResultView";
import { isDataModelResult } from "@/core/data-model/types";
import type { ScanDetailRecord, ScanEntrypointInput } from "@/core/backend/bindings";
import {
  PluginErrorView,
  PluginLogsView,
} from "@/components/project/PluginExecutionViews";
import { cn } from "@/lib/utils";

interface ScanResultsPanelProps {
  scanDetail: ScanDetailRecord;
  pluginNameById: Record<string, string>;
  anchorId?: string;
}

function inputsForResult(inputs: ScanEntrypointInput[], pluginId: string, entrypointId: string) {
  return inputs.filter(
    (i) => i.pluginId === pluginId && i.entrypointId === entrypointId && i.value.type !== "null",
  );
}

function formatFieldName(name: string): string {
  return name.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatEpName(entrypointId: string): string {
  return entrypointId.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function InputsInline({ inputs }: { inputs: ScanEntrypointInput[] }) {
  if (!inputs.length) return null;
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-1 rounded-md bg-muted/50 px-3 py-2 text-xs">
      {inputs.map((inp) => (
        <span key={inp.fieldName}>
          <span className="text-muted-foreground">{formatFieldName(inp.fieldName)}: </span>
          <span className="font-medium">{"value" in inp.value ? String(inp.value.value) : "—"}</span>
        </span>
      ))}
    </div>
  );
}

function CollapsibleEndpointSection({
  id,
  title,
  isError,
  usedInputs,
  children,
  defaultOpen = true,
}: {
  id: string;
  title: string;
  isError: boolean;
  usedInputs: ScanEntrypointInput[];
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div
      id={id}
      className={`rounded-[24px] border shadow-[0_18px_40px_-28px_rgba(15,23,42,0.16)] bg-card ${
        isError ? "border-red-200 dark:border-red-800" : "border-border/70"
      }`}
    >
      <button
        type="button"
        className="flex w-full items-center gap-2 px-5 py-4 text-left"
        onClick={() => setOpen((o) => !o)}
      >
        {open
          ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
        <span className={`text-base font-semibold ${isError ? "text-red-700 dark:text-red-400" : ""}`}>
          {title}
          {isError && <span className="ml-2 text-xs font-normal text-red-500 dark:text-red-400">error</span>}
        </span>
      </button>
      {open && (
        <div className="space-y-3 px-5 pb-5">
          <InputsInline inputs={usedInputs} />
          {children}
        </div>
      )}
    </div>
  );
}

export function ScanResultsPanel({
  scanDetail,
  pluginNameById,
  anchorId,
}: ScanResultsPanelProps) {
  const sidebarRef = useRef<HTMLDivElement>(null);

  if (scanDetail.status === "Running") {
    return <p className="text-sm text-muted-foreground">Scan is running...</p>;
  }

  if (scanDetail.status === "Failed") {
    const failedResults = scanDetail.results.filter((r) => !r.output.ok);
    return (
      <div className="space-y-3">
        <div className="rounded-[20px] border border-red-200 bg-red-50 dark:bg-red-950/40 dark:border-red-800 px-5 py-4">
          <p className="text-sm font-semibold text-red-700 dark:text-red-400 mb-1">Scan failed</p>
          <p className="text-sm text-red-600 dark:text-red-400">
            {failedResults.length > 0
              ? `${failedResults.length} plugin run(s) encountered an error. Check the details below.`
              : "The scan could not be completed. Check plugin settings and inputs."}
          </p>
        </div>
        {scanDetail.results.map((result) => {
          const pluginName = pluginNameById[result.pluginId] ?? result.pluginId;
          const epName = formatEpName(result.entrypointId);
          const usedInputs = inputsForResult(scanDetail.inputs, result.pluginId, result.entrypointId);
          const isError = !result.output.ok;
          return (
            <div
              key={`${result.pluginId}::${result.entrypointId}`}
              className={`rounded-[24px] border p-5 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.16)] space-y-3 bg-card ${
                isError ? "border-red-200 dark:border-red-800" : "border-border/70"
              }`}
            >
              <h3 className={`text-base font-semibold ${isError ? "text-red-700 dark:text-red-400" : ""}`}>
                {pluginName} — {epName}
              </h3>
              <InputsInline inputs={usedInputs} />
              {isError ? (
                <>
                  <PluginErrorView message={result.output.error ?? "Unknown error"} />
                  <PluginLogsView logs={result.output.logs ?? []} />
                </>
              ) : null}
            </div>
          );
        })}
      </div>
    );
  }

  if (scanDetail.status !== "Completed") {
    return null;
  }

  const multipleResults = scanDetail.results.length > 1;

  const resultSections = scanDetail.results.map((result) => {
    const envelope = result.output;
    const isError = !envelope.ok;
    const parsedData =
      !isError && envelope.dataJson
        ? (() => { try { return JSON.parse(envelope.dataJson); } catch { return null; } })()
        : null;
    const entities =
      parsedData !== null && isDataModelResult(parsedData) ? parsedData : null;
    const pluginName = pluginNameById[result.pluginId] ?? result.pluginId;
    const epName = formatEpName(result.entrypointId);
    const cardTitle = multipleResults ? epName : pluginName;
    const usedInputs = inputsForResult(scanDetail.inputs, result.pluginId, result.entrypointId);
    const sectionId = `ep-${result.pluginId}-${result.entrypointId}`;

    return { result, envelope, isError, entities, cardTitle, usedInputs, sectionId };
  });

  if (!multipleResults) {
    // Single endpoint: no sidebar, no collapsible
    if (!resultSections.length) {
      return (
        <div id={anchorId} className="rounded-[20px] border border-border/70 bg-card px-5 py-6">
          <p className="text-sm text-muted-foreground">Scan finished without any plugin results.</p>
        </div>
      );
    }
    const { envelope, isError, entities, cardTitle, usedInputs } = resultSections[0];
    return (
      <div
        id={anchorId}
        className={`rounded-[24px] border p-5 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.16)] space-y-3 bg-card select-text ${
          isError ? "border-red-200 dark:border-red-800" : "border-border/70"
        }`}
      >
        <h3 className={`text-base font-semibold ${isError ? "text-red-700 dark:text-red-400" : ""}`}>
          {cardTitle}
          {isError && <span className="ml-2 text-xs font-normal text-red-500 dark:text-red-400">error</span>}
        </h3>
        <InputsInline inputs={usedInputs} />
        {isError ? (
          <>
            <PluginErrorView message={envelope.error ?? "Unknown error"} />
            <PluginLogsView logs={envelope.logs ?? []} />
          </>
        ) : entities ? (
          <>
            <PluginResultView entities={entities} />
            <PluginLogsView logs={envelope.logs ?? []} />
          </>
        ) : (
          <>
            <pre className="overflow-auto rounded bg-muted p-3 text-xs">{envelope.dataJson ?? "null"}</pre>
            <PluginLogsView logs={envelope.logs ?? []} />
          </>
        )}
      </div>
    );
  }

  // Multiple endpoints: sidebar TOC + collapsible sections
  return (
    <div id={anchorId} className="flex gap-4 select-text">
      {/* Left sticky mini-nav */}
      <aside
        ref={sidebarRef}
        className="hidden lg:flex flex-col gap-1 shrink-0 w-44 sticky top-4 self-start"
      >
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-2 pb-1">
          Endpoints
        </p>
        {resultSections.map(({ sectionId, cardTitle, isError }) => (
          <a
            key={sectionId}
            href={`#${sectionId}`}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors hover:bg-muted",
              isError ? "text-red-600 dark:text-red-400" : "text-foreground/80 hover:text-foreground",
            )}
            onClick={(e) => {
              e.preventDefault();
              document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          >
            <span className={cn("mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full", isError ? "bg-red-500" : "bg-primary/60")} />
            <span className="truncate">{cardTitle}</span>
          </a>
        ))}
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0 space-y-3">
        {!scanDetail.results.length ? (
          <div className="rounded-[20px] border border-border/70 bg-card px-5 py-6">
            <p className="text-sm text-muted-foreground">Scan finished without any plugin results.</p>
          </div>
        ) : null}
        {resultSections.map(({ result, envelope, isError, entities, cardTitle, usedInputs, sectionId }) => (
          <CollapsibleEndpointSection
            key={`${result.pluginId}::${result.entrypointId}`}
            id={sectionId}
            title={cardTitle}
            isError={isError}
            usedInputs={usedInputs}
            defaultOpen
          >
            {isError ? (
              <>
                <PluginErrorView message={envelope.error ?? "Unknown error"} />
                <PluginLogsView logs={envelope.logs ?? []} />
              </>
            ) : entities ? (
              <>
                <PluginResultView entities={entities} />
                <PluginLogsView logs={envelope.logs ?? []} />
              </>
            ) : (
              <>
                <pre className="overflow-auto rounded bg-muted p-3 text-xs">{envelope.dataJson ?? "null"}</pre>
                <PluginLogsView logs={envelope.logs ?? []} />
              </>
            )}
          </CollapsibleEndpointSection>
        ))}
      </div>
    </div>
  );
}


