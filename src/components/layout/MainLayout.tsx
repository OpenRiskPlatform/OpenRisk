/**
 * Main Layout - Page wrapper with header
 */

import { type ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { useNavigate } from "@tanstack/react-router";
import { Sidebar } from "@/components/ui/Sidebar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";


interface MainLayoutProps {
  children: ReactNode;
  projectDir?: string;
}

export function MainLayout({ children, projectDir }: MainLayoutProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="shrink-0 border-b bg-background text-foreground">
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

      {/* Sidebar + Main Content */}
      <div className="flex flex-1 min-h-0">
        <Sidebar />
        <main className="flex-1 overflow-auto min-h-0 overscroll-none">
          {children}
        </main>
      </div>

      {/* Settings Dialog */}
      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        projectDir={projectDir}
      />

      {/* Exit project confirmation */}
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
              onClick={() => { setExitOpen(false); navigate({ to: "/" }); }}
            >
              Close project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}