import { type ReactNode, useState } from "react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { useBackendClient } from "@/hooks/useBackendClient";
import { unwrap } from "@/lib/utils";
import { useSettings } from "@/core/settings/SettingsContext";
import { Sidebar } from "@/components/ui/Sidebar";
import { OpenRiskLogo } from "@/components/ui/OpenRiskLogo";
import type { ThemeValue } from "@/core/settings/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface MainLayoutProps {
  children: ReactNode;
  projectDir?: string;
  selectedScanId?: string | null;
  onGoBack?: () => void;
  hasPlugins?: boolean;
}

export function MainLayout({
  children,
  projectDir,
  selectedScanId,
  onGoBack,
  hasPlugins = true,
}: MainLayoutProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const backendClient = useBackendClient();
  const { updateGlobalSettings } = useSettings();

  useEffect(() => {
    let cancelled = false;
    if (!projectDir) {
      return () => {
        cancelled = true;
      };
    }

    unwrap(backendClient.loadSettings())
      .then((payload) => {
        if (!cancelled) {
          const backendTheme = (payload.projectSettings?.theme ?? "system") as ThemeValue;
          updateGlobalSettings({ theme: backendTheme });
        }
      })
      .catch(() => {
        // Ignore theme sync failures to avoid blocking page rendering.
      });

    return () => {
      cancelled = true;
    };
  }, [projectDir, backendClient]); // intentionally omit globalSettings/updateGlobalSettings to avoid re-running on every theme change

  useEffect(() => {
    const handler = () => setSettingsOpen(true);
    window.addEventListener("openrisk:open-settings", handler);
    return () => {
      window.removeEventListener("openrisk:open-settings", handler);
    };
  }, []);

  return (
    <div className="flex h-dvh max-h-dvh flex-col overflow-hidden bg-background">
      <header data-app-chrome className="shrink-0 border-b bg-background text-foreground">
        <div className="px-6 h-16 flex items-center justify-between">
          <button
            onClick={() => setExitOpen(true)}
            className="flex items-center hover:opacity-80 transition-opacity"
          >
            <OpenRiskLogo
              size={28}
              textSizeClassName="text-lg"
              className="text-foreground"
            />
          </button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSettingsOpen(true)}
            className="h-10 w-10"
          >
            <Settings className="h-6 w-6" />
            <span className="sr-only">Settings</span>
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <Sidebar projectDir={projectDir} selectedScanId={selectedScanId} onQuitClick={() => setExitOpen(true)} hasPlugins={hasPlugins} />
        <main className="min-h-0 min-w-0 flex-1 overflow-hidden">{children}</main>
      </div>

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        projectDir={projectDir}
      />

      <Dialog open={exitOpen} onOpenChange={setExitOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader className="gap-4">
            <DialogTitle>Close current project?</DialogTitle>
            <DialogDescription>
              You will be taken back to the entry page and the current project will be closed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExitOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setExitOpen(false);
                onGoBack?.();
              }}
            >
              Close project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
