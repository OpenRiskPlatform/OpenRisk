/**
 * Entry Page - Landing/Home screen
 */

import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormEvent, useState } from "react";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { useNavigate } from "@tanstack/react-router";
import { open } from "@tauri-apps/plugin-dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useBackendClient } from "@/hooks/useBackendClient";

const RECENT_PROJECT_DIR = "/home/ms/Downloads/test/";

export async function EntryPage() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectDir, setProjectDir] = useState("");
  const [openProjectDir, setOpenProjectDir] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isOpeningProject, setIsOpeningProject] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);
  const navigate = useNavigate();
  const backendClient = useBackendClient();

  console.log("Installed plugins: " + await backendClient.listPlugins());

  const handlePickDirectory = async () => {
    try {
      const selection = await open({
        directory: true,
        multiple: false,
      });
      if (typeof selection === "string") {
        setProjectDir(selection);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to open directory picker";
      setError(message);
    }
  };

  const handleUseRecentProject = () => {
    setProjectDir(RECENT_PROJECT_DIR);
  };

  const handlePickExistingProject = async () => {
    setOpenError(null);
    try {
      const selection = await open({
        directory: true,
        multiple: false,
      });
      if (typeof selection === "string") {
        setOpenProjectDir(selection);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to open directory picker";
      setOpenError(message);
    }
  };

  const handleCreateProject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!projectName.trim()) {
      setError("Project name is required");
      return;
    }
    if (!projectDir) {
      setError("Please select a directory for the project");
      return;
    }

    setIsCreating(true);
    try {
      const project = await backendClient.createProject(
        projectName.trim(),
        projectDir
      );
      await navigate({ to: "/project", search: { dir: project } });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleOpenProject = async () => {
    setOpenError(null);
    if (!openProjectDir) {
      setOpenError("Select a project directory to open");
      return;
    }

    setIsOpeningProject(true);
    try {
      const project = await backendClient.openProject(openProjectDir);
      await navigate({ to: "/project", search: { dir: project.directory } });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setOpenError(message);
    } finally {
      setIsOpeningProject(false);
    }
  };

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

          {/* Project creation form */}
          <div className="max-w-xl mx-auto w-full">
            <form
              onSubmit={handleCreateProject}
              className="bg-white dark:bg-slate-900/70 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-800 p-6 space-y-5"
            >
              <div className="space-y-2 text-left">
                <Label htmlFor="projectName" className="text-slate-700 dark:text-slate-200">
                  Project Name
                </Label>
                <Input
                  id="projectName"
                  value={projectName}
                  onChange={(event) => setProjectName(event.target.value)}
                  placeholder="ACME Risk Assessment"
                />
              </div>

              <div className="space-y-2 text-left">
                <Label htmlFor="projectDirectory" className="text-slate-700 dark:text-slate-200">
                  Project Directory
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="projectDirectory"
                    value={projectDir}
                    placeholder="Select or create a folder"
                    readOnly
                  />
                  <Button type="button" variant="outline" onClick={handlePickDirectory}>
                    Browse
                  </Button>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Recently used:{" "}
                  <button
                    type="button"
                    onClick={handleUseRecentProject}
                    className="underline-offset-2 hover:underline font-medium"
                  >
                    {RECENT_PROJECT_DIR}
                  </button>
                </p>
              </div>

              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

              <Button type="submit" size="lg" className="w-full" disabled={isCreating}>
                {isCreating ? "Creating Project..." : "Create Project"}
              </Button>
            </form>
          </div>

          <Button
            variant="ghost"
            size="lg"
            className="text-base"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings className="mr-2 h-4 w-4" />
            Configure platform settings
          </Button>

          <Card className="max-w-xl mx-auto w-full text-left">
            <CardHeader>
              <CardTitle>Open Existing Project</CardTitle>
              <CardDescription>
                Select a project directory that already contains a project database.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="openProjectDirectory">Project Directory</Label>
                <div className="flex gap-2">
                  <Input
                    id="openProjectDirectory"
                    value={openProjectDir}
                    placeholder="Select a project folder"
                    readOnly
                  />
                  <Button type="button" variant="outline" onClick={handlePickExistingProject}>
                    Browse
                  </Button>
                </div>
              </div>

              {openError && (
                <p className="text-sm text-red-600 dark:text-red-400">{openError}</p>
              )}

              <Button
                type="button"
                className="w-full"
                onClick={handleOpenProject}
                disabled={isOpeningProject}
              >
                {isOpeningProject ? "Opening Project..." : "Open Project"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="p-6 text-center text-sm text-slate-500 dark:text-slate-600">
        OpenRisk Platform v0.1.0 • Built with React & TypeScript
      </footer>

      {/* Settings Dialog */}
      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        projectDir={openProjectDir || projectDir || undefined}
      />
    </div>
  );
}
