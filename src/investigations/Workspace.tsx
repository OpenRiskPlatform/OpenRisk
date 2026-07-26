import { useMemo, useReducer, useState } from "react";
import { LogOut, Settings, ShieldAlert } from "lucide-react";
import type { OpenRiskClient } from "@/backend/OpenRiskClient";
import { errorMessage } from "@/backend/errors";
import type {
  PluginEntrypointSelection,
  PluginRecord,
  ProjectSettingsPayload,
  ScanEntrypointInput,
  ScanSummaryRecord,
} from "@/core/backend/bindings";
import { Button } from "@/components/ui/button";
import { OpenRiskLogo } from "@/components/ui/OpenRiskLogo";
import { ScanResultView } from "@/results/ScanResultView";
import { applyTheme } from "@/app/theme";
import { SettingsDialog } from "@/settings/SettingsDialog";
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
  const [closing, setClosing] = useState(false);

  const pluginNameById = useMemo(
    () =>
      Object.fromEntries(
        state.settings.plugins.map((plugin) => [plugin.id, plugin.name]),
      ),
    [state.settings.plugins],
  );

  const entrypointNameByKey = useMemo(
    () =>
      Object.fromEntries(
        state.settings.plugins.flatMap((plugin) =>
          plugin.entrypoints.map((entrypoint) => [
            `${plugin.id}::${entrypoint.id}`,
            entrypoint.name,
          ]),
        ),
      ),
    [state.settings.plugins],
  );

  const enabledPlugins = state.settings.plugins.filter(
    (plugin) => plugin.enabled,
  );
  const busy = state.pending !== "idle" || closing;

  const selectScan = async (scanId: string) => {
    if (busy) {
      return;
    }
    dispatch({ type: "result-loading", scanId });
    try {
      dispatch({ type: "result-loaded", detail: await client.getScan(scanId) });
    } catch (error) {
      dispatch({ type: "operation-failed", error: errorMessage(error) });
    }
  };

  const runInvestigation = async (
    selectedPlugins: PluginEntrypointSelection[],
    inputs: ScanEntrypointInput[],
    preview: string,
  ) => {
    if (busy) {
      return;
    }

    dispatch({ type: "run-started" });
    let scanId: string | null = null;

    try {
      const created = await client.createScan(preview);
      scanId = created.id;
      await client.runScan(created.id, selectedPlugins, inputs);

      const [detail, scans, settings] = await Promise.all([
        client.getScan(created.id),
        client.listScans(),
        client.loadSettings(),
      ]);

      dispatch({ type: "run-completed", detail, scans, settings });
    } catch (error) {
      if (scanId) {
        const [detailResult, scansResult] = await Promise.allSettled([
          client.getScan(scanId),
          client.listScans(),
        ]);
        if (detailResult.status === "fulfilled") {
          dispatch({ type: "result-loaded", detail: detailResult.value });
        }
        if (scansResult.status === "fulfilled") {
          dispatch({ type: "scans-replaced", scans: scansResult.value });
        }
      }
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

  const closeProject = async () => {
    if (busy) {
      return;
    }
    setClosing(true);
    try {
      await onCloseProject();
    } catch (error) {
      dispatch({ type: "operation-failed", error: errorMessage(error) });
      setClosing(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-muted/20">
      <header className="flex h-16 shrink-0 items-center gap-4 border-b bg-background px-5">
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
          disabled={busy}
          onClick={() => setSettingsOpen(true)}
        >
          <Settings className="h-4 w-4" />
          Settings
        </Button>
        <Button
          variant="ghost"
          size="icon"
          title="Close project"
          disabled={busy}
          onClick={() => void closeProject()}
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </header>

      <div className="flex min-h-0 flex-1">
        <InvestigationHistory
          scans={state.scans}
          selectedScanId={state.selectedScanId}
          disabled={busy}
          onNew={() => dispatch({ type: "new-investigation-selected" })}
          onSelect={(scanId) => void selectScan(scanId)}
        />

        <main className="min-w-0 flex-1 overscroll-contain overflow-y-auto px-6 py-8 lg:px-10">
          {state.pending === "loading-result" ? (
            <p className="py-16 text-center text-sm text-muted-foreground">
              Loading investigation…
            </p>
          ) : state.view === "new" ? (
            <InvestigationForm
              plugins={enabledPlugins}
              running={state.pending === "running"}
              error={state.error}
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
                detail={state.detail}
                pluginNameById={pluginNameById}
                entrypointNameByKey={entrypointNameByKey}
                advancedMode={state.settings.projectSettings.advancedMode}
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
