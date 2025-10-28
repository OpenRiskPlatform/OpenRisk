/**
 * Entry Page - Landing/Home screen
 */

import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { Link } from "@tanstack/react-router";

export function EntryPage() {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800">
      {/* Header with Settings */}
      <header className="absolute top-0 right-0 p-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSettingsOpen(true)}
          className="rounded-full"
        >
          <Settings className="h-5 w-5" />
          <span className="sr-only">Settings</span>
        </Button>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4">
        <div className="text-center space-y-8 max-w-2xl">
          {/* Logo/Icon placeholder */}
          <div className="flex justify-center">
            <div className="w-32 h-32 rounded-2xl bg-primary/10 flex items-center justify-center">
              <svg
                className="w-20 h-20 text-primary"
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
          </div>

          {/* Title & Description */}
          <div className="space-y-3">
            <h1 className="text-5xl font-bold text-slate-900 dark:text-slate-50">
              OpenRisk
            </h1>
            <p className="text-xl text-slate-600 dark:text-slate-400">
              Modular Risk Analysis Platform
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-500 max-w-md mx-auto">
              Analyze risk profiles using extensible plugins. Configure your
              workspace and start assessing entities.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 justify-center">
            <Button asChild size="lg" className="text-base px-8">
              <Link to="/report">Start Analysis</Link>
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="text-base px-8"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings className="mr-2 h-4 w-4" />
              Configure
            </Button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="p-6 text-center text-sm text-slate-500 dark:text-slate-600">
        OpenRisk Platform v0.1.0 • Built with React & TypeScript
      </footer>

      {/* Settings Dialog */}
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}
