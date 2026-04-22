import { useEffect, useRef } from "react";
import { ScanSearch } from "lucide-react";
import { ProjectPluginSelector } from "@/components/project/ProjectPluginSelector";
import { EntrypointSelector } from "@/components/project/EntrypointSelector";
import { PluginRunCard } from "@/components/project/PluginRunCard";
import { ScanResultsPanel } from "@/components/project/ScanResultsPanel";
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
        <section className="flex-1 min-w-0 overflow-y-auto">
            <div
                id="project-main-anchor"
                className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8 lg:px-8"
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
                            <div ref={resultsRef} className="space-y-4">
                                <div className="border-t pt-2">
                                    <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                                        Results — {selectedScan?.preview ?? selectedScan?.id}
                                        <span className="ml-2 normal-case font-normal">
                                            ({scanDetail!.status})
                                        </span>
                                    </p>
                                </div>
                                <ScanResultsPanel
                                    anchorId="project-results-section"
                                    scanDetail={scanDetail!}
                                    pluginNameById={pluginNameById}
                                />
                            </div>
                        ) : null}
                    </>
                )}
            </div>
        </section>
    );
}
