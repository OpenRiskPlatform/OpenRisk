/**
 * Main Layout - Page wrapper with header
 */

import { type ReactNode, useState } from "react";
import { useEffect } from "react";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { useBackendClient } from "@/hooks/useBackendClient";
import { useSettings } from "@/core/settings/SettingsContext";

interface MainLayoutProps {
  children: ReactNode;
  projectDir?: string;
}

export function MainLayout({ children, projectDir }: MainLayoutProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const backendClient = useBackendClient();
  const { updateGlobalSettings } = useSettings();

  useEffect(() => {
    let cancelled = false;
    if (!projectDir) {
      return () => {
        cancelled = true;
      };
    }

    backendClient
      .loadSettings()
      .then((payload) => {
        if (!cancelled) {
          updateGlobalSettings({ theme: payload.projectSettings?.theme ?? "system" });
        }
      })
      .catch(() => {
        // Ignore theme sync failures to avoid blocking page rendering.
      });

    return () => {
      cancelled = true;
    };
  }, [projectDir, backendClient, updateGlobalSettings]);

  useEffect(() => {
    const handler = () => setSettingsOpen(true);
    window.addEventListener("openrisk:open-settings", handler);
    return () => {
      window.removeEventListener("openrisk:open-settings", handler);
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Main Content */}
      <main className="flex-1">{children}</main>

      {/* Settings Dialog */}
      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        projectDir={projectDir}
      />
    </div>
  );
}
