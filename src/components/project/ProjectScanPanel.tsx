import { Button } from "@/components/ui/button";
import { ProjectPluginSelector } from "@/components/project/ProjectPluginSelector";
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
    onSelectPlugin: (pluginId: string) => void;
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
    selectedPluginId,
    enabledPlugins,
    pluginInputs,
    running,
    onSelectPlugin,
    onSetPluginEnabled,
    onSetPluginField,
    onRunScan,
}: ProjectScanPanelProps) {
    const enabledPluginsList = (settingsData?.plugins ?? []).filter((plugin: PluginRecord) => plugin.enabled);
    const selectedPlugin =
        enabledPluginsList.find((plugin) => plugin.id === selectedPluginId) ??
        enabledPluginsList[0] ??
        null;

    return (
        <section className="flex-1 min-w-0 overflow-y-auto">
            <div id="project-main-anchor" className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 px-4 py-6 lg:px-8 xl:px-10">
                {settingsError ? <p className="text-sm text-red-600">{settingsError}</p> : null}
                {detailError ? <p className="text-sm text-red-600">{detailError}</p> : null}

                {!selectedScan || !scanDetail ? (
                    <div className="rounded-[24px] border border-border/70 bg-card px-6 py-8 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.18)]">
                        <p className="text-sm text-muted-foreground">Select a scan from the history panel.</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                    {scanDetail.status === "Draft" ? (
                        <>
                            <div className="space-y-2">
                                <ProjectPluginSelector
                                    plugins={enabledPluginsList}
                                    selectedPluginId={selectedPlugin?.id ?? null}
                                    onSelect={onSelectPlugin}
                                />
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
                                    />
                                ) : null}
                            </div>

                            <div className="pt-2 flex justify-center">
                                <Button onClick={onRunScan} disabled={running} className="w-full max-w-sm mx-auto">
                                    {running ? "Running..." : "Run"}
                                </Button>
                            </div>
                        </>
                    ) : null}

                    {scanDetail.status !== "Draft" ? (
                        <ScanResultsPanel
                            anchorId="project-results-section"
                            scanDetail={scanDetail}
                            pluginNameById={pluginNameById}
                        />
                    ) : null}
                    </div>
                )}
            </div>
        </section>
    );
}
