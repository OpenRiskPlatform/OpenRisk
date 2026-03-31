/**
 * Entry Page - Landing/Home screen
 */

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormEvent, useState } from "react";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { useNavigate } from "@tanstack/react-router";
import { open } from "@tauri-apps/plugin-dialog";
import { useBackendClient } from "@/hooks/useBackendClient";
import { Settings } from "lucide-react";


export function EntryPage() {
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
      await navigate({ to: "/project", search: { dir: project.directory } });
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
    <div className="h-full overflow-y-auto flex flex-col bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800">
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
      <main className="flex-1 flex flex-col items-center py-8 px-4">
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

          {/* Two-column project cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-3xl mx-auto w-full text-left">

            {/* Create new project */}
            <div className="bg-white dark:bg-slate-900/70 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-800 p-6 space-y-5 flex flex-col">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Create New Project</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Start a fresh risk analysis project in a new directory.
                </p>
              </div>
              <form onSubmit={handleCreateProject} className="space-y-4 flex flex-col flex-1">
                <div className="space-y-2">
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
                <div className="space-y-2">
                  <Label htmlFor="projectDirectory" className="text-slate-700 dark:text-slate-200">
                    Project Directory
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="projectDirectory"
                      value={projectDir}
                      placeholder="Select a folder"
                      readOnly
                      title={projectDir}
                      style={{ direction: projectDir ? "rtl" : "ltr", unicodeBidi: "plaintext" }}
                    />
                    <Button type="button" variant="outline" onClick={handlePickDirectory}>
                      Browse
                    </Button>
                  </div>
                </div>
                {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
                <Button type="submit" size="lg" className="w-full mt-auto" disabled={isCreating}>
                  {isCreating ? "Creating…" : "Create Project"}
                </Button>
              </form>
            </div>

            {/* Open existing project */}
            <div className="bg-white dark:bg-slate-900/70 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-800 p-6 space-y-5 flex flex-col">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Open Existing Project</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Select a directory that already contains a project database.
                </p>
              </div>
              <div className="space-y-4 flex flex-col flex-1 justify-between">
                <div className="space-y-2">
                  <Label htmlFor="openProjectDirectory" className="text-slate-700 dark:text-slate-200">
                    Project Directory
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="openProjectDirectory"
                      value={openProjectDir}
                      placeholder="Select a project folder"
                      readOnly
                      title={openProjectDir}
                      style={{ direction: openProjectDir ? "rtl" : "ltr", unicodeBidi: "plaintext" }}
                    />
                    <Button type="button" variant="outline" onClick={handlePickExistingProject}>
                      Browse
                    </Button>
                  </div>
                </div>
                {openError && <p className="text-sm text-red-600 dark:text-red-400">{openError}</p>}
                <Button
                  type="button"
                  size="lg"
                  className="w-full mt-auto"
                  onClick={handleOpenProject}
                  disabled={isOpeningProject}
                >
                  {isOpeningProject ? "Opening…" : "Open Project"}
                </Button>
              </div>
            </div>

          </div>
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
