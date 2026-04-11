import { useEffect, useMemo, useRef, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "@tanstack/react-router";
import { getCurrentWindow } from "@tauri-apps/api/window";
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
import {
    ProjectScanHistorySidebar,
    type ProjectScanHistoryEntry,
} from "@/components/project/ProjectScanHistorySidebar";
import { ProjectScanPanel } from "@/components/project/ProjectScanPanel";

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

function findPluginById(plugins: PluginRecord[] | undefined, pluginId: string): PluginRecord | undefined {
    return (plugins ?? []).find((plugin) => plugin.id === pluginId);
}

function scanNameCandidate(
    plugins: PluginRecord[] | undefined,
    selection: PluginEntrypointSelection[],
    inputs: ScanEntrypointInput[],
): string {
    const first = selection[0];
    if (!first) {
        return "Scan";
    }

    const preferredFields = [
        "name",
        "target",
        "search_input",
        "targetName",
        "subject",
        "query",
        "full_name",
        "person_name",
        "company_name",
        "ico",
        "org_ico",
    ];

    const selectedKeys = new Set(
        selection.map((item) => `${item.pluginId}::${item.entrypointId}`),
    );

    const matchingInputs = inputs.filter(
        (item) =>
            selectedKeys.has(`${item.pluginId}::${item.entrypointId}`) &&
            item.value.type !== "null",
    );

    for (const field of preferredFields) {
        const matched = matchingInputs.find((item) => item.fieldName === field);
        if (!matched) {
            continue;
        }
        if (!("value" in matched.value)) {
            continue;
        }
        const next = String(matched.value.value ?? "")
            .replace(/\s+/g, " ")
            .trim();
        if (next) {
            return next;
        }
    }

    const fallbackInput = matchingInputs.find((item) => {
        if (!("value" in item.value)) {
            return false;
        }
        const next = String(item.value.value ?? "").trim();
        return next.length > 0;
    });
    if (fallbackInput && "value" in fallbackInput.value) {
        return String(fallbackInput.value.value ?? "")
            .replace(/\s+/g, " ")
            .trim();
    }

    const plugin = findPluginById(plugins, first.pluginId);
    const entrypoint = plugin?.entrypoints.find((item) => item.id === first.entrypointId);
    return entrypoint?.name ?? "Scan";
}

function parseStoredTimestamp(value: string): Date | null {
    if (!value) {
        return null;
    }

    const normalized = value.includes("T")
        ? value
        : `${value.replace(" ", "T")}Z`;
    const parsed = new Date(normalized);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatScanPerformedAt(value: string): string {
    const parsed = parseStoredTimestamp(value);
    if (!parsed) {
        return value;
    }

    return new Intl.DateTimeFormat([], {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(parsed);
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
    const [creatingScan, setCreatingScan] = useState(false);
    const [running, setRunning] = useState(false);
    const [renamingScanId, setRenamingScanId] = useState<string | null>(null);
    const [renamingValue, setRenamingValue] = useState("");

    const [selectedPluginId, setSelectedPluginId] = useState<string | null>(null);
    const [enabledPlugins, setEnabledPlugins] = useState<Record<string, boolean>>({});
    const [pluginInputs, setPluginInputs] = useState<Record<string, Record<string, unknown>>>({});
    const searchInputRef = useRef<HTMLInputElement | null>(null);
    const [projectName, setProjectName] = useState("");

    const selectedScan = useMemo(
        () => scans.find((scan) => scan.id === selectedScanId) ?? null,
        [scans, selectedScanId]
    );

    const filteredScans = useMemo(() => {
        const visibleScans = scans.filter((scan) => !scan.isArchived);
        const q = querySearch.trim().toLowerCase();
        if (!q) {
            return visibleScans;
        }
        return visibleScans.filter((scan) => {
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

    const scanHistoryEntries = useMemo<ProjectScanHistoryEntry[]>(() => {
        return filteredScans.map((scan) => {
            const siblingGroup = scans.filter(
                (candidate) => candidate.isArchived === scan.isArchived,
            );
            const siblingIndex = siblingGroup.findIndex(
                (candidate) => candidate.id === scan.id,
            );
            const pluginName =
                scan.pluginName ??
                (
                    scan.id === selectedScanId && scan.status === "Draft" && selectedPluginId
                        ? (pluginNameById[selectedPluginId] ?? selectedPluginId)
                        : null
                );

            return {
                id: scan.id,
                title: scan.preview?.trim() || `New Scan ${scan.id.slice(0, 8)}`,
                performedAt: formatScanPerformedAt(scan.createdAt),
                pluginName,
                resultCount: scan.resultCount,
                isArchived: scan.isArchived,
                canMoveUp: siblingIndex > 0,
                canMoveDown:
                    siblingIndex !== -1 && siblingIndex < siblingGroup.length - 1,
            };
        });
    }, [
        filteredScans,
        pluginNameById,
        scans,
        selectedPluginId,
        selectedScanId,
    ]);

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
        const handler = (event: Event) => {
            const custom = event as CustomEvent<{ name?: string }>;
            const nextName = custom.detail?.name?.trim();
            if (!nextName) {
                return;
            }
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
                    : prev,
            );
        };

        window.addEventListener("openrisk:project-renamed", handler as EventListener);
        return () => {
            window.removeEventListener("openrisk:project-renamed", handler as EventListener);
        };
    }, []);

    useEffect(() => {
        const selected = scans.find((scan) => scan.id === selectedScanId);
        if (selected?.isArchived) {
            setSelectedScanId(scans.find((scan) => !scan.isArchived)?.id ?? null);
        }
    }, [scans, selectedScanId]);

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
                setSelectedPluginId((prev) =>
                    detail.selectedPlugins[0]?.pluginId ??
                    prev ??
                    settingsData?.plugins.find((plugin) => plugin.enabled)?.id ??
                    null,
                );

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
    }, [projectDir, projectSessionReady, selectedScanId, backendClient, settingsData?.plugins]);

    useEffect(() => {
        const enabledPluginIds = (settingsData?.plugins ?? [])
            .filter((plugin) => plugin.enabled)
            .map((plugin) => plugin.id);
        if (!enabledPluginIds.length) {
            setSelectedPluginId(null);
            return;
        }
        if (!selectedPluginId || !enabledPluginIds.includes(selectedPluginId)) {
            setSelectedPluginId(enabledPluginIds[0]);
        }
    }, [settingsData?.plugins, selectedPluginId]);

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

        if (!selectedPluginId) {
            setDetailError("Select one plugin before run.");
            return;
        }

        const selectedPlugins: PluginEntrypointSelection[] = Object.entries(enabledPlugins)
            .filter(([key, enabled]) => enabled && key.startsWith(`${selectedPluginId}::`))
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

            const smartPreview = scanNameCandidate(settingsData?.plugins, selectedPlugins, inputs)
                .slice(0, 120)
                .trim();
            if (smartPreview) {
                try {
                    const renamed = await unwrap(backendClient.updateScanPreview(selectedScanId, smartPreview));
                    setScans((prev) =>
                        prev.map((scan) =>
                            scan.id === renamed.id ? { ...scan, preview: renamed.preview } : scan,
                        ),
                    );
                } catch {
                    // Keep run flow robust even if auto-rename fails.
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
            <div className="flex h-screen w-full min-h-0 overflow-hidden select-none">
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
                    <>
                        <div className="flex min-w-0 flex-1 overflow-auto">
                            <ProjectScanPanel
                                selectedScan={selectedScan}
                                scanDetail={scanDetail}
                                settingsData={settingsData}
                                settingsError={settingsError}
                                detailError={detailError}
                                pluginNameById={pluginNameById}
                                selectedPluginId={selectedPluginId}
                                enabledPlugins={enabledPlugins}
                                pluginInputs={pluginInputs}
                                running={running}
                                onSelectPlugin={setSelectedPluginId}
                                onSetPluginEnabled={setPluginEnabled}
                                onSetPluginField={setPluginField}
                                onRunScan={() => void runScan()}
                            />
                        </div>

                        <ProjectScanHistorySidebar
                            entries={scanHistoryEntries}
                            activeId={selectedScanId}
                            querySearch={querySearch}
                            creatingScan={creatingScan}
                            renamingScanId={renamingScanId}
                            renamingValue={renamingValue}
                            scansError={scansError}
                            searchInputRef={searchInputRef}
                            onCreateScan={() => void createScan()}
                            onSelect={(scanId) => setSelectedScanId(scanId || null)}
                            onStartRename={(scanId) => {
                                const scan = scans.find((candidate) => candidate.id === scanId);
                                if (scan) {
                                    startRename(scan);
                                }
                            }}
                            onRenamingValueChange={setRenamingValue}
                            onCommitRename={() => void commitRename()}
                            onCancelRename={() => setRenamingScanId(null)}
                            onQuerySearchChange={setQuerySearch}
                            onMoveScan={(scanId, delta) => {
                                const scan = scans.find((candidate) => candidate.id === scanId);
                                if (scan) {
                                    void moveScan(scan, delta);
                                }
                            }}
                            onOpenSettings={() =>
                                window.dispatchEvent(new CustomEvent("openrisk:open-settings"))
                            }
                            onGoBack={() => void goBack()}
                        />
                    </>
                )}
            </div>
        </MainLayout>
    );
}

function toSettingValue(v: unknown): SettingValue {
    if (v === null || v === undefined) return { type: "null" };
    if (typeof v === "boolean") return { type: "boolean", value: v };
    if (typeof v === "number") return { type: "number", value: v };
    return { type: "string", value: String(v) };
}
