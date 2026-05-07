import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MainLayout } from "@/components/layout/MainLayout";
import { ProjectScanPanel } from "@/components/project/ProjectScanPanel";
import { useBackendClient } from "@/hooks/useBackendClient";
import { useProjectWorkspace, type DraftScanPayload } from "@/hooks/useProjectWorkspace";
import { unwrap } from "@/lib/utils";

const DRAFT_STORAGE_KEY = "openrisk:scan-draft";

interface SearchPageProps {
  projectDir?: string;
  routeScanId?: string;
}

export function SearchPage({ projectDir, routeScanId }: SearchPageProps) {
  const navigate = useNavigate();
  const backendClient = useBackendClient();
  const draftAppliedRef = useRef(false);

  const workspace = useProjectWorkspace(projectDir, routeScanId);

  useEffect(() => {
    if (!projectDir || !workspace.projectSessionReady || draftAppliedRef.current) {
      return;
    }

    const stored = sessionStorage.getItem(DRAFT_STORAGE_KEY);
    if (!stored) {
      return;
    }

    try {
      const draft = JSON.parse(stored) as DraftScanPayload;
      if (draft.projectDir !== projectDir) {
        return;
      }
      workspace.applyDraftFromScan(draft);
      sessionStorage.removeItem(DRAFT_STORAGE_KEY);
      draftAppliedRef.current = true;
    } catch {
      sessionStorage.removeItem(DRAFT_STORAGE_KEY);
    }
  }, [projectDir, workspace.applyDraftFromScan, workspace.projectSessionReady]);

  const goBack = async () => {
    try {
      await unwrap(backendClient.closeProject());
    } catch {
      // Ignore close errors; the entry page can reopen the project.
    }
    await navigate({ to: "/", search: { mode: undefined } });
  };

  return (
    <MainLayout
      projectDir={projectDir}
      selectedScanId={workspace.selectedScanId}
      onGoBack={() => void goBack()}
      hasPlugins={workspace.settingsData === null ? true : workspace.settingsData.plugins.length > 0}
    >
      <div className="flex h-full w-full min-h-0 min-w-0 overflow-hidden bg-muted/[0.18] select-none">
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
                selectedScan={workspace.selectedScan}
                scanDetail={workspace.scanDetail}
                settingsData={workspace.settingsData}
                settingsError={workspace.settingsError}
                detailError={workspace.detailError}
                pluginNameById={workspace.pluginNameById}
                selectedPluginId={workspace.selectedPluginId}
                enabledPlugins={workspace.enabledPlugins}
                pluginInputs={workspace.pluginInputs}
                running={workspace.running}
                creatingScan={workspace.creatingScan}
                onSelectPlugin={(pluginId) => workspace.setSelectedPluginId(pluginId)}
                onSetPluginEnabled={workspace.setPluginEnabled}
                onSetPluginField={workspace.setPluginField}
                onRunScan={() => void workspace.runScan()}
                onCreateScan={() => void workspace.createScan()}
              />
            </div>
          </>
        )}
      </div>
    </MainLayout>
  );
}
