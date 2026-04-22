import { useEffect, useRef } from "react";
import { ScanSearch } from "lucide-react";
import { ProjectPluginSelector } from "@/components/project/ProjectPluginSelector";
import { EntrypointSelector } from "@/components/project/EntrypointSelector";
import { PluginRunCard } from "@/components/project/PluginRunCard";
import { ScanResultsPanel } from "@/components/project/ScanResultsPanel";
import { ExportPdfButton } from "@/components/project/ExportPdfButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatScanPerformedAt } from "@/hooks/useProjectWorkspace";
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
    selectedPluginId: string | null;
    enabledPlugins: Record<string, boolean>;
    pluginInputs: Record<string, Record<string, unknown>>;
    running: boolean;
    creatingScan: boolean;
    onSelectPlugin: (pluginId: string) => void;
    onSetPluginEnabled: (key: string, enabled: boolean) => void;
    onSetPluginField: (key: string, fieldName: string, value: unknown) => void;
    onRunScan: () => void;
    onCreateScan: () => void;
}

export function ProjectScanPanel({
    selectedScan,
    scanDetail,
    settingsData,
    settingsError,
    detailError,
    pluginNameById,
    selectedPluginId,
    enabledPlugins,
    pluginInputs,
    running,
    creatingScan,
    onSelectPlugin,
    onSetPluginEnabled,
    onSetPluginField,
    onRunScan,
}: ProjectScanPanelProps) {
    const enabledPluginsList = (settingsData?.plugins ?? []).filter(
        (plugin: PluginRecord) => plugin.enabled,
    );
    const selectedPlugin =
        enabledPluginsList.find((plugin) => plugin.id === selectedPluginId) ??
        enabledPluginsList[0] ??
        null;

    const anyEntrypointEnabled = selectedPlugin
        ? selectedPlugin.entrypoints.some((ep) =>
              Boolean(enabledPlugins[`${selectedPlugin.id}::${ep.id}`]),
          )
        : false;

    const showResults =
        scanDetail && scanDetail.status !== "Draft";

    // Scroll to results when a scan completes
    const resultsRef = useRef<HTMLDivElement | null>(null);
    const prevStatusRef = useRef<string | null>(null);
    useEffect(() => {
        const status = scanDetail?.status ?? null;
        if (
            status === "Completed" &&
            prevStatusRef.current !== "Completed" &&
            resultsRef.current
        ) {
            resultsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
        }
        prevStatusRef.current = status;
    }, [scanDetail?.status]);

    return (
        <section className="flex-1 min-w-0">
            <div
                id="project-main-anchor"
                className="flex w-full flex-col gap-6 px-16 py-10 lg:px-24"
            >
                {/* Settings error — shown at top since it's a config issue */}
                {settingsError ? (
                    <p className="text-sm text-red-600">{settingsError}</p>
                ) : null}

                {/* Page header — always "New Scan" title */}
                <header className="space-y-1">
                    <div className="flex items-center gap-2">
                        <ScanSearch className="h-7 w-7 text-primary" />
                        <h1 className="text-3xl font-bold">New Scan</h1>
                    </div>
                    <p className="text-muted-foreground">
                        Select a plugin, enable the entrypoints you want, fill in the required fields and run.
                    </p>
                </header>

                {/* Always-visible configure form */}
                {enabledPluginsList.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        No enabled plugins. Open{" "}
                        <button
                            className="underline hover:no-underline"
                            onClick={() =>
                                window.dispatchEvent(
                                    new CustomEvent("openrisk:open-settings"),
                                )
                            }
                        >
                            Settings
                        </button>{" "}
                        to install and enable a plugin.
                    </p>
                ) : (
                    <>
                        <ProjectPluginSelector
                            plugins={enabledPluginsList}
                            selectedPluginId={selectedPlugin?.id ?? null}
                            disabled={running || creatingScan}
                            onSelect={onSelectPlugin}
                        />


                        {selectedPlugin ? (
                            <EntrypointSelector
                                entrypoints={selectedPlugin.entrypoints}
                                enabledEntrypoints={Object.fromEntries(
                                    selectedPlugin.entrypoints.map((ep) => [
                                        ep.id,
                                        Boolean(enabledPlugins[`${selectedPlugin.id}::${ep.id}`]),
                                    ]),
                                )}
                                disabled={running || creatingScan}
                                onChange={(epId, enabled) =>
                                    onSetPluginEnabled(`${selectedPlugin.id}::${epId}`, enabled)
                                }
                            />
                        ) : null}

                        {selectedPlugin ? (
                            <PluginRunCard
                                key={selectedPlugin.id}
                                plugin={selectedPlugin}
                                enabledEntrypoints={Object.fromEntries(
                                    selectedPlugin.entrypoints.map((ep) => [
                                        ep.id,
                                        Boolean(enabledPlugins[`${selectedPlugin.id}::${ep.id}`]),
                                    ]),
                                )}
                                onEntrypointChange={(epId, enabled) =>
                                    onSetPluginEnabled(`${selectedPlugin.id}::${epId}`, enabled)
                                }
                                entrypointInputs={Object.fromEntries(
                                    selectedPlugin.entrypoints.map((ep) => [
                                        ep.id,
                                        pluginInputs[`${selectedPlugin.id}::${ep.id}`] ?? {},
                                    ]),
                                )}
                                onFieldChange={(epId, fieldKey, value) =>
                                    onSetPluginField(`${selectedPlugin.id}::${epId}`, fieldKey, value)
                                }
                                running={running || creatingScan}
                                canRun={anyEntrypointEnabled}
                                detailError={detailError ?? null}
                                onRunScan={onRunScan}
                            />
                        ) : null}

                        {/* Results — below the form, scrolled into view on completion */}
                        {showResults ? (
                            <div ref={resultsRef}>
                                <Card className="rounded-[16px] border-border/60">
                                    <CardHeader className="pb-2 flex flex-row items-center justify-between">
                                        <CardTitle className="text-sm">Search Criteria</CardTitle>
                                        <ExportPdfButton
                                            scanDetail={scanDetail}
                                            scanTitle={selectedScan?.preview?.trim() || `Scan ${selectedScan?.id.slice(0, 8) ?? ""}`}
                                            performedAt={formatScanPerformedAt(scanDetail!.createdAt)}
                                            pluginNameById={pluginNameById}
                                            label="Save PDF"
                                            size="sm"
                                        />
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        {(() => {
                                            const nonNull = scanDetail!.inputs.filter((inp) => inp.value.type !== "null");
                                            if (!nonNull.length) {
                                                return (
                                                    <p className="text-xs text-muted-foreground">No input values were used for this scan.</p>
                                                );
                                            }
                                            const seen = new Set<string>();
                                            const unique = nonNull.filter((inp) => {
                                                const key = `${inp.fieldName}::${"value" in inp.value ? String(inp.value.value) : ""}`;
                                                if (seen.has(key)) return false;
                                                seen.add(key);
                                                return true;
                                            });
                                            return (
                                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                                                    {unique.map((inp, i) => (
                                                        <span key={i}>
                                                            <span className="text-muted-foreground">
                                                                {inp.fieldName.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}:
                                                            </span>{" "}
                                                            <span className="font-medium">
                                                                {"value" in inp.value ? String(inp.value.value) : "—"}
                                                            </span>
                                                        </span>
                                                    ))}
                                                </div>
                                            );
                                        })()}

                                        <div className="border-t border-border/50 my-4" />

                                        <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                                            Results
                                            <span className="ml-2 normal-case font-normal">
                                                ({scanDetail!.status})
                                            </span>
                                        </p>
                                        <ScanResultsPanel
                                            anchorId="project-results-section"
                                            scanDetail={scanDetail!}
                                            pluginNameById={pluginNameById}
                                        />
                                    </CardContent>
                                </Card>
                            </div>
                        ) : null}
                    </>
                )}
            </div>
        </section>
    );
}
