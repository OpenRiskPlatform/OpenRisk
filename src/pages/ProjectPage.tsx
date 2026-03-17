import { useEffect, useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useBackendClient } from "@/hooks/useBackendClient";
import type {
    PluginSettingsDescriptor,
    ProjectSettingsPayload,
    ScanDetail,
    ScanSummary,
} from "@/core/backend/types";
import { PluginResultView } from "@/components/data-model/PluginResultView";
import { isDataModelResult } from "@/core/data-model/types";

interface ProjectPageProps {
    projectDir?: string;
}

export function ProjectPage({ projectDir }: ProjectPageProps) {
    const backendClient = useBackendClient();

    const [settingsData, setSettingsData] = useState<ProjectSettingsPayload | null>(null);
    const [settingsError, setSettingsError] = useState<string | null>(null);

    const [scans, setScans] = useState<ScanSummary[]>([]);
    const [scansError, setScansError] = useState<string | null>(null);
    const [selectedScanId, setSelectedScanId] = useState<string | null>(null);

    const [scanDetail, setScanDetail] = useState<ScanDetail | null>(null);
    const [detailError, setDetailError] = useState<string | null>(null);

    const [previewDraft, setPreviewDraft] = useState("");
    const [creatingScan, setCreatingScan] = useState(false);
    const [running, setRunning] = useState(false);

    const [enabledPlugins, setEnabledPlugins] = useState<Record<string, boolean>>({});
    const [pluginInputs, setPluginInputs] = useState<Record<string, Record<string, unknown>>>({});

    const selectedScan = useMemo(
        () => scans.find((scan) => scan.id === selectedScanId) ?? null,
        [scans, selectedScanId]
    );

    useEffect(() => {
        let cancelled = false;
        if (!projectDir) {
            setSettingsData(null);
            setScans([]);
            setSelectedScanId(null);
            return;
        }

        Promise.all([backendClient.loadSettings(projectDir), backendClient.listScans(projectDir)])
            .then(([settings, scansList]) => {
                if (cancelled) {
                    return;
                }
                setSettingsData(settings);
                setScans(scansList);
                setSelectedScanId((prev) => prev ?? scansList[0]?.id ?? null);
                setSettingsError(null);
                setScansError(null);
            })
            .catch((err) => {
                if (cancelled) {
                    return;
                }
                const message = err instanceof Error ? err.message : String(err);
                setSettingsError(message);
                setScansError(message);
            });

        return () => {
            cancelled = true;
        };
    }, [projectDir, backendClient]);

    useEffect(() => {
        if (!projectDir) {
            return;
        }

        const handler = () => {
            backendClient
                .loadSettings(projectDir)
                .then((settings) => setSettingsData(settings))
                .catch((err) => {
                    setSettingsError(err instanceof Error ? err.message : String(err));
                });
        };

        window.addEventListener("openrisk:plugins-updated", handler);
        return () => {
            window.removeEventListener("openrisk:plugins-updated", handler);
        };
    }, [projectDir, backendClient]);

    useEffect(() => {
        let cancelled = false;
        if (!projectDir || !selectedScanId) {
            setScanDetail(null);
            return;
        }

        backendClient
            .getScan(projectDir, selectedScanId)
            .then((detail) => {
                if (cancelled) {
                    return;
                }

                setScanDetail(detail);
                setDetailError(null);

                const enabledMap: Record<string, boolean> = {};
                for (const pluginId of detail.selectedPlugins) {
                    enabledMap[pluginId] = true;
                }
                setEnabledPlugins(enabledMap);

                const incomingInputs =
                    detail.inputs && typeof detail.inputs === "object"
                        ? (detail.inputs as Record<string, Record<string, unknown>>)
                        : {};
                setPluginInputs(incomingInputs);
            })
            .catch((err) => {
                if (cancelled) {
                    return;
                }
                setDetailError(err instanceof Error ? err.message : String(err));
                setScanDetail(null);
            });

        return () => {
            cancelled = true;
        };
    }, [projectDir, selectedScanId, backendClient]);

    const createScan = async () => {
        if (!projectDir) {
            return;
        }
        setCreatingScan(true);
        setScansError(null);
        try {
            const created = await backendClient.createScan(projectDir, previewDraft.trim() || undefined);
            setScans((prev) => [created, ...prev]);
            setSelectedScanId(created.id);
            setPreviewDraft("");
        } catch (err) {
            setScansError(err instanceof Error ? err.message : String(err));
        } finally {
            setCreatingScan(false);
        }
    };

    const setPluginEnabled = (pluginId: string, enabled: boolean) => {
        setEnabledPlugins((prev) => ({ ...prev, [pluginId]: enabled }));
    };

    const setPluginField = (pluginId: string, key: string, value: unknown) => {
        setPluginInputs((prev) => ({
            ...prev,
            [pluginId]: {
                ...(prev[pluginId] ?? {}),
                [key]: value,
            },
        }));
    };

    const runScan = async () => {
        if (!projectDir || !selectedScanId || !scanDetail || scanDetail.status !== "Draft") {
            return;
        }

        const selectedPlugins = Object.entries(enabledPlugins)
            .filter(([, enabled]) => enabled)
            .map(([pluginId]) => pluginId);

        if (!selectedPlugins.length) {
            setDetailError("Enable at least one plugin before run.");
            return;
        }

        setRunning(true);
        setDetailError(null);

        try {
            const updatedScan = await backendClient.runScan(
                projectDir,
                selectedScanId,
                selectedPlugins,
                pluginInputs
            );

            setScans((prev) => prev.map((scan) => (scan.id === updatedScan.id ? updatedScan : scan)));
            const freshDetail = await backendClient.getScan(projectDir, selectedScanId);
            setScanDetail(freshDetail);
        } catch (err) {
            setDetailError(err instanceof Error ? err.message : String(err));
            setScans((prev) =>
                prev.map((scan) =>
                    scan.id === selectedScanId ? { ...scan, status: "Failed" } : scan
                )
            );
        } finally {
            setRunning(false);
        }
    };

    return (
        <MainLayout projectDir={projectDir}>
            <div className="h-[calc(100vh-64px)] w-full overflow-hidden px-4 py-4">
                {!projectDir ? (
                    <Card>
                        <CardHeader>
                            <CardTitle>No project selected</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground">
                                Open or create a project first.
                            </p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid h-full gap-4 lg:grid-cols-[240px_1fr]">
                        <aside className="rounded-lg border bg-card p-3 flex flex-col gap-3">
                            <div className="space-y-2">
                                <p className="text-sm font-semibold">Queries</p>
                                <Input
                                    placeholder="New query name (optional)"
                                    value={previewDraft}
                                    onChange={(e) => setPreviewDraft(e.target.value)}
                                />
                                <Button onClick={createScan} disabled={creatingScan} className="w-full">
                                    {creatingScan ? "Creating..." : "Create Scan"}
                                </Button>
                            </div>

                            {scansError ? <p className="text-sm text-red-600">{scansError}</p> : null}

                            <div className="min-h-0 flex-1 overflow-y-auto space-y-2 pr-1">
                                {scans.map((scan) => (
                                    <button
                                        key={scan.id}
                                        type="button"
                                        className={`w-full text-left rounded-md border px-3 py-2 transition ${selectedScanId === scan.id ? "border-primary bg-primary/5" : "hover:bg-muted/30"
                                            }`}
                                        onClick={() => setSelectedScanId(scan.id)}
                                    >
                                        <p className="text-sm font-medium truncate">
                                            {scan.preview?.trim() || `Query ${scan.id.slice(0, 8)}`}
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {scan.status === "Draft" ? "New" : scan.status}
                                        </p>
                                    </button>
                                ))}
                                {!scans.length ? (
                                    <p className="text-xs text-muted-foreground">No queries yet</p>
                                ) : null}
                            </div>
                        </aside>

                        <section className="rounded-lg border bg-card p-3 overflow-y-auto">
                            {settingsError ? <p className="text-sm text-red-600">{settingsError}</p> : null}
                            {detailError ? <p className="text-sm text-red-600">{detailError}</p> : null}

                            {!selectedScan || !scanDetail ? (
                                <p className="text-sm text-muted-foreground">Select query from the left panel.</p>
                            ) : (
                                <div className="space-y-4">
                                    {scanDetail.status === "Draft" ? (
                                        <>
                                            <div className="space-y-3">
                                                {(settingsData?.plugins ?? []).map((plugin) => (
                                                    <PluginRunCard
                                                        key={plugin.id}
                                                        plugin={plugin}
                                                        enabled={Boolean(enabledPlugins[plugin.id])}
                                                        onEnabledChange={(enabled) => setPluginEnabled(plugin.id, enabled)}
                                                        values={pluginInputs[plugin.id] ?? {}}
                                                        onFieldChange={(key, value) => setPluginField(plugin.id, key, value)}
                                                    />
                                                ))}
                                            </div>

                                            <div className="pt-2">
                                                <Button onClick={runScan} disabled={running} className="w-full max-w-md">
                                                    {running ? "Running..." : "Run"}
                                                </Button>
                                            </div>
                                        </>
                                    ) : null}

                                    {scanDetail.status === "Running" ? (
                                        <p className="text-sm text-muted-foreground">Scan is running...</p>
                                    ) : null}

                                    {scanDetail.status === "Completed" && scanDetail.results.length > 0 ? (
                                        <div className="space-y-4">
                                            {scanDetail.results.map((result) => (
                                                <Card key={result.pluginId}>
                                                    <CardHeader>
                                                        <CardTitle className="text-base">{result.pluginId}</CardTitle>
                                                    </CardHeader>
                                                    <CardContent>
                                                        {isDataModelResult(result.output) ? (
                                                            <PluginResultView entities={result.output} />
                                                        ) : (
                                                            <pre className="rounded bg-muted p-3 text-xs overflow-auto">
                                                                {JSON.stringify(result.output, null, 2)}
                                                            </pre>
                                                        )}
                                                    </CardContent>
                                                </Card>
                                            ))}
                                        </div>
                                    ) : null}

                                    {scanDetail.status === "Failed" ? (
                                        <p className="text-sm text-red-600">Scan failed. Check plugin settings and inputs.</p>
                                    ) : null}
                                </div>
                            )}
                        </section>
                    </div>
                )}
            </div>
        </MainLayout>
    );
}

