import { type ReactNode, useState } from "react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { useBackendClient } from "@/hooks/useBackendClient";
import { unwrap } from "@/lib/utils";
import { useSettings } from "@/core/settings/SettingsContext";
import { Sidebar } from "@/components/ui/Sidebar";
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
}

export function MainLayout({
  children,
  projectDir,
  selectedScanId,
  onGoBack,
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
          updateGlobalSettings({ theme: (payload.projectSettings?.theme ?? "system") as "light" | "dark" | "system" });
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
    <div className="h-screen flex flex-col bg-background">
      <header data-app-chrome className="shrink-0 border-b bg-background text-foreground">
        <div className="px-6 h-16 flex items-center justify-between">
          <button
            onClick={() => setExitOpen(true)}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
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

      <div className="flex flex-1 min-h-0">
        <Sidebar projectDir={projectDir} selectedScanId={selectedScanId} />
        <main className="flex-1 min-h-0 overflow-auto overscroll-none">{children}</main>
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
