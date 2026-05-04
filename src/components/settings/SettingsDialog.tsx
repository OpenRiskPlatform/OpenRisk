/**
 * Settings Dialog - Main settings modal (Obsidian-style)
 */

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useCallback, useEffect, useState } from "react";
import { SettingsSidebar } from "./SettingsSidebar";
import { GeneralSettings } from "./GeneralSettings";
import { PluginSettings } from "./PluginSettings";
import { ManagePlugins } from "./ManagePlugins";
import { InfoSettings } from "./InfoSettings";
import { useBackendClient } from "@/hooks/useBackendClient";
import { unwrap } from "@/lib/utils";
import type { ProjectSettingsPayload } from "@/core/backend/bindings";
import type { ThemeValue } from "@/core/settings/types";
import { useSettings } from "@/core/settings/SettingsContext";
import { save } from "@tauri-apps/plugin-dialog";

export type SettingsCategory = "info" | "general" | "plugins" | "manage-plugins";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectDir?: string;
}

export function SettingsDialog({ open, onOpenChange, projectDir }: SettingsDialogProps) {
  const [activeCategory, setActiveCategory] =
    useState<SettingsCategory>("info");
  const [metricsRefreshToken, setMetricsRefreshToken] = useState(0);
  const backendClient = useBackendClient();
  const { updateGlobalSettings, globalSettings } = useSettings();
  const [settingsData, setSettingsData] = useState<ProjectSettingsPayload | null>(
    null
  );
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [exportingPreview, setExportingPreview] = useState(false);
  const [exportPreviewError, setExportPreviewError] = useState<string | null>(null);

  const isPreview = settingsData?.project?.is_preview ?? false;

  // In preview mode, only the Info tab is accessible.
  useEffect(() => {
    if (isPreview) setActiveCategory("info");
  }, [isPreview]);

  useEffect(() => {
    if (open) {
      setMetricsRefreshToken((prev) => prev + 1);
    }
  }, [open]);

  useEffect(() => {
    let cancelled = false;
    if (!open || !projectDir) {
      setSettingsLoading(false);
      setSettingsError(null);
      if (!projectDir) {
        setSettingsData(null);
      }
      return () => {
        cancelled = true;
      };
    }

    setSettingsLoading(true);
    setSettingsError(null);

    unwrap(backendClient.loadSettings())
      .then((payload) => {
        if (!cancelled) {
          setSettingsData(payload);
          // Sync theme and settings from backend.
          updateGlobalSettings({
            advancedMode: payload.projectSettings?.advancedMode ?? false,
            theme: (payload.projectSettings?.theme ?? "system") as ThemeValue,
          });
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setSettingsError(err instanceof Error ? err.message : String(err));
          setSettingsData(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setSettingsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, projectDir, backendClient, updateGlobalSettings, globalSettings.theme]);

  const handleProjectSettingsUpdated = useCallback((
    settings: ProjectSettingsPayload["projectSettings"]
  ) => {
    setSettingsData((prev) => {
      if (!prev) {
        return prev;
      }
      return {
        ...prev,
        projectSettings: settings,
      };
    });
  }, []);

  const handleProjectNameUpdated = useCallback((name: string) => {
    setSettingsData((prev) => {
      if (!prev) {
        return prev;
      }
      return {
        ...prev,
        project: {
          ...prev.project,
          name,
        },
      };
    });
  }, []);

  const handlePluginUpdated = useCallback((plugin: ProjectSettingsPayload["plugins"][number]) => {
    setSettingsData((prev) => {
      if (!prev) {
        return prev;
      }

      const exists = prev.plugins.some((item) => item.id === plugin.id);

      return {
        ...prev,
        plugins: exists
          ? prev.plugins.map((item) => (item.id === plugin.id ? plugin : item))
          : [plugin, ...prev.plugins],
      };
    });

    window.dispatchEvent(
      new CustomEvent("openrisk:plugins-updated", {
        detail: { pluginId: plugin.id },
      })
    );
  }, []);

  const handleExportAsPreview = useCallback(async () => {
    setExportPreviewError(null);
    const destPath = await save({
      title: "Save Preview Project",
      defaultPath: "preview.orproj",
      filters: [{ name: "OpenRisk Project", extensions: ["orproj"] }],
    });
    if (!destPath) return;
    setExportingPreview(true);
    try {
      await unwrap(backendClient.createPreviewProject(destPath));
    } catch (err) {
      setExportPreviewError(err instanceof Error ? err.message : String(err));
    } finally {
      setExportingPreview(false);
    }
  }, [backendClient]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[80vh] p-0 select-text">
        <div className="flex h-full min-h-0">
          {/* Sidebar */}
          <SettingsSidebar
            activeCategory={activeCategory}
            onCategoryChange={setActiveCategory}
            isPreview={isPreview}
          />

          {/* Content Area */}
          <div className="flex-1 flex flex-col min-h-0 p-6">
            {isPreview && (
              <div className="mb-4 rounded-md border border-yellow-400 bg-yellow-50 dark:bg-yellow-950/30 px-4 py-2 text-sm text-yellow-800 dark:text-yellow-300">
                This is a <strong>read-only preview</strong> project. Settings and credentials cannot be viewed or modified.
              </div>
            )}
            {activeCategory === "info" && (
              <InfoSettings
                projectDir={projectDir}
                project={settingsData?.project ?? null}
                isPreview={isPreview}
                exportingPreview={exportingPreview}
                exportPreviewError={exportPreviewError}
                onExportAsPreview={handleExportAsPreview}
              />
            )}
            {!isPreview && activeCategory === "general" && (
              <GeneralSettings
                projectDir={projectDir}
                projectName={settingsData?.project?.name ?? ""}
                projectSettings={settingsData?.projectSettings ?? null}
                loading={settingsLoading}
                error={
                  projectDir
                    ? settingsError
                    : "Open or create a project to edit settings."
                }
                onProjectSettingsUpdated={handleProjectSettingsUpdated}
                onProjectNameUpdated={handleProjectNameUpdated}
              />
            )}
            {!isPreview && activeCategory === "plugins" && (
              <PluginSettings
                projectDir={projectDir}
                projectSettings={settingsData?.projectSettings ?? null}
                plugins={settingsData?.plugins ?? []}
                metricsRefreshToken={metricsRefreshToken}
                loading={settingsLoading}
                error={
                  projectDir
                    ? settingsError
                    : "Open or create a project to view plugin settings."
                }
                onPluginUpdated={handlePluginUpdated}
              />
            )}
            {!isPreview && activeCategory === "manage-plugins" && (
              <ManagePlugins
                projectDir={projectDir}
                plugins={settingsData?.plugins ?? []}
                loading={settingsLoading}
                error={
                  projectDir
                    ? settingsError
                    : "Open or create a project to manage plugins."
                }
                onPluginUpdated={handlePluginUpdated}
              />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
