/**
 * General Settings Panel
 */

import { useState } from "react";
import type { ProjectSettingsRecord } from "@/core/backend/types";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBackendClient } from "@/hooks/useBackendClient";
import { useSettings } from "@/core/settings/SettingsContext";

interface GeneralSettingsProps {
  projectDir?: string;
  projectSettings: ProjectSettingsRecord | null;
  loading: boolean;
  error?: string | null;
  onProjectSettingsUpdated: (settings: ProjectSettingsRecord) => void;
}

export function GeneralSettings({
  projectDir,
  projectSettings,
  loading,
  error,
  onProjectSettingsUpdated,
}: GeneralSettingsProps) {
  const backendClient = useBackendClient();
  const { updateGlobalSettings } = useSettings();
  const [savingTheme, setSavingTheme] = useState(false);

  const theme = projectSettings?.theme ?? "system";

  const handleThemeChange = async (value: "light" | "dark" | "system") => {
    if (!projectDir) {
      return;
    }

    setSavingTheme(true);
    try {
      const updated = await backendClient.updateProjectSettings(projectDir, {
        theme: value,
      });
      onProjectSettingsUpdated(updated);
      await updateGlobalSettings({ theme: updated.theme });
    } finally {
      setSavingTheme(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-1">General Settings</h2>
        <p className="text-sm text-muted-foreground">
          Manage project-level preferences
        </p>
      </div>

      {!projectDir && (
        <p className="text-sm text-muted-foreground">
          Open or create a project to edit settings.
        </p>
      )}

      {projectDir && loading && (
        <p className="text-sm text-muted-foreground">Loading project settings…</p>
      )}

      {projectDir && !loading && error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      {projectDir && !loading && !error && projectSettings && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Theme</Label>
              <p className="text-sm text-muted-foreground">
                Stored in project settings and applied immediately.
              </p>
            </div>
            <Select
              value={theme}
              onValueChange={handleThemeChange}
              disabled={savingTheme}
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <p className="text-xs text-muted-foreground">
            Locale: {projectSettings.locale} • Settings ID: {projectSettings.id}
          </p>
        </div>
      )}
    </div>
  );
}