function PluginRunCard({
    plugin,
    enabled,
    onEnabledChange,
    values,
    onFieldChange,
}: {
    plugin: PluginSettingsDescriptor;
    enabled: boolean;
    onEnabledChange: (enabled: boolean) => void;
    values: Record<string, unknown>;
    onFieldChange: (fieldName: string, value: unknown) => void;
}) {
    const inputSchema = Array.isArray(plugin.inputSchema)
        ? (plugin.inputSchema as Array<any>)
        : [];

    return (
        <Card>
            <CardHeader className="py-3">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <CardTitle className="text-sm">{plugin.name}</CardTitle>
                        <p className="text-xs text-muted-foreground">{plugin.id}</p>
                    </div>
                    <Switch checked={enabled} onCheckedChange={onEnabledChange} />
                </div>
            </CardHeader>

            {enabled ? (
                <CardContent className="space-y-3">
                    {inputSchema.length === 0 ? (
                        <p className="text-sm text-muted-foreground">This plugin does not require inputs.</p>
                    ) : (
                        inputSchema.map((input) => {
                            const name = String(input?.name ?? "");
                            if (!name) {
                                return null;
                            }

                            const label = String(input?.title ?? name);
                            const type = String(input?.type ?? "string");
                            const description =
                                input?.description !== undefined ? String(input.description) : "";
                            const current = values[name];

                            return (
                                <div key={`${plugin.id}-${name}`} className="space-y-1">
                                    <Label className="text-sm">{label}</Label>
                                    {description ? (
                                        <p className="text-xs text-muted-foreground">{description}</p>
                                    ) : null}
                                    <PluginInputField
                                        type={type}
                                        value={current}
                                        onChange={(value) => onFieldChange(name, value)}
                                    />
                                </div>
                            );
                        })
                    )}
                </CardContent>
            ) : null}
        </Card>
    );
}

function PluginInputField({
    type,
    value,
    onChange,
}: {
    type: string;
    value: unknown;
    onChange: (value: unknown) => void;
}) {
    if (type === "number") {
        return (
            <Input
                type="number"
                value={typeof value === "number" ? String(value) : ""}
                onChange={(event) => {
                    const raw = event.target.value;
                    if (!raw.trim()) {
                        onChange(undefined);
                        return;
                    }
                    const parsed = Number(raw);
                    onChange(Number.isNaN(parsed) ? undefined : parsed);
                }}
            />
        );
    }

    if (type === "boolean") {
        return (
            <div className="pt-1">
                <Switch checked={Boolean(value)} onCheckedChange={(checked) => onChange(checked)} />
            </div>
        );
    }

    return (
        <Input
            type="text"
            value={value === undefined || value === null ? "" : String(value)}
            onChange={(event) => onChange(event.target.value)}
        />
    );
}
