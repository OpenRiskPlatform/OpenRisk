import { useEffect, useMemo, useRef, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { FileText, Plus, Search, Settings } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
    const navigate = useNavigate();

    const [settingsData, setSettingsData] = useState<ProjectSettingsPayload | null>(null);
    const [settingsError, setSettingsError] = useState<string | null>(null);

    const [scans, setScans] = useState<ScanSummary[]>([]);
    const [scansError, setScansError] = useState<string | null>(null);
    const [selectedScanId, setSelectedScanId] = useState<string | null>(null);

    const [scanDetail, setScanDetail] = useState<ScanDetail | null>(null);
    const [detailError, setDetailError] = useState<string | null>(null);

    const [querySearch, setQuerySearch] = useState("");
    const [creatingScan, setCreatingScan] = useState(false);
    const [running, setRunning] = useState(false);
    const [renamingScanId, setRenamingScanId] = useState<string | null>(null);
    const [renamingValue, setRenamingValue] = useState("");

    const [enabledPlugins, setEnabledPlugins] = useState<Record<string, boolean>>({});
    const [pluginInputs, setPluginInputs] = useState<Record<string, Record<string, unknown>>>({});
    const searchInputRef = useRef<HTMLInputElement | null>(null);
    const [projectName, setProjectName] = useState("");
    const [renameDialogOpen, setRenameDialogOpen] = useState(false);
    const [renameProjectValue, setRenameProjectValue] = useState("");
    const [renameProjectSaving, setRenameProjectSaving] = useState(false);

    const selectedScan = useMemo(
        () => scans.find((scan) => scan.id === selectedScanId) ?? null,
        [scans, selectedScanId]
    );

    const filteredScans = useMemo(() => {
        const q = querySearch.trim().toLowerCase();
        if (!q) {
            return scans;
        }
        return scans.filter((scan) => {
            const name = (scan.preview ?? "").toLowerCase();
            return name.includes(q) || scan.id.toLowerCase().includes(q);
        });
    }, [scans, querySearch]);

    const pluginNameById = useMemo(() => {
        const map: Record<string, string> = {};
        for (const plugin of settingsData?.plugins ?? []) {
            map[plugin.id] = plugin.name;
        }
        return map;
    }, [settingsData?.plugins]);

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
                setProjectName(settings.project?.name ?? "");
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
        const fallback = projectDir?.split(/[\\/]/).filter(Boolean).pop() || "Project";
        const titleName = projectName.trim() || fallback;
        const title = `OpenRisk - ${titleName}`;
        document.title = title;
        getCurrentWindow().setTitle(title).catch(() => {
            // Keep document title update even if native call fails.
        });
    }, [projectName, projectDir]);

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
            const created = await backendClient.createScan(projectDir);
            setScans((prev) => [created, ...prev]);
            setSelectedScanId(created.id);
        } catch (err) {
            setScansError(err instanceof Error ? err.message : String(err));
        } finally {
            setCreatingScan(false);
        }
    };

    const startRename = (scan: ScanSummary) => {
        setRenamingScanId(scan.id);
        setRenamingValue(scan.preview?.trim() || `New Scan ${scan.id.slice(0, 8)}`);
    };

    const commitRename = async () => {
        if (!projectDir || !renamingScanId) {
            return;
        }

        const value = renamingValue.trim();
        if (!value) {
            setRenamingScanId(null);
            return;
        }

        try {
            const updated = await backendClient.updateScanPreview(projectDir, renamingScanId, value);
            setScans((prev) =>
                prev.map((scan) => (scan.id === updated.id ? { ...scan, preview: updated.preview } : scan))
            );
        } catch (err) {
            setScansError(err instanceof Error ? err.message : String(err));
        } finally {
            setRenamingScanId(null);
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

    const openRenameDialog = () => {
        setRenameProjectValue(projectName || "");
        setRenameDialogOpen(true);
    };

    const renameProject = async () => {
        if (!projectDir) {
            return;
        }
        const nextName = renameProjectValue.trim();
        if (!nextName) {
            setSettingsError("Project name must not be empty");
            return;
        }

        setRenameProjectSaving(true);
        try {
            const updated = await backendClient.updateProjectName(projectDir, nextName);
            setProjectName(updated.name);
            setSettingsData((prev) =>
                prev
                    ? {
                        ...prev,
                        project: {
                            ...prev.project,
                            name: updated.name,
                        },
                    }
                    : prev
            );
            setRenameDialogOpen(false);
        } catch (err) {
            setSettingsError(err instanceof Error ? err.message : String(err));
        } finally {
            setRenameProjectSaving(false);
        }
    };

    const goBack = async () => {
        await navigate({ to: "/", search: { mode: undefined } });
    };

    return (
        <MainLayout projectDir={projectDir}>
            <div className="h-screen w-full overflow-hidden px-4 py-4">
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
                        <aside className="rounded-lg border bg-card overflow-hidden flex flex-col lg:grid lg:grid-cols-[42px_1fr]">
                            <div className="border-b lg:border-b-0 lg:border-r bg-muted/20 flex items-center justify-between lg:flex-col lg:items-center gap-2 px-2 py-2">
                                <div className="flex items-center gap-2 lg:flex-col">
                                    <Button size="icon" variant="ghost" onClick={createScan} disabled={creatingScan} title="New scan">
                                        <Plus className="h-4 w-4" />
                                    </Button>
                                    <Button size="icon" variant="ghost" onClick={() => setSelectedScanId(scans[0]?.id ?? null)} title="Queries">
                                        <FileText className="h-4 w-4" />
                                    </Button>
                                    <Button size="icon" variant="ghost" onClick={() => searchInputRef.current?.focus()} title="Search">
                                        <Search className="h-4 w-4" />
                                    </Button>
                                </div>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="lg:mt-auto"
                                            title="Settings"
                                        >
                                            <Settings className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent side="right" align="end">
                                        <DropdownMenuItem
                                            onClick={() =>
                                                window.dispatchEvent(new CustomEvent("openrisk:open-settings"))
                                            }
                                        >
                                            Open Settings
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={openRenameDialog}>
                                            Rename Project
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => void goBack()}>Back</DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>

                            <div className="flex flex-col min-h-0 p-2 gap-2">
                                <p className="text-sm font-semibold px-1">Queries</p>
                                <Input
                                    ref={searchInputRef}
                                    placeholder="Type to search..."
                                    value={querySearch}
                                    onChange={(e) => setQuerySearch(e.target.value)}
                                    className="h-9"
                                />

                                {scansError ? <p className="text-xs text-red-600 px-1">{scansError}</p> : null}

                                <div className="min-h-0 flex-1 overflow-y-auto space-y-1">
                                    {filteredScans.map((scan) => (
                                        <button
                                            key={scan.id}
                                            type="button"
                                            className={`w-full text-left rounded-md border px-2.5 py-2 transition ${selectedScanId === scan.id ? "border-primary bg-primary/5" : "hover:bg-muted/30"
                                                }`}
                                            onClick={() => {
                                                if (selectedScanId === scan.id) {
                                                    startRename(scan);
                                                } else {
                                                    setSelectedScanId(scan.id);
                                                    setRenamingScanId(null);
                                                }
                                            }}
                                        >
                                            {renamingScanId === scan.id ? (
                                                <Input
                                                    value={renamingValue}
                                                    autoFocus
                                                    onClick={(event) => event.stopPropagation()}
                                                    onChange={(event) => setRenamingValue(event.target.value)}
                                                    onBlur={() => {
                                                        void commitRename();
                                                    }}
                                                    onKeyDown={(event) => {
                                                        if (event.key === "Enter") {
                                                            void commitRename();
                                                        }
                                                        if (event.key === "Escape") {
                                                            setRenamingScanId(null);
                                                        }
                                                    }}
                                                />
                                            ) : (
                                                <p className="text-sm font-medium truncate">
                                                    {scan.preview?.trim() || `New Scan ${scan.id.slice(0, 8)}`}
                                                </p>
                                            )}
                                            <p className="text-xs text-muted-foreground mt-1 truncate">
                                                {scan.status === "Draft" ? "a.k.a new request" : "a.k.a completed request"}
                                            </p>
                                        </button>
                                    ))}
                                    {!filteredScans.length ? (
                                        <p className="text-xs text-muted-foreground px-1 py-2">No queries yet</p>
                                    ) : null}
                                </div>
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
                                                        <CardTitle className="text-lg">
                                                            {pluginNameById[result.pluginId] ?? result.pluginId}
                                                        </CardTitle>
                                                        <p className="text-xs text-muted-foreground">
                                                            {result.pluginId}
                                                        </p>
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

            <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Rename Project</DialogTitle>
                        <DialogDescription>
                            Set a display name for this project.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-2">
                        <Label htmlFor="rename-project-input">Project name</Label>
                        <Input
                            id="rename-project-input"
                            value={renameProjectValue}
                            onChange={(event) => setRenameProjectValue(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                    void renameProject();
                                }
                            }}
                            autoFocus
                        />
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setRenameDialogOpen(false)}
                            disabled={renameProjectSaving}
                        >
                            Cancel
                        </Button>
                        <Button onClick={() => void renameProject()} disabled={renameProjectSaving}>
                            {renameProjectSaving ? "Saving..." : "Save"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
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
