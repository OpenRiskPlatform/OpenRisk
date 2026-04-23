import { useEffect, useRef } from "react";
import { ScanSearch } from "lucide-react";
import { ProjectPluginSelector } from "@/components/project/ProjectPluginSelector";
import { EntrypointSelector } from "@/components/project/EntrypointSelector";
import { PluginRunCard } from "@/components/project/PluginRunCard";
import { ScanResultsPanel } from "@/components/project/ScanResultsPanel";
import { ExportPdfButton } from "@/components/project/ExportPdfButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
                                <Card className="rounded-[16px] border-border/60 overflow-hidden">
                                    <CardHeader className="pb-2 flex flex-row items-center justify-between">
                                        <CardTitle className="text-lg font-semibold">Search Criteria</CardTitle>
                                        <ExportPdfButton
                                            scanDetail={scanDetail}
                                            scanTitle={selectedScan?.preview?.trim() || `Scan ${selectedScan?.id.slice(0, 8) ?? ""}`}
                                            performedAt={formatScanPerformedAt(scanDetail!.createdAt)}
                                            pluginNameById={pluginNameById}
                                            label="Save PDF"
                                            size="sm"
                                        />
                                    </CardHeader>
                                    <CardContent className="space-y-4 px-6 pb-0">
                                        {(() => {
                                            const nonNull = scanDetail!.inputs.filter((inp) => inp.value.type !== "null");
                                            const seen = new Set<string>();
                                            const unique = nonNull.filter((inp) => {
                                                const key = `${inp.fieldName}::${"value" in inp.value ? String(inp.value.value) : ""}`;
                                                if (seen.has(key)) return false;
                                                seen.add(key);
                                                return true;
                                            });
                                            // Collect unique plugin names from selected plugins
                                            const pluginNames = Array.from(
                                                new Set(
                                                    scanDetail!.selectedPlugins.map((sp) => pluginNameById[sp.pluginId] ?? sp.pluginId)
                                                )
                                            );
                                            return (
                                                <div className="flex flex-wrap gap-x-6 gap-y-2">
                                                    {pluginNames.map((name) => (
                                                        <span key={`plugin::${name}`} className="text-sm">
                                                            <span className="text-muted-foreground">Plugin: </span>
                                                            <span className="font-semibold">{name}</span>
                                                        </span>
                                                    ))}
                                                    {unique.map((inp, i) => (
                                                        <span key={i} className="text-sm">
                                                            <span className="text-muted-foreground">
                                                                {inp.fieldName.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}:
                                                            </span>{" "}
                                                            <span className="font-semibold">
                                                                {"value" in inp.value ? String(inp.value.value) : "—"}
                                                            </span>
                                                        </span>
                                                    ))}
                                                    {pluginNames.length === 0 && unique.length === 0 && (
                                                        <p className="text-sm text-muted-foreground">No input values were used for this scan.</p>
                                                    )}
                                                </div>
                                            );
                                        })()}

                                        <div className="border-t border-border/50" />

                                        <p className="text-base font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                                            Results
                                            <span className="normal-case font-normal text-sm">
                                                ({scanDetail!.status})
                                            </span>
                                            {scanDetail!.results.length > 0 && (() => {
                                                const rows = scanDetail!.results.reduce((sum, r) => {
                                                    if (!r.output.ok || !r.output.dataJson) return sum;
                                                    try { const d = JSON.parse(r.output.dataJson); return sum + (Array.isArray(d) ? d.length : 0); } catch { return sum; }
                                                }, 0);
                                                return rows > 0 ? <Badge variant="secondary">{rows} rows</Badge> : null;
                                            })()}
                                        </p>
                                    </CardContent>

                                    {/* Results rendered at full card width — no inner padding */}
                                    <div className="pt-8 pb-8">
                                        <ScanResultsPanel
                                            anchorId="project-results-section"
                                            scanDetail={scanDetail!}
                                            pluginNameById={pluginNameById}
                                            showInputsPerResult={false}
                                        />
                                    </div>
                                </Card>
                            </div>
                        ) : null}
                    </>
                )}
            </div>
        </section>
    );
}
