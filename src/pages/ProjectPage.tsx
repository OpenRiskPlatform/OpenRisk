import { useEffect, useMemo, useRef, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Plus, Search, Settings, ChevronDown, ChevronUp, AlertTriangle, Terminal, Archive, ArchiveRestore, ArrowUp, ArrowDown } from "lucide-react";
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
import { unwrap } from "@/lib/utils";
import type {
    PluginEntrypointSelection,
    PluginRecord,
    ProjectSettingsPayload,
    ScanDetailRecord,
    ScanEntrypointInput,
    ScanSummaryRecord,
    SettingValue,
} from "@/core/backend/bindings";
import { PluginResultView } from "@/components/data-model/PluginResultView";
import { isDataModelResult } from "@/core/data-model/types";

interface PluginLogEntry {
    level: "log" | "warn" | "error";
    message: string;
}

function PluginErrorView({ message }: { message: string }) {
    const [expanded, setExpanded] = useState(false);
    const stackStart = message.search(/ at (?:async )?[A-Za-z]/);
    const summary = stackStart !== -1 ? message.slice(0, stackStart).trim() : message;
    const stack = stackStart !== -1 ? message.slice(stackStart).trim() : null;

    return (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 space-y-2">
            <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                <p className="text-sm font-medium text-red-700 leading-snug">{summary}</p>
            </div>
            {stack && (
                <button
                    className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600"
                    onClick={() => setExpanded((v) => !v)}
                >
                    {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    {expanded ? "Hide stack trace" : "Show stack trace"}
                </button>
            )}
            {expanded && stack && (
                <pre className="text-xs text-red-500 whitespace-pre-wrap break-all bg-red-100 rounded p-2 overflow-auto max-h-48">
                    {stack}
                </pre>
            )}
        </div>
    );
}

function PluginLogsView({ logs }: { logs: PluginLogEntry[] }) {
    const [expanded, setExpanded] = useState(false);
    if (!logs.length) return null;
    const warnCount = logs.filter(l => l.level === "warn").length;
    const errorCount = logs.filter(l => l.level === "error").length;
    const badge = errorCount > 0 ? `${errorCount} error${errorCount > 1 ? 's' : ''}` :
        warnCount > 0 ? `${warnCount} warning${warnCount > 1 ? 's' : ''}` :
            `${logs.length} log${logs.length > 1 ? 's' : ''}`;
    const levelColor = (level: string) =>
        level === "error" ? "text-red-500" : level === "warn" ? "text-yellow-600" : "text-muted-foreground";

    return (
        <div className="mt-2">
            <button
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setExpanded((v) => !v)}
            >
                <Terminal className="h-3.5 w-3.5" />
                <span>Logs ({badge})</span>
                {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
            {expanded && (
                <div className="mt-1.5 rounded border bg-muted/30 p-2 max-h-48 overflow-auto space-y-0.5">
                    {logs.map((entry, i) => (
                        <div key={i} className={`flex gap-2 text-xs font-mono ${levelColor(entry.level)}`}>
                            <span className="shrink-0 w-12 opacity-60">[{entry.level}]</span>
                            <span className="break-all">{entry.message}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

interface ProjectPageProps {
    projectDir?: string;
}

function sortScans(items: ScanSummaryRecord[]) {
    return [...items].sort((left, right) => {
        if (left.isArchived !== right.isArchived) {
            return Number(left.isArchived) - Number(right.isArchived);
        }
        if (left.sortOrder !== right.sortOrder) {
            return left.sortOrder - right.sortOrder;
        }
        return right.id.localeCompare(left.id);
    });
}

export function ProjectPage({ projectDir }: ProjectPageProps) {
    const backendClient = useBackendClient();
    const navigate = useNavigate();
    const [projectSessionReady, setProjectSessionReady] = useState(false);

    const [settingsData, setSettingsData] = useState<ProjectSettingsPayload | null>(null);
    const [settingsError, setSettingsError] = useState<string | null>(null);

    const [scans, setScans] = useState<ScanSummaryRecord[]>([]);
    const [scansError, setScansError] = useState<string | null>(null);
    const [selectedScanId, setSelectedScanId] = useState<string | null>(null);

    const [scanDetail, setScanDetailRecord] = useState<ScanDetailRecord | null>(null);
    const [detailError, setDetailError] = useState<string | null>(null);

    const [querySearch, setQuerySearch] = useState("");
    const [showArchived, setShowArchived] = useState(false);
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
    const [leftPanelWidth, setLeftPanelWidth] = useState<number>(() => {
        const stored = Number(localStorage.getItem("openrisk:left-panel-width") ?? "");
        return Number.isFinite(stored) && stored >= 180 && stored <= 420 ? stored : 240;
    });
    const resizingRef = useRef(false);

    const selectedScan = useMemo(
        () => scans.find((scan) => scan.id === selectedScanId) ?? null,
        [scans, selectedScanId]
    );

    const filteredScans = useMemo(() => {
        const visibleScans = showArchived ? scans : scans.filter((scan) => !scan.isArchived);
        const q = querySearch.trim().toLowerCase();
        if (!q) {
            return visibleScans;
        }
        return visibleScans.filter((scan) => {
            const name = (scan.preview ?? "").toLowerCase();
            return name.includes(q) || scan.id.toLowerCase().includes(q);
        });
    }, [scans, querySearch, showArchived]);

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
            setProjectSessionReady(false);
            return;
        }

        unwrap(backendClient.openProject(projectDir, null))
            .then(() => {
                if (!cancelled) {
                    setProjectSessionReady(true);
                }
            })
            .catch((err) => {
                if (!cancelled) {
                    setProjectSessionReady(false);
                    const message = err instanceof Error ? err.message : String(err);
                    setSettingsError(message);
                    setScansError(message);
                    setDetailError(message);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [projectDir, backendClient]);

    useEffect(() => {
        let cancelled = false;
        if (!projectDir || !projectSessionReady) {
            setSettingsData(null);
            setScans([]);
            setSelectedScanId(null);
            return;
        }

        Promise.all([unwrap(backendClient.loadSettings()), unwrap(backendClient.listScans())])
            .then(([settings, scansList]) => {
                if (cancelled) {
                    return;
                }
                setSettingsData(settings);
                setProjectName(settings.project?.name ?? "");
                setScans(sortScans(scansList));
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
    }, [projectDir, projectSessionReady, backendClient]);

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
        const onMouseMove = (event: MouseEvent) => {
            if (!resizingRef.current) {
                return;
            }
            const next = Math.max(180, Math.min(420, event.clientX - 16));
            setLeftPanelWidth(next);
        };

        const onMouseUp = () => {
            if (!resizingRef.current) {
                return;
            }
            resizingRef.current = false;
            localStorage.setItem("openrisk:left-panel-width", String(leftPanelWidth));
            document.body.style.cursor = "";
            document.body.style.userSelect = "";
        };

        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);

        return () => {
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
        };
    }, [leftPanelWidth]);

    useEffect(() => {
        if (!projectDir || !projectSessionReady) {
            return;
        }

        const handler = () => {
            unwrap(backendClient.loadSettings())
                .then((settings) => setSettingsData(settings))
                .catch((err) => {
                    setSettingsError(err instanceof Error ? err.message : String(err));
                });
        };

        window.addEventListener("openrisk:plugins-updated", handler);
        return () => {
            window.removeEventListener("openrisk:plugins-updated", handler);
        };
    }, [projectDir, projectSessionReady, backendClient]);

    useEffect(() => {
        if (showArchived) {
            return;
        }
        const selected = scans.find((scan) => scan.id === selectedScanId);
        if (selected?.isArchived) {
            setSelectedScanId(scans.find((scan) => !scan.isArchived)?.id ?? null);
        }
    }, [showArchived, scans, selectedScanId]);

    useEffect(() => {
        let cancelled = false;
        if (!projectDir || !projectSessionReady || !selectedScanId) {
            setScanDetailRecord(null);
            return;
        }

        unwrap(backendClient.getScan(selectedScanId))
            .then((detail) => {
                if (cancelled) {
                    return;
                }

                setScanDetailRecord(detail);
                setDetailError(null);

                const enabledMap: Record<string, boolean> = {};
                for (const sel of detail.selectedPlugins) {
                    enabledMap[`${sel.pluginId}::${sel.entrypointId}`] = true;
                }
                setEnabledPlugins(enabledMap);

                const incomingInputs: Record<string, Record<string, unknown>> = {};
                for (const input of detail.inputs) {
                    const key = `${input.pluginId}::${input.entrypointId}`;
                    incomingInputs[key] ??= {};
                    incomingInputs[key][input.fieldName] =
                        input.value.type === "null" ? null : input.value.value;
                }
                setPluginInputs(incomingInputs);
            })
            .catch((err) => {
                if (cancelled) {
                    return;
                }
                setDetailError(err instanceof Error ? err.message : String(err));
                setScanDetailRecord(null);
            });

        return () => {
            cancelled = true;
        };
    }, [projectDir, projectSessionReady, selectedScanId, backendClient]);

    const createScan = async () => {
        if (!projectDir || !projectSessionReady) {
            return;
        }
        setCreatingScan(true);
        setScansError(null);
        try {
            const created = await unwrap(backendClient.createScan(null));
            const scansList = await unwrap(backendClient.listScans());
            setScans(sortScans(scansList));
            setSelectedScanId(created.id);
        } catch (err) {
            setScansError(err instanceof Error ? err.message : String(err));
        } finally {
            setCreatingScan(false);
        }
    };

    const startRename = (scan: ScanSummaryRecord) => {
        setRenamingScanId(scan.id);
        setRenamingValue(scan.preview?.trim() || `New Scan ${scan.id.slice(0, 8)}`);
    };

    const commitRename = async () => {
        if (!projectDir || !projectSessionReady || !renamingScanId) {
            return;
        }

        const value = renamingValue.trim();
        if (!value) {
            setRenamingScanId(null);
            return;
        }

        try {
            const updated = await unwrap(backendClient.updateScanPreview(renamingScanId, value));
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

    const setPluginField = (key: string, fieldName: string, value: unknown) => {
        setPluginInputs((prev) => ({
            ...prev,
            [key]: {
                ...(prev[key] ?? {}),
                [fieldName]: value,
            },
        }));
    };

    const runScan = async () => {
        if (
            !projectDir ||
            !projectSessionReady ||
            !selectedScanId ||
            !scanDetail ||
            scanDetail.status !== "Draft"
        ) {
            return;
        }

        const selectedPlugins: PluginEntrypointSelection[] = Object.entries(enabledPlugins)
            .filter(([, enabled]) => enabled)
            .map(([key]) => {
                const [pluginId, entrypointId] = key.split("::");
                return { pluginId, entrypointId: entrypointId ?? "" };
            })
            .filter((sel) => sel.entrypointId.length > 0);

        if (!selectedPlugins.length) {
            setDetailError("Enable at least one plugin before run.");
            return;
        }

        setRunning(true);
        setDetailError(null);

        try {
            const inputs: ScanEntrypointInput[] = [];
            for (const sel of selectedPlugins) {
                const key = `${sel.pluginId}::${sel.entrypointId}`;
                const fields = pluginInputs[key] ?? {};
                for (const [fieldName, rawValue] of Object.entries(fields)) {
                    inputs.push({
                        pluginId: sel.pluginId,
                        entrypointId: sel.entrypointId,
                        fieldName,
                        value: toSettingValue(rawValue),
                    });
                }
            }
            const updatedScan = await unwrap(backendClient.runScan(
                selectedScanId,
                selectedPlugins,
                inputs,
            ));

            setScans((prev) => sortScans(prev.map((scan) => (scan.id === updatedScan.id ? updatedScan : scan))));
            const freshDetail = await unwrap(backendClient.getScan(selectedScanId));
            setScanDetailRecord(freshDetail);
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

    const setScanArchived = async (scan: ScanSummaryRecord, archived: boolean) => {
        if (!projectDir || !projectSessionReady) {
            return;
        }

        try {
            const updated = await unwrap(backendClient.setScanArchived(scan.id, archived));
            const nextScans = sortScans(scans.map((item) => (item.id === updated.id ? updated : item)));
            setScans(nextScans);

            if (selectedScanId === updated.id && updated.isArchived && !showArchived) {
                setSelectedScanId(nextScans.find((item) => !item.isArchived)?.id ?? null);
            }
        } catch (err) {
            setScansError(err instanceof Error ? err.message : String(err));
        }
    };

    const moveScan = async (scan: ScanSummaryRecord, delta: -1 | 1) => {
        if (!projectDir || !projectSessionReady) {
            return;
        }

        const group = scans.filter((item) => item.isArchived === scan.isArchived);
        const index = group.findIndex((item) => item.id === scan.id);
        const nextIndex = index + delta;
        if (index === -1 || nextIndex < 0 || nextIndex >= group.length) {
            return;
        }

        const swapTarget = group[nextIndex];
        const reordered = [...scans];
        const from = reordered.findIndex((item) => item.id === scan.id);
        const to = reordered.findIndex((item) => item.id === swapTarget.id);
        [reordered[from], reordered[to]] = [reordered[to], reordered[from]];

        try {
            const updated = await unwrap(backendClient.reorderScans(reordered.map((item) => item.id)));
            setScans(sortScans(updated));
        } catch (err) {
            setScansError(err instanceof Error ? err.message : String(err));
        }
    };

    const openRenameDialog = () => {
        setRenameProjectValue(projectName || "");
        setRenameDialogOpen(true);
    };

    const renameProject = async () => {
        if (!projectDir || !projectSessionReady) {
            return;
        }
        const nextName = renameProjectValue.trim();
        if (!nextName) {
            setSettingsError("Project name must not be empty");
            return;
        }

        setRenameProjectSaving(true);
        try {
            await unwrap(backendClient.updateProjectSettings(nextName, null));
            setProjectName(nextName);
            setSettingsData((prev) =>
                prev
                    ? {
                        ...prev,
                        project: {
                            ...prev.project,
                            name: nextName,
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
        try {
            await unwrap(backendClient.closeProject());
        } catch {
            // Ignore close errors on navigation back; the entry page can open again.
        }
        await navigate({ to: "/", search: { mode: undefined } });
    };

    return (
        <MainLayout projectDir={projectDir}>
            <div className="h-screen w-full overflow-hidden select-none">
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
                    <div
                        className="flex h-full flex-col lg:flex-row gap-0"
                        style={{ ["--left-panel-width" as string]: `${leftPanelWidth}px` }}
                    >
                        <aside
                            className="bg-card/70 overflow-hidden flex flex-col lg:grid lg:grid-cols-[42px_1fr] shrink-0 border-b lg:border-b-0 lg:border-r w-full lg:w-[var(--left-panel-width)] h-[46vh] lg:h-auto"
                        >
                            <div className="lg:border-r bg-muted/10 flex items-center justify-between lg:flex-col lg:items-center gap-2 px-2 py-2">
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

                            <div className="flex flex-col min-h-0 p-2 gap-2 bg-card/80">
                                <p className="text-sm font-semibold px-1">Queries</p>
                                <Input
                                    ref={searchInputRef}
                                    placeholder="Type to search..."
                                    value={querySearch}
                                    onChange={(e) => setQuerySearch(e.target.value)}
                                    className="h-9"
                                />

                                <div className="flex items-center justify-between px-1">
                                    <Label htmlFor="show-archived-scans" className="text-xs text-muted-foreground">
                                        Show archived
                                    </Label>
                                    <Switch
                                        id="show-archived-scans"
                                        checked={showArchived}
                                        onCheckedChange={setShowArchived}
                                    />
                                </div>

                                {scansError ? <p className="text-xs text-red-600 px-1">{scansError}</p> : null}

                                <div className="min-h-0 flex-1 overflow-y-auto space-y-0.5">
                                    {filteredScans.map((scan) => (
                                        <div
                                            key={scan.id}
                                            role="button"
                                            tabIndex={0}
                                            className={`w-full text-left rounded px-2.5 py-2 transition ${selectedScanId === scan.id ? "bg-primary/10" : "hover:bg-muted/30"
                                                }`}
                                            onClick={() => {
                                                if (selectedScanId === scan.id) {
                                                    startRename(scan);
                                                } else {
                                                    setSelectedScanId(scan.id);
                                                    setRenamingScanId(null);
                                                }
                                            }}
                                            onKeyDown={(event) => {
                                                if (event.key === "Enter" || event.key === " ") {
                                                    event.preventDefault();
                                                    if (selectedScanId === scan.id) {
                                                        startRename(scan);
                                                    } else {
                                                        setSelectedScanId(scan.id);
                                                        setRenamingScanId(null);
                                                    }
                                                }
                                            }}
                                        >
                                            <div className="flex items-start gap-2">
                                                <div className="min-w-0 flex-1">
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
                                                </div>
                                                <div className="flex items-center gap-0.5 shrink-0">
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7"
                                                        disabled={scans.find((item) => item.isArchived === scan.isArchived)?.id === scan.id}
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            void moveScan(scan, -1);
                                                        }}
                                                        title="Move up"
                                                    >
                                                        <ArrowUp className="h-3.5 w-3.5" />
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7"
                                                        disabled={(() => {
                                                            const group = scans.filter((item) => item.isArchived === scan.isArchived);
                                                            return group[group.length - 1]?.id === scan.id;
                                                        })()}
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            void moveScan(scan, 1);
                                                        }}
                                                        title="Move down"
                                                    >
                                                        <ArrowDown className="h-3.5 w-3.5" />
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7"
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            void setScanArchived(scan, !scan.isArchived);
                                                        }}
                                                        title={scan.isArchived ? "Restore scan" : "Archive scan"}
                                                    >
                                                        {scan.isArchived ? (
                                                            <ArchiveRestore className="h-3.5 w-3.5" />
                                                        ) : (
                                                            <Archive className="h-3.5 w-3.5" />
                                                        )}
                                                    </Button>
                                                </div>
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-1 truncate">
                                                {scan.status === "Draft" ? "a.k.a new request" : "a.k.a completed request"}
                                            </p>
                                            {scan.isArchived ? (
                                                <p className="text-[11px] text-muted-foreground mt-1">Archived</p>
                                            ) : null}
                                        </div>
                                    ))}
                                    {!filteredScans.length ? (
                                        <p className="text-xs text-muted-foreground px-1 py-2">
                                            {showArchived ? "No queries yet" : "No active queries"}
                                        </p>
                                    ) : null}
                                </div>
                            </div>
                        </aside>

                        <div className="block lg:hidden h-2 bg-border/90" />

                        <div
                            className="hidden lg:block w-1 bg-border/70 hover:bg-primary/40 cursor-col-resize"
                            onMouseDown={() => {
                                resizingRef.current = true;
                                document.body.style.cursor = "col-resize";
                                document.body.style.userSelect = "none";
                            }}
                            title="Resize panel"
                        />

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
                                                {(settingsData?.plugins ?? []).map((plugin) => {
                                                    const enabledMap: Record<string, boolean> = {};
                                                    for (const ep of plugin.entrypoints) {
                                                        enabledMap[ep.id] = Boolean(enabledPlugins[`${plugin.id}::${ep.id}`]);
                                                    }
                                                    return (
                                                        <PluginRunCard
                                                            key={plugin.id}
                                                            plugin={plugin}
                                                            enabledEntrypoints={enabledMap}
                                                            onEntrypointChange={(epId, enabled) => setPluginEnabled(`${plugin.id}::${epId}`, enabled)}
                                                            entrypointInputs={Object.fromEntries(
                                                                plugin.entrypoints.map(ep => [ep.id, pluginInputs[`${plugin.id}::${ep.id}`] ?? {}])
                                                            )}
                                                            onFieldChange={(epId, fieldKey, value) => setPluginField(`${plugin.id}::${epId}`, fieldKey, value)}
                                                        />
                                                    );
                                                })}
                                            </div>

                                            <div className="pt-2 flex justify-center">
                                                <Button onClick={runScan} disabled={running} className="w-full max-w-sm mx-auto">
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
                                            {scanDetail.results.map((result) => {
                                                const envelope = result.output;
                                                const parsedData = envelope.ok && envelope.dataJson
                                                    ? (() => { try { return JSON.parse(envelope.dataJson); } catch { return null; } })()
                                                    : null;
                                                const entities =
                                                    parsedData !== null && isDataModelResult(parsedData)
                                                        ? parsedData
                                                        : null;
                                                const revisionSuffix = result.pluginRevisionId ? ` [${result.pluginRevisionId.slice(0, 8)}]` : '';
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
                                                            <p className="text-xs text-muted-foreground">
                                                                {subtitle}
                                                            </p>
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

function toSettingValue(v: unknown): SettingValue {
    if (v === null || v === undefined) return { type: "null" };
    if (typeof v === "boolean") return { type: "boolean", value: v };
    if (typeof v === "number") return { type: "number", value: v };
    return { type: "string", value: String(v) };
}

function PluginRunCard({
    plugin,
    enabledEntrypoints,
    onEntrypointChange,
    entrypointInputs,
    onFieldChange,
}: {
    plugin: PluginRecord;
    enabledEntrypoints: Record<string, boolean>;
    onEntrypointChange: (entrypointId: string, enabled: boolean) => void;
    entrypointInputs: Record<string, Record<string, unknown>>;
    onFieldChange: (entrypointId: string, fieldName: string, value: unknown) => void;
}) {
    const entrypoints = plugin.entrypoints;
    const inputDefs = plugin.inputDefs;

    return (
        <div className="rounded-lg border bg-card p-3">
            <div className="mb-2">
                <p className="text-sm font-semibold">{plugin.name}</p>
                <p className="text-xs text-muted-foreground">{plugin.id}</p>
            </div>

            <div className="space-y-2">
                {entrypoints.map((ep) => (
                    <div key={ep.id}>
                        {(() => {
                            const inputsForEntrypoint = inputDefs.filter((input) => input.entrypointId === ep.id);
                            return (
                                <>
                                    <div className="flex items-center justify-between gap-2">
                                        <div>
                                            <p className="text-sm">{ep.name}</p>
                                            {ep.description ? (
                                                <p className="text-xs text-muted-foreground">{ep.description}</p>
                                            ) : null}
                                        </div>
                                        <Switch
                                            checked={Boolean(enabledEntrypoints[ep.id])}
                                            onCheckedChange={(enabled) => onEntrypointChange(ep.id, enabled)}
                                        />
                                    </div>
                                    {Boolean(enabledEntrypoints[ep.id]) && inputsForEntrypoint.length > 0 ? (
                                        <div className="mt-2 space-y-2 pl-3 border-l-2 border-border/40">
                                            {inputsForEntrypoint.map((input) => {
                                                const current = entrypointInputs[ep.id]?.[input.name];
                                                const options =
                                                    input.type.name === "enum"
                                                        ? input.type.values ?? undefined
                                                        : undefined;
                                                return (
                                                    <div key={`${ep.id}-${input.name}`} className="space-y-1">
                                                        <Label className="text-sm">{input.title}</Label>
                                                        {input.description ? (
                                                            <p className="text-xs text-muted-foreground">{input.description}</p>
                                                        ) : null}
                                                        <PluginInputField
                                                            typeName={input.type.name}
                                                            value={current}
                                                            options={options}
                                                            onChange={(value) => onFieldChange(ep.id, input.name, value)}
                                                        />
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : null}
                                </>
                            );
                        })()}
                    </div>
                ))}
            </div>
        </div>
    );
}

function PluginInputField({
    typeName,
    value,
    onChange,
    options,
}: {
    typeName: string;
    value: unknown;
    onChange: (value: unknown) => void;
    options?: string[];
}) {
    if (options && options.length > 0) {
        const strValue = value === undefined || value === null ? "" : String(value);
        return (
            <Select
                value={strValue || options[0]}
                onValueChange={(v) => onChange(v)}
            >
                <SelectTrigger>
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {options.map((opt) => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        );
    }

    if (typeName === "number" || typeName === "integer") {
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

    if (typeName === "boolean") {
        return (
            <div className="pt-1">
                <Switch checked={Boolean(value)} onCheckedChange={(checked) => onChange(checked)} />
            </div>
        );
    }

    if (typeName === "date") {
        return (
            <Input
                type="date"
                value={value === undefined || value === null ? "" : String(value)}
                onChange={(event) => onChange(event.target.value)}
            />
        );
    }

    if (typeName === "url") {
        return (
            <Input
                type="url"
                value={value === undefined || value === null ? "" : String(value)}
                onChange={(event) => onChange(event.target.value)}
            />
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
