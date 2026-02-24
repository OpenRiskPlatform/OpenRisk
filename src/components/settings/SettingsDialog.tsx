/**
 * Settings Dialog - Main settings modal (Obsidian-style)
 */

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useEffect, useState } from "react";
import { SettingsSidebar } from "./SettingsSidebar";
import { GeneralSettings } from "./GeneralSettings";
import { PluginSettings } from "./PluginSettings";
import { useBackendClient } from "@/hooks/useBackendClient";
import type { ProjectSettingsPayload } from "@/core/backend/types";

export type SettingsCategory = "general" | "plugins" | "appearance";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectDir?: string;
}

export function SettingsDialog({ open, onOpenChange, projectDir }: SettingsDialogProps) {
  const [activeCategory, setActiveCategory] =
    useState<SettingsCategory>("general");
  const backendClient = useBackendClient();
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

    backendClient
      .loadSettings(projectDir)
      .then((payload) => {
        if (!cancelled) {
          setSettingsData(payload);
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
  }, [open, projectDir, backendClient]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[80vh] p-0">
        <div className="flex h-full min-h-0">
          {/* Sidebar */}
          <SettingsSidebar
            activeCategory={activeCategory}
            onCategoryChange={setActiveCategory}
          />

          {/* Content Area */}
          <div className="flex-1 flex flex-col min-h-0 p-6">
            {activeCategory === "general" && <GeneralSettings />}
            {activeCategory === "plugins" && (
              <PluginSettings
                projectDir={projectDir}
                projectSettings={settingsData?.project_settings ?? null}
                plugins={settingsData?.plugins ?? []}
                loading={settingsLoading}
                error={
                  projectDir
                    ? settingsError
                    : "Open or create a project to view plugin settings."
                }
              />
            )}
            {activeCategory === "appearance" && (
              <div>
                <h2 className="text-2xl font-semibold mb-4">Appearance</h2>
                <p className="text-muted-foreground">
                  Appearance settings coming soon...
                </p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
