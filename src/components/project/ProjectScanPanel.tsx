import { Button } from "@/components/ui/button";
import { PluginResultView } from "@/components/data-model/PluginResultView";
import { PluginRunCard } from "@/components/project/PluginRunCard";
import { ScanRunInputsView } from "@/components/project/ScanRunInputsView";
import {
    PluginErrorView,
    PluginLogsView,
} from "@/components/project/PluginExecutionViews";
import { isDataModelResult } from "@/core/data-model/types";
import type {
    PluginRecord,
    ProjectSettingsPayload,
    ScanDetailRecord,
    ScanSummaryRecord,
} from "@/core/backend/bindings";

interface ProjectScanPanelProps {
    selectedScan: ScanSummaryRecord | null;
    scanDetail: ScanDetailRecord | null;
    settingsData: ProjectSettingsPayload | null;
    settingsError?: string | null;
    detailError?: string | null;
    pluginNameById: Record<string, string>;
    enabledPlugins: Record<string, boolean>;
    pluginInputs: Record<string, Record<string, unknown>>;
    running: boolean;
    onSetPluginEnabled: (key: string, enabled: boolean) => void;
    onSetPluginField: (key: string, fieldName: string, value: unknown) => void;
    onRunScan: () => void;
}

export function ProjectScanPanel({
    selectedScan,
    scanDetail,
    settingsData,
    settingsError,
    detailError,
    pluginNameById,
    enabledPlugins,
    pluginInputs,
    running,
    onSetPluginEnabled,
    onSetPluginField,
    onRunScan,
}: ProjectScanPanelProps) {
    return (
        <section className="bg-card p-2 overflow-y-auto flex-1 min-w-0">
            {settingsError ? <p className="text-sm text-red-600">{settingsError}</p> : null}
            {detailError ? <p className="text-sm text-red-600">{detailError}</p> : null}

            {!selectedScan || !scanDetail ? (
                <p className="text-sm text-muted-foreground">Select query from the left panel.</p>
            ) : (
                <div className="space-y-4">
                    {scanDetail.status === "Draft" ? (
                        <>
                            <div className="space-y-2">
                                {(settingsData?.plugins ?? []).filter((plugin: PluginRecord) => plugin.enabled).map((plugin: PluginRecord) => {
                                    const enabledMap: Record<string, boolean> = {};
                                    for (const ep of plugin.entrypoints) {
                                        enabledMap[ep.id] = Boolean(enabledPlugins[`${plugin.id}::${ep.id}`]);
                                    }
                                    return (
                                        <PluginRunCard
                                            key={plugin.id}
                                            plugin={plugin}
                                            enabledEntrypoints={enabledMap}
                                            onEntrypointChange={(epId, enabled) => onSetPluginEnabled(`${plugin.id}::${epId}`, enabled)}
                                            entrypointInputs={Object.fromEntries(
                                                plugin.entrypoints.map((ep) => [ep.id, pluginInputs[`${plugin.id}::${ep.id}`] ?? {}]),
                                            )}
                                            onFieldChange={(epId, fieldKey, value) => onSetPluginField(`${plugin.id}::${epId}`, fieldKey, value)}
                                        />
                                    );
                                })}
                            </div>

                            <div className="pt-2 flex justify-center">
                                <Button onClick={onRunScan} disabled={running} className="w-full max-w-sm mx-auto">
                                    {running ? "Running..." : "Run"}
                                </Button>
                            </div>
                        </>
                    ) : null}

                    {scanDetail.status === "Running" ? (
                        <p className="text-sm text-muted-foreground">Scan is running...</p>
                    ) : null}

                    {scanDetail.status === "Completed" && scanDetail.results.length > 0 ? (
                        <div className="space-y-3 select-text">
                            <ScanRunInputsView scanDetail={scanDetail} pluginNameById={pluginNameById} />
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
                                const entities = parsedData !== null && isDataModelResult(parsedData) ? parsedData : null;
                                const revisionSuffix = result.pluginRevisionId ? ` [${result.pluginRevisionId.slice(0, 8)}]` : "";
                                const subtitle = `${result.pluginId} / ${result.entrypointId}${revisionSuffix}`;
                                return (
                                    <div
                                        key={`${result.pluginId}::${result.entrypointId}`}
                                        className="rounded-lg bg-muted/10 p-3"
                                    >
                                        <div className="mb-2">
                                            <h3 className="text-lg font-semibold">
                                                {pluginNameById[result.pluginId] ?? result.pluginId}
                                            </h3>
                                            <p className="text-xs text-muted-foreground">{subtitle}</p>
                                        </div>
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
                                                    <pre className="rounded bg-muted p-3 text-xs overflow-auto">
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
                    ) : null}

                    {scanDetail.status === "Failed" ? (
                        <div className="space-y-3">
                            <ScanRunInputsView scanDetail={scanDetail} pluginNameById={pluginNameById} />
                            <p className="text-sm text-red-600">Scan failed. Check plugin settings and inputs.</p>
                        </div>
                    ) : null}
                </div>
            )}
        </section>
    );
}
