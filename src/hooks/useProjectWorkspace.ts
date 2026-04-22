import { useEffect, useMemo, useRef, useState } from "react";
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
import type { ProjectScanHistoryEntry } from "@/components/project/ProjectScanHistorySidebar";

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

function findPluginById(
  plugins: PluginRecord[] | undefined,
  pluginId: string,
): PluginRecord | undefined {
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
    if (!matched || !("value" in matched.value)) {
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
    return String(item.value.value ?? "").trim().length > 0;
  });

  if (fallbackInput && "value" in fallbackInput.value) {
    return String(fallbackInput.value.value ?? "")
      .replace(/\s+/g, " ")
      .trim();
  }

  const plugin = findPluginById(plugins, first.pluginId);
  const entrypoint = plugin?.entrypoints.find(
    (item) => item.id === first.entrypointId,
  );
  return entrypoint?.name ?? "Scan";
}

function toSettingValue(v: unknown): SettingValue {
  if (v === null || v === undefined) return { type: "null" };
  if (typeof v === "boolean") return { type: "boolean", value: v };
  if (typeof v === "number") return { type: "number", value: v };
  return { type: "string", value: String(v) };
}

function parseStoredTimestamp(value: string): Date | null {
  if (!value) {
    return null;
  }

  const normalized = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatScanPerformedAt(value: string): string {
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

interface UseProjectWorkspaceResult {
  projectSessionReady: boolean;
  settingsData: ProjectSettingsPayload | null;
  settingsError: string | null;
  scans: ScanSummaryRecord[];
  scansError: string | null;
  selectedScanId: string | null;
  setSelectedScanId: (scanId: string | null) => void;
  selectedScan: ScanSummaryRecord | null;
  scanDetail: ScanDetailRecord | null;
  detailError: string | null;
  creatingScan: boolean;
  running: boolean;
  renamingScanId: string | null;
  renamingValue: string;
  setRenamingValue: (value: string) => void;
  startRename: (scan: ScanSummaryRecord) => void;
  commitRename: () => Promise<void>;
  cancelRename: () => void;
  selectedPluginId: string | null;
  setSelectedPluginId: (pluginId: string | null) => void;
  enabledPlugins: Record<string, boolean>;
  setPluginEnabled: (key: string, enabled: boolean) => void;
  pluginInputs: Record<string, Record<string, unknown>>;
  setPluginField: (key: string, fieldName: string, value: unknown) => void;
  pluginNameById: Record<string, string>;
  scanHistoryEntries: ProjectScanHistoryEntry[];
  projectName: string;
  createScan: () => Promise<void>;
  runScan: () => Promise<void>;
  moveScan: (scan: ScanSummaryRecord, delta: -1 | 1) => Promise<void>;
  archiveScan: (scan: ScanSummaryRecord) => Promise<void>;
}

export function useProjectWorkspace(
  projectDir?: string,
  selectedScanIdFromRoute?: string,
): UseProjectWorkspaceResult {
  const backendClient = useBackendClient();
  const lastAppliedRouteScanIdRef = useRef<string | null>(null);

  const [projectSessionReady, setProjectSessionReady] = useState(false);

  const [settingsData, setSettingsData] = useState<ProjectSettingsPayload | null>(
    null,
  );
  const [settingsError, setSettingsError] = useState<string | null>(null);

  const [scans, setScans] = useState<ScanSummaryRecord[]>([]);
  const [scansError, setScansError] = useState<string | null>(null);
  const [selectedScanId, setSelectedScanId] = useState<string | null>(null);

  const [scanDetail, setScanDetailRecord] = useState<ScanDetailRecord | null>(
    null,
  );
  const [detailError, setDetailError] = useState<string | null>(null);

  const [creatingScan, setCreatingScan] = useState(false);
  const [running, setRunning] = useState(false);
  const [renamingScanId, setRenamingScanId] = useState<string | null>(null);
  const [renamingValue, setRenamingValue] = useState("");

  const [selectedPluginId, setSelectedPluginId] = useState<string | null>(null);
  const [enabledPlugins, setEnabledPlugins] = useState<Record<string, boolean>>(
    {},
  );
  const [pluginInputs, setPluginInputs] = useState<
    Record<string, Record<string, unknown>>
  >({});
  const [projectName, setProjectName] = useState("");

  const selectedScan = useMemo(
    () => scans.find((scan) => scan.id === selectedScanId) ?? null,
    [scans, selectedScanId],
  );

  const pluginNameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const plugin of settingsData?.plugins ?? []) {
      map[plugin.id] = plugin.name;
    }
    return map;
  }, [settingsData?.plugins]);

  const scanHistoryEntries = useMemo<ProjectScanHistoryEntry[]>(() => {
    return scans
      .filter((scan) => !scan.isArchived)
      .map((scan) => {
        const siblingGroup = scans.filter(
          (candidate) => candidate.isArchived === scan.isArchived,
        );
        const siblingIndex = siblingGroup.findIndex(
          (candidate) => candidate.id === scan.id,
        );
        const pluginName =
          scan.pluginName ??
          (scan.id === selectedScanId && scan.status === "Draft" && selectedPluginId
            ? (pluginNameById[selectedPluginId] ?? selectedPluginId)
            : null);

        return {
          id: scan.id,
          title: scan.preview?.trim() || `New Scan ${scan.id.slice(0, 8)}`,
          status: scan.status,
          performedAt: formatScanPerformedAt(scan.createdAt),
          pluginName,
          resultCount: scan.resultCount,
          errorResultCount: scan.errorResultCount,
          isArchived: scan.isArchived,
          canMoveUp: siblingIndex > 0,
          canMoveDown:
            siblingIndex !== -1 && siblingIndex < siblingGroup.length - 1,
        };
      });
  }, [pluginNameById, scans, selectedPluginId, selectedScanId]);

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
          const message = err instanceof Error ? err.message : String(err);
          setProjectSessionReady(false);
          setSettingsError(message);
          setScansError(message);
          setDetailError(message);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [backendClient, projectDir]);

  useEffect(() => {
    let cancelled = false;
    if (!projectDir || !projectSessionReady) {
      setSettingsData(null);
      setScans([]);
      setSelectedScanId(null);
      return;
    }

    Promise.all([
      unwrap(backendClient.loadSettings()),
      unwrap(backendClient.listScans()),
    ])
      .then(([settings, scansList]) => {
        if (cancelled) {
          return;
        }

        setSettingsData(settings);
        console.log(
          "[useProjectWorkspace] plugins & inputDefs:",
          settings.plugins.map((p) => ({
            id: p.id,
            name: p.name,
            inputDefs: p.inputDefs,
          })),
        );
        setProjectName(settings.project?.name ?? "");
        setScans(sortScans(scansList));
        setSelectedScanId((prev) => {
          // Only restore a scan if the user explicitly navigated to one via the
          // route, or if they had already selected one in this session (prev).
          // Never auto-select the "latest" scan — the page should always open
          // in "new scan" mode unless the user clicks a history entry.
          const preferred = selectedScanIdFromRoute ?? prev ?? null;

          if (!preferred) {
            return null;
          }

          return scansList.some((scan) => scan.id === preferred)
            ? preferred
            : null;
        });
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
  }, [backendClient, projectDir, projectSessionReady, selectedScanIdFromRoute]);

  useEffect(() => {
    const nextRouteScanId = selectedScanIdFromRoute ?? null;

    if (!nextRouteScanId) {
      lastAppliedRouteScanIdRef.current = null;
      return;
    }

    if (lastAppliedRouteScanIdRef.current === nextRouteScanId) {
      return;
    }

    lastAppliedRouteScanIdRef.current = nextRouteScanId;
    setSelectedScanId(nextRouteScanId);
  }, [selectedScanIdFromRoute]);

  useEffect(() => {
    const fallback =
      projectDir?.split(/[\\/]/).filter(Boolean).pop() || "Project";
    const titleName = projectName.trim() || fallback;
    const title = `OpenRisk - ${titleName}`;
    document.title = title;
    getCurrentWindow()
      .setTitle(title)
      .catch(() => {
        // Keep the document title even if the native title update fails.
      });
  }, [projectDir, projectName]);

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
  }, [backendClient, projectDir, projectSessionReady]);

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

    window.addEventListener(
      "openrisk:project-renamed",
      handler as EventListener,
    );
    return () => {
      window.removeEventListener(
        "openrisk:project-renamed",
        handler as EventListener,
      );
    };
  }, []);

  useEffect(() => {
    const selected = scans.find((scan) => scan.id === selectedScanId);
    if (selected?.isArchived) {
      setSelectedScanId(null);
    }
  }, [scans, selectedScanId]);

  const settingsDataRef = useRef(settingsData);
  useEffect(() => {
    settingsDataRef.current = settingsData;
  }, [settingsData]);

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

        // Only restore entrypoint selections and inputs from a scan that has
        // persisted data (i.e. was previously run). For a fresh empty Draft
        // (auto-created during runScan) keep whatever the user already has set.
        if (detail.selectedPlugins.length > 0) {
          const enabledMap: Record<string, boolean> = {};
          for (const sel of detail.selectedPlugins) {
            enabledMap[`${sel.pluginId}::${sel.entrypointId}`] = true;
          }
          setEnabledPlugins(enabledMap);
          setSelectedPluginId((prev) =>
            detail.selectedPlugins[0]?.pluginId ??
            prev ??
            settingsDataRef.current?.plugins.find((plugin) => plugin.enabled)?.id ??
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
        } else {
          // Fresh Draft — just keep the current plugin selection
          setSelectedPluginId((prev) =>
            prev ??
            settingsDataRef.current?.plugins.find((plugin) => plugin.enabled)?.id ??
            null,
          );
        }
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
  }, [
    backendClient,
    projectDir,
    projectSessionReady,
    selectedScanId,
    // intentionally omitting settingsData?.plugins — we use settingsDataRef
    // to avoid resetting user's checkbox selections when settings reload
  ]);

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
  }, [selectedPluginId, settingsData?.plugins]);

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
      const updated = await unwrap(
        backendClient.updateScanPreview(renamingScanId, value),
      );
      setScans((prev) =>
        prev.map((scan) =>
          scan.id === updated.id ? { ...scan, preview: updated.preview } : scan,
        ),
      );
    } catch (err) {
      setScansError(err instanceof Error ? err.message : String(err));
    } finally {
      setRenamingScanId(null);
    }
  };

  const cancelRename = () => {
    setRenamingScanId(null);
  };

  const setPluginEnabled = (key: string, enabled: boolean) => {
    setEnabledPlugins((prev) => ({ ...prev, [key]: enabled }));
  };

  const setPluginField = (key: string, fieldName: string, value: unknown) => {
    setPluginInputs((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] ?? {}),
        [fieldName]: value,
      },
    }));
    // Clear stale results whenever the user edits an input
    setSelectedScanId(null);
    setScanDetailRecord(null);
    setDetailError(null);
  };

  const runScan = async () => {
    if (!projectDir || !projectSessionReady) {
      return;
    }

    if (!selectedPluginId) {
      setDetailError("Select a plugin before running.");
      return;
    }

    const selectedPlugins: PluginEntrypointSelection[] = Object.entries(
      enabledPlugins,
    )
      .filter(
        ([key, enabled]) => enabled && key.startsWith(`${selectedPluginId}::`),
      )
      .map(([key]) => {
        const [pluginId, entrypointId] = key.split("::");
        return { pluginId, entrypointId: entrypointId ?? "" };
      })
      .filter((sel) => sel.entrypointId.length > 0);

    if (!selectedPlugins.length) {
      setDetailError("Enable at least one entrypoint before running.");
      return;
    }

    setRunning(true);
    setDetailError(null);

    try {
      // Auto-create a fresh Draft scan if the current one is not a Draft
      // (e.g. the user is viewing results and wants to run another scan)
      let scanId = selectedScanId;
      if (!scanId || (scanDetail && scanDetail.status !== "Draft")) {
        const created = await unwrap(backendClient.createScan(null));
        scanId = created.id;
        const scansList = await unwrap(backendClient.listScans());
        setScans(sortScans(scansList));
        setSelectedScanId(scanId);
      }

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

      const smartPreview = scanNameCandidate(
        settingsData?.plugins,
        selectedPlugins,
        inputs,
      )
        .slice(0, 120)
        .trim();

      if (smartPreview) {
        try {
          const renamed = await unwrap(
            backendClient.updateScanPreview(scanId, smartPreview),
          );
          setScans((prev) =>
            prev.map((scan) =>
              scan.id === renamed.id
                ? { ...scan, preview: renamed.preview }
                : scan,
            ),
          );
        } catch {
          // Keep the run flow robust even if preview update fails.
        }
      }

      const updatedScan = await unwrap(
        backendClient.runScan(scanId, selectedPlugins, inputs),
      );

      setScans((prev) =>
        sortScans(
          prev.map((scan) => (scan.id === updatedScan.id ? updatedScan : scan)),
        ),
      );
      const freshDetail = await unwrap(backendClient.getScan(scanId));
      setScanDetailRecord(freshDetail);
      setSelectedScanId(scanId);
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : String(err));
      if (selectedScanId) {
        setScans((prev) =>
          prev.map((scan) =>
            scan.id === selectedScanId ? { ...scan, status: "Failed" } : scan,
          ),
        );
      }
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
      const updated = await unwrap(
        backendClient.reorderScans(reordered.map((item) => item.id)),
      );
      setScans(sortScans(updated));
    } catch (err) {
      setScansError(err instanceof Error ? err.message : String(err));
    }
  };

  const archiveScan = async (scan: ScanSummaryRecord) => {
    if (!projectDir || !projectSessionReady) {
      return;
    }

    try {
      const updated = await unwrap(backendClient.setScanArchived(scan.id, true));
      setScans((prev) =>
        sortScans(prev.map((item) => (item.id === updated.id ? updated : item))),
      );
    } catch (err) {
      setScansError(err instanceof Error ? err.message : String(err));
    }
  };

  return {
    projectSessionReady,
    settingsData,
    settingsError,
    scans,
    scansError,
    selectedScanId,
    setSelectedScanId,
    selectedScan,
    scanDetail,
    detailError,
    creatingScan,
    running,
    renamingScanId,
    renamingValue,
    setRenamingValue,
    startRename,
    commitRename,
    cancelRename,
    selectedPluginId,
    setSelectedPluginId: (pluginId: string | null) => {
      // Clear current scan results and form state when switching to a different plugin
      if (pluginId !== selectedPluginId) {
        setSelectedScanId(null);
        setScanDetailRecord(null);
        setDetailError(null);
        setEnabledPlugins({});
        setPluginInputs({});
      }
      setSelectedPluginId(pluginId);
    },
    enabledPlugins,
    setPluginEnabled,
    pluginInputs,
    setPluginField,
    pluginNameById,
    scanHistoryEntries,
    projectName,
    createScan,
    runScan,
    moveScan,
    archiveScan,
  };
}
