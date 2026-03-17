/**
 * Main Layout - Page wrapper with header
 */

import { type ReactNode, useState } from "react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Settings } from "lucide-react";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { useLocation, useNavigate } from "@tanstack/react-router";
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
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;
    if (!projectDir) {
      return () => {
        cancelled = true;
      };
    }

    backendClient
      .loadSettings(projectDir)
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

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b bg-card/90 backdrop-blur">
        <div className="container mx-auto px-4 h-16 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
          <div className="flex items-center gap-3 justify-self-start">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <svg
                className="w-5 h-5 text-primary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
            </div>
            <span className="font-semibold text-lg">OpenRisk</span>
          </div>

          <div className="flex items-center gap-2 justify-self-center">
            <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
              <ChevronLeft className="h-4 w-4" />
              <span className="sr-only">Back</span>
            </Button>
            <Button variant="ghost" size="icon" onClick={() => window.history.forward()}>
              <ChevronRight className="h-4 w-4" />
              <span className="sr-only">Forward</span>
            </Button>

            {projectDir ? (
              <>
                <Button
                  variant={location.pathname === "/project" ? "default" : "outline"}
                  size="sm"
                  onClick={() => navigate({ to: "/project", search: { dir: projectDir } })}
                >
                  Project
                </Button>
              </>
            ) : null}
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSettingsOpen(true)}
            className="justify-self-end"
          >
            <Settings className="h-5 w-5" />
            <span className="sr-only">Settings</span>
          </Button>
        </div>
      </header>

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
