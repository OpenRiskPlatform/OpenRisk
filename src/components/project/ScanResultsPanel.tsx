import { PluginResultView } from "@/components/data-model/PluginResultView";
import { isDataModelResult } from "@/core/data-model/types";
import type { ScanDetailRecord } from "@/core/backend/bindings";
import { ScanRunInputsView } from "@/components/project/ScanRunInputsView";
import {
  PluginErrorView,
  PluginLogsView,
} from "@/components/project/PluginExecutionViews";

interface ScanResultsPanelProps {
  scanDetail: ScanDetailRecord;
  pluginNameById: Record<string, string>;
  anchorId?: string;
}

export function ScanResultsPanel({
  scanDetail,
  pluginNameById,
  anchorId,
}: ScanResultsPanelProps) {
  if (scanDetail.status === "Running") {
    return <p className="text-sm text-muted-foreground">Scan is running...</p>;
  }

  if (scanDetail.status === "Failed") {
    return (
      <div className="space-y-3">
        <ScanRunInputsView
          scanDetail={scanDetail}
          pluginNameById={pluginNameById}
        />
        <p className="text-sm text-red-600">
          Scan failed. Check plugin settings and inputs.
        </p>
      </div>
    );
  }

  if (scanDetail.status !== "Completed") {
    return null;
  }

  return (
    <div id={anchorId} className="space-y-3 select-text">
      <ScanRunInputsView scanDetail={scanDetail} pluginNameById={pluginNameById} />
      {!scanDetail.results.length ? (
        <div className="rounded-[20px] border border-border/70 bg-card px-5 py-6">
          <p className="text-sm text-muted-foreground">
            Scan finished without any plugin results.
          </p>
        </div>
      ) : null}
      {scanDetail.results.map((result) => {
        const envelope = result.output;
        const parsedData =
          envelope.ok && envelope.dataJson
            ? (() => {
                try {
                  return JSON.parse(envelope.dataJson);
                } catch {
                  return null;
                }
              })()
            : null;
        const entities =
          parsedData !== null && isDataModelResult(parsedData) ? parsedData : null;

        const pluginName = pluginNameById[result.pluginId] ?? result.pluginId;
        const epName = result.entrypointId
          .replace(/-/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase());
        const cardTitle =
          scanDetail.results.length > 1 ? epName : pluginName;

        return (
          <div
            key={`${result.pluginId}::${result.entrypointId}`}
            className="rounded-[24px] border border-border/70 bg-card p-5 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.16)] space-y-3"
          >
            <h3 className="text-base font-semibold">{cardTitle}</h3>
            <div>
              {!envelope.ok ? (
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
                  <pre className="overflow-auto rounded bg-muted p-3 text-xs">
                    {envelope.dataJson ?? "null"}
                  </pre>
                  <PluginLogsView logs={envelope.logs ?? []} />
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
