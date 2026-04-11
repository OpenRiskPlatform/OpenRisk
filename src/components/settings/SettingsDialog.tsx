/**
 * Settings Dialog - Main settings modal (Obsidian-style)
 */

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useEffect, useState } from "react";
import { SettingsSidebar } from "./SettingsSidebar";
import { GeneralSettings } from "./GeneralSettings";
import { PluginSettings } from "./PluginSettings";
import { ManagePlugins } from "./ManagePlugins";
import { InfoSettings } from "./InfoSettings";
import { useBackendClient } from "@/hooks/useBackendClient";
import { unwrap } from "@/lib/utils";
import type { ProjectSettingsPayload } from "@/core/backend/bindings";
import { useSettings } from "@/core/settings/SettingsContext";

export type SettingsCategory = "info" | "general" | "plugins" | "manage-plugins";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectDir?: string;
}

export function SettingsDialog({ open, onOpenChange, projectDir }: SettingsDialogProps) {
  const [activeCategory, setActiveCategory] =
    useState<SettingsCategory>("info");
  const backendClient = useBackendClient();
  const { updateGlobalSettings } = useSettings();
  const [settingsData, setSettingsData] = useState<ProjectSettingsPayload | null>(
    null
  );
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);

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
          updateGlobalSettings({ theme: (payload.projectSettings?.theme ?? "system") as "light" | "dark" | "system" });
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
  }, [open, projectDir, backendClient, updateGlobalSettings]);

  const handleProjectSettingsUpdated = (
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
  };

  const handleProjectNameUpdated = (name: string) => {
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
  };

  const handlePluginUpdated = (plugin: ProjectSettingsPayload["plugins"][number]) => {
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
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[80vh] p-0 select-text">
        <div className="flex h-full min-h-0">
          {/* Sidebar */}
          <SettingsSidebar
            activeCategory={activeCategory}
            onCategoryChange={setActiveCategory}
          />

          {/* Content Area */}
          <div className="flex-1 flex flex-col min-h-0 p-6">
            {activeCategory === "info" && (
              <InfoSettings
                projectDir={projectDir}
                project={settingsData?.project ?? null}
              />
            )}
            {activeCategory === "general" && (
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
            {activeCategory === "plugins" && (
              <PluginSettings
                projectDir={projectDir}
                projectSettings={settingsData?.projectSettings ?? null}
                plugins={settingsData?.plugins ?? []}
                loading={settingsLoading}
                error={
                  projectDir
                    ? settingsError
                    : "Open or create a project to view plugin settings."
                }
                onPluginUpdated={handlePluginUpdated}
              />
            )}
            {activeCategory === "manage-plugins" && (
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
