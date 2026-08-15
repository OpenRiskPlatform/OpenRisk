import {
  useCallback,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { save } from "@tauri-apps/plugin-dialog";
import {
  LogOut,
  PanelLeftOpen,
  Settings,
  ShieldAlert,
} from "lucide-react";
import type { OpenRiskClient } from "@/backend/OpenRiskClient";
import { errorMessage } from "@/backend/errors";
import type {
  PluginEntrypointSelection,
  PluginRecord,
  PdfExportSelection,
  ProjectSettingsPayload,
  ScanDetailRecord,
  ScanEntrypointInput,
  ScanSummaryRecord,
} from "@/core/backend/bindings";
import { Button } from "@/components/ui/button";
import { OpenRiskLogo } from "@/components/ui/OpenRiskLogo";
import { ScanResultView } from "@/results/ScanResultView";
import { applyTheme } from "@/app/theme";
import { SettingsDialog } from "@/settings/SettingsDialog";
import { displayName } from "@/shared/humanizeIdentifier";
import { InvestigationForm } from "./InvestigationForm";
import { InvestigationHistory } from "./InvestigationHistory";
import {
  createWorkspaceState,
  workspaceReducer,
} from "./workspaceState";

interface WorkspaceProps {
  client: OpenRiskClient;
  initialSettings: ProjectSettingsPayload;
  initialScans: ScanSummaryRecord[];
  onCloseProject: () => Promise<void>;
}

interface DraftSnapshot {
  preview: string;
  selectedPlugins: PluginEntrypointSelection[];
  inputs: ScanEntrypointInput[];
}

interface DraftSession {
  scanId: string | null;
  savedPreview: string | null;
  queue: Promise<void>;
  lastHash: string | null;
  lastResult: PersistedDraft | null;
  discarded: boolean;
}

interface PersistedDraft {
  summary: ScanSummaryRecord;
  detail: ScanDetailRecord;
}

interface PendingDraft {
  session: DraftSession;
  snapshot: DraftSnapshot;
}

function draftHash(snapshot: DraftSnapshot) {
  return JSON.stringify(snapshot);
}

function normalizedPreview(preview: string | null | undefined) {
  return preview?.trim() || "Untitled";
}

function pdfFileName(preview: string | null | undefined) {
  const safe = normalizedPreview(preview)
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
  return `${safe || "investigation"}-report.pdf`;
}

export function Workspace({
  client,
  initialSettings,
  initialScans,
  onCloseProject,
}: WorkspaceProps) {
  const [state, dispatch] = useReducer(
    workspaceReducer,
    createWorkspaceState(initialSettings, initialScans),
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [closing, setClosing] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const draftSession = useRef<DraftSession>({
    scanId: null,
    savedPreview: null,
    queue: Promise.resolve(),
    lastHash: null,
    lastResult: null,
    discarded: false,
  });
  const navigationRequest = useRef(0);
  const pendingDraft = useRef<PendingDraft | null>(null);
  const draftSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeDraftSaves = useRef<Set<Promise<PersistedDraft>>>(new Set());

  const pluginNameById = useMemo(
    () =>
      Object.fromEntries(
        state.settings.plugins.map((plugin) => [
          plugin.id,
          displayName(plugin.name, plugin.id),
        ]),
      ),
    [state.settings.plugins],
  );

  const entrypointNameByKey = useMemo(
    () =>
      Object.fromEntries(
        state.settings.plugins.flatMap((plugin) =>
          plugin.entrypoints.map((entrypoint) => [
            `${plugin.id}::${entrypoint.id}`,
            displayName(entrypoint.name, entrypoint.id),
          ]),
        ),
      ),
    [state.settings.plugins],
  );

  const inputNameByKey = useMemo(
    () =>
      Object.fromEntries(
        state.settings.plugins.flatMap((plugin) =>
          plugin.inputDefs.map((input) => [
            `${plugin.id}::${input.entrypointId}::${input.name}`,
            displayName(input.title, input.name),
          ]),
        ),
      ),
    [state.settings.plugins],
  );

  const enabledPlugins = state.settings.plugins.filter(
    (plugin) => plugin.enabled,
  );
  const formSession = draftSession.current;

  const persistDraft = useCallback(
    (
      session: DraftSession,
      snapshot: DraftSnapshot,
    ): Promise<PersistedDraft> => {
      const hash = draftHash(snapshot);
      const operation = session.queue
        .catch(() => undefined)
        .then(async () => {
          if (session.lastHash === hash && session.lastResult) {
            if (!session.discarded) {
              dispatch({
                type: "draft-saved",
                summary: session.lastResult.summary,
                detail: session.lastResult.detail,
                activate: draftSession.current === session,
              });
            }
            return session.lastResult;
          }

          const requestedPreview = normalizedPreview(snapshot.preview);
          let previewSummary: ScanSummaryRecord | null = null;

          if (!session.scanId) {
            const created = await client.createScan(
              snapshot.preview.trim() || null,
            );
            session.scanId = created.id;
            session.savedPreview = normalizedPreview(created.preview);
            previewSummary = created;
          }

          if (session.savedPreview !== requestedPreview) {
            previewSummary = await client.updateScanPreview(
              session.scanId,
              requestedPreview,
            );
            session.savedPreview = normalizedPreview(previewSummary.preview);
          }

          const draftSummary = await client.updateScanDraft(
            session.scanId,
            snapshot.selectedPlugins,
            snapshot.inputs,
          );
          const summary = previewSummary
            ? { ...draftSummary, preview: previewSummary.preview }
            : draftSummary;
          session.savedPreview = normalizedPreview(summary.preview);
          const detail: ScanDetailRecord = {
            id: summary.id,
            status: "Draft",
            preview: summary.preview,
            createdAt: summary.createdAt,
            selectedPlugins: snapshot.selectedPlugins,
            inputs: snapshot.inputs,
            results: [],
          };
          const result = { summary, detail };
          session.lastHash = hash;
          session.lastResult = result;

          if (!session.discarded) {
            dispatch({
              type: "draft-saved",
              summary,
              detail,
              activate: draftSession.current === session,
            });
          }
          return result;
        });

      let trackedOperation: Promise<PersistedDraft>;
      trackedOperation = operation.finally(() => {
        activeDraftSaves.current.delete(trackedOperation);
      });
      activeDraftSaves.current.add(trackedOperation);
      session.queue = trackedOperation.then(
        () => undefined,
        () => undefined,
      );
      return trackedOperation;
    },
    [client],
  );

  const saveDraftNow = useCallback(
    async (
      session: DraftSession,
      snapshot: DraftSnapshot,
    ) => {
      if (draftSession.current === session) {
        dispatch({ type: "draft-save-started" });
      }
      try {
        await persistDraft(session, snapshot);
      } catch (error) {
        if (draftSession.current === session) {
          dispatch({ type: "operation-failed", error: errorMessage(error) });
        }
      }
    },
    [persistDraft],
  );

  const scheduleDraftSave = useCallback(
    (
      preview: string,
      selectedPlugins: PluginEntrypointSelection[],
      inputs: ScanEntrypointInput[],
    ) => {
      if (draftSaveTimer.current) {
        clearTimeout(draftSaveTimer.current);
      }

      const pending = {
        session: formSession,
        snapshot: { preview, selectedPlugins, inputs },
      };
      pendingDraft.current = pending;
      draftSaveTimer.current = setTimeout(() => {
        draftSaveTimer.current = null;
        if (pendingDraft.current === pending) {
          pendingDraft.current = null;
        }
        void saveDraftNow(pending.session, pending.snapshot);
      }, 600);
    },
    [formSession, saveDraftNow],
  );

  const flushScheduledDraft = useCallback(() => {
    const pending = pendingDraft.current;
    if (!pending) {
      return;
    }
    pendingDraft.current = null;
    if (draftSaveTimer.current) {
      clearTimeout(draftSaveTimer.current);
      draftSaveTimer.current = null;
    }
    void saveDraftNow(pending.session, pending.snapshot);
  }, [saveDraftNow]);

  const flushCurrentDraft = useCallback(() => {
    flushScheduledDraft();
  }, [flushScheduledDraft]);

  const selectScan = async (scanId: string) => {
    if (closing) {
      return;
    }

    flushCurrentDraft();
    const request = ++navigationRequest.current;
    const session: DraftSession = {
      scanId: null,
      savedPreview: null,
      queue: Promise.resolve(),
      lastHash: null,
      lastResult: null,
      discarded: false,
    };
    draftSession.current = session;
    dispatch({ type: "scan-loading", scanId });

    try {
      const detail = await client.getScan(scanId);
      if (request !== navigationRequest.current) {
        return;
      }
      if (detail.status === "Draft") {
        session.scanId = detail.id;
        session.savedPreview = normalizedPreview(detail.preview);
      }
      dispatch({ type: "scan-loaded", detail });
    } catch (error) {
      if (request === navigationRequest.current) {
        dispatch({ type: "operation-failed", error: errorMessage(error) });
      }
    }
  };

  const runInvestigation = async (
    preview: string,
    selectedPlugins: PluginEntrypointSelection[],
    inputs: ScanEntrypointInput[],
  ) => {
    const session = draftSession.current;
    let launched = false;

    try {
      if (pendingDraft.current?.session === session) {
        if (draftSaveTimer.current) {
          clearTimeout(draftSaveTimer.current);
          draftSaveTimer.current = null;
        }
        pendingDraft.current = null;
      }
      dispatch({ type: "draft-save-started" });
      const saved = await persistDraft(session, {
        preview,
        selectedPlugins,
        inputs,
      });
      const runningSummary = { ...saved.summary, status: "Running" };
      const runningDetail = { ...saved.detail, status: "Running" };
      const activate = draftSession.current === session;

      dispatch({
        type: "run-started",
        summary: runningSummary,
        detail: runningDetail,
        activate,
      });
      launched = true;
      await client.runScan(saved.summary.id, selectedPlugins, inputs);

      const [detail, scans, settings] = await Promise.all([
        client.getScan(saved.summary.id),
        client.listScans(),
        client.loadSettings(),
      ]);

      dispatch({ type: "run-completed", detail, scans, settings });
    } catch (error) {
      if (launched && session.scanId) {
        const [detailResult, scansResult] = await Promise.allSettled([
          client.getScan(session.scanId),
          client.listScans(),
        ]);
        dispatch({
          type: "run-failed",
          scanId: session.scanId,
          detail:
            detailResult.status === "fulfilled" ? detailResult.value : null,
          scans:
            scansResult.status === "fulfilled" ? scansResult.value : state.scans,
          error: errorMessage(error),
        });
      } else if (draftSession.current === session) {
        dispatch({ type: "operation-failed", error: errorMessage(error) });
      }
    }
  };

  const newInvestigation = () => {
    flushCurrentDraft();
    ++navigationRequest.current;
    draftSession.current = {
      scanId: null,
      savedPreview: null,
      queue: Promise.resolve(),
      lastHash: null,
      lastResult: null,
      discarded: false,
    };
    dispatch({ type: "new-investigation-selected" });
  };

  const renameScan = async (scanId: string, preview: string) => {
    try {
      const summary = await client.updateScanPreview(scanId, preview);
      const session = draftSession.current;
      if (session.scanId === scanId) {
        session.savedPreview = normalizedPreview(summary.preview);
      }
      if (session.scanId === scanId && session.lastResult) {
        session.lastResult = {
          summary,
          detail: {
            ...session.lastResult.detail,
            preview: summary.preview,
          },
        };
      }
      dispatch({
        type: "scan-summary-updated",
        summary,
      });
    } catch (error) {
      dispatch({ type: "operation-failed", error: errorMessage(error) });
    }
  };

  const archiveScan = async (scanId: string, archived: boolean) => {
    const session = draftSession.current;
    const discardingDraft = archived && session.scanId === scanId;
    if (discardingDraft) {
      session.discarded = true;
    }
    try {
      dispatch({
        type: "scan-summary-updated",
        summary: await client.setScanArchived(scanId, archived),
      });
      if (archived && state.selectedScanId === scanId) {
        newInvestigation();
      }
    } catch (error) {
      if (discardingDraft && draftSession.current === session) {
        session.discarded = false;
      }
      dispatch({ type: "operation-failed", error: errorMessage(error) });
    }
  };

  const reorderScans = async (orderedScanIds: string[]) => {
    const previousScans = state.scans;
    const scansById = new Map(state.scans.map((scan) => [scan.id, scan]));
    const optimisticScans = orderedScanIds.flatMap((scanId, sortOrder) => {
      const scan = scansById.get(scanId);
      return scan ? [{ ...scan, sortOrder }] : [];
    });
    dispatch({ type: "scans-replaced", scans: optimisticScans });

    try {
      dispatch({
        type: "scans-replaced",
        scans: await client.reorderScans(orderedScanIds),
      });
    } catch (error) {
      dispatch({ type: "scans-replaced", scans: previousScans });
      dispatch({ type: "operation-failed", error: errorMessage(error) });
    }
  };

  const replacePlugin = (plugin: PluginRecord) => {
    const exists = state.settings.plugins.some((item) => item.id === plugin.id);
    const plugins = exists
      ? state.settings.plugins.map((item) =>
          item.id === plugin.id ? plugin : item,
        )
      : [plugin, ...state.settings.plugins];

    dispatch({
      type: "settings-replaced",
      settings: { ...state.settings, plugins },
    });
  };

  const replaceSettings = (settings: ProjectSettingsPayload) => {
    applyTheme(settings.projectSettings.theme);
    dispatch({ type: "settings-replaced", settings });
  };

  const exportSelectedScanPdf = async (
    selection: PdfExportSelection | null = null,
  ) => {
    const detail = state.detail;
    if (
      !detail ||
      exportingPdf ||
      !["Completed", "Failed"].includes(detail.status)
    ) {
      return;
    }

    const destination = await save({
      title: "Export investigation report",
      defaultPath: pdfFileName(detail.preview),
      filters: [{ name: "PDF document", extensions: ["pdf"] }],
    });
    if (typeof destination !== "string") {
      return;
    }

    setExportingPdf(true);
    try {
      await client.exportScanPdf(
        detail.id,
        destination,
        state.settings.projectSettings.advancedMode ? "advanced" : "standard",
        selection,
      );
    } catch (error) {
      dispatch({ type: "operation-failed", error: errorMessage(error) });
    } finally {
      setExportingPdf(false);
    }
  };

  const closeProject = async () => {
    if (
      closing ||
      state.runningScanIds.length > 0 ||
      state.draftSaveStatus === "saving"
    ) {
      return;
    }
    setClosing(true);
    try {
      if (pendingDraft.current) {
        const pending = pendingDraft.current;
        pendingDraft.current = null;
        if (draftSaveTimer.current) {
          clearTimeout(draftSaveTimer.current);
          draftSaveTimer.current = null;
        }
        await persistDraft(pending.session, pending.snapshot);
      }
      await Promise.all([...activeDraftSaves.current]);
      await onCloseProject();
    } catch (error) {
      dispatch({ type: "operation-failed", error: errorMessage(error) });
      setClosing(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-muted/20">
      <header className="flex h-16 shrink-0 items-center gap-4 border-b bg-background px-5">
        {!historyOpen ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title="Show history"
            onClick={() => setHistoryOpen(true)}
          >
            <PanelLeftOpen className="h-4 w-4" />
          </Button>
        ) : null}
        <OpenRiskLogo
          size={30}
          textSizeClassName="text-lg"
          className="text-foreground"
        />
        <div className="h-6 w-px bg-border" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            {state.settings.project.name}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {state.settings.project.directory}
          </p>
        </div>

        {state.settings.project.is_preview ? (
          <div className="flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
            <ShieldAlert className="h-3.5 w-3.5" />
            Read-only preview
          </div>
        ) : null}

        <Button
          variant="outline"
          className="gap-2"
          disabled={closing}
          onClick={() => setSettingsOpen(true)}
        >
          <Settings className="h-4 w-4" />
          Settings
        </Button>
        <Button
          variant="ghost"
          size="icon"
          title="Close project"
          disabled={
            closing ||
            state.runningScanIds.length > 0 ||
            state.draftSaveStatus === "saving"
          }
          onClick={() => void closeProject()}
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </header>

      <div className="flex min-h-0 flex-1">
        {historyOpen ? (
          <InvestigationHistory
            scans={state.scans}
            selectedScanId={state.selectedScanId}
            disabled={closing}
            onNew={newInvestigation}
            onSelect={(scanId) => void selectScan(scanId)}
            onCollapse={() => setHistoryOpen(false)}
            onRename={renameScan}
            onArchive={archiveScan}
            onReorder={reorderScans}
          />
        ) : null}

        <main className="min-w-0 flex-1 overscroll-contain overflow-y-auto px-6 py-8 lg:px-10">
          {state.loadingScanId ? (
            <p className="py-16 text-center text-sm text-muted-foreground">
              Loading investigation…
            </p>
          ) : state.view === "form" ? (
            <InvestigationForm
              key={state.formGeneration}
              plugins={enabledPlugins}
              draft={state.detail?.status === "Draft" ? state.detail : null}
              saveStatus={state.draftSaveStatus}
              running={false}
              error={state.error}
              onDraftChange={scheduleDraftSave}
              onRun={runInvestigation}
            />
          ) : state.detail ? (
            <div className="space-y-4">
              {state.error ? (
                <div role="alert" className="mx-auto max-w-5xl rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  {state.error}
                </div>
              ) : null}
              <ScanResultView
                key={state.detail.id}
                detail={state.detail}
                pluginNameById={pluginNameById}
                entrypointNameByKey={entrypointNameByKey}
                inputNameByKey={inputNameByKey}
                advancedMode={state.settings.projectSettings.advancedMode}
                exportingPdf={exportingPdf}
                onExportPdf={
                  ["Completed", "Failed"].includes(state.detail.status)
                    ? (selection) => void exportSelectedScanPdf(selection)
                    : undefined
                }
              />
            </div>
          ) : state.error ? (
            <div role="alert" className="mx-auto max-w-3xl rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              {state.error}
            </div>
          ) : null}
        </main>
      </div>

      <SettingsDialog
        open={settingsOpen}
        client={client}
        settings={state.settings}
        onOpenChange={setSettingsOpen}
        onPluginUpdated={replacePlugin}
        onSettingsReloaded={replaceSettings}
      />
    </div>
  );
}
