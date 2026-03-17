/**
 * Entry Page - Landing/Home screen
 */

import { ArrowLeft, FolderOpen, FolderPlus, Settings } from "lucide-react";
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

const RECENT_PROJECT_DIR = "/home/ronis/tmp/openrisk-test-project";

export function EntryPage() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mode, setMode] = useState<"choose" | "create" | "open">("choose");
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

  const switchMode = (nextMode: "choose" | "create" | "open") => {
    setError(null);
    setOpenError(null);
    setMode(nextMode);
  };

  const isChooseStep = mode === "choose";

  return (
    <div className="min-h-screen flex flex-col bg-background">
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
        <div className="text-center space-y-8 max-w-3xl w-full">
          <div className="space-y-3">
            <h1 className="text-4xl font-bold tracking-tight">OpenRisk</h1>
            <p className="text-lg text-muted-foreground">
              Start with two clear steps: choose action, then complete the form.
            </p>
          </div>

          <div className="max-w-2xl mx-auto w-full">
            {isChooseStep ? (
              <div className="grid gap-4 md:grid-cols-2">
                <Card className="text-left">
                  <CardHeader className="space-y-3">
                    <div className="inline-flex h-9 w-9 items-center justify-center rounded-md border">
                      <FolderPlus className="h-4 w-4" />
                    </div>
                    <CardTitle>Create Project</CardTitle>
                    <CardDescription>
                      Start a new risk workspace with a project name and folder.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button className="w-full" onClick={() => switchMode("create")}>
                      Continue
                    </Button>
                  </CardContent>
                </Card>

                <Card className="text-left">
                  <CardHeader className="space-y-3">
                    <div className="inline-flex h-9 w-9 items-center justify-center rounded-md border">
                      <FolderOpen className="h-4 w-4" />
                    </div>
                    <CardTitle>Open Project</CardTitle>
                    <CardDescription>
                      Open an existing project directory with project database.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button className="w-full" variant="outline" onClick={() => switchMode("open")}>
                      Continue
                    </Button>
                  </CardContent>
                </Card>
              </div>
            ) : null}

            {mode === "create" ? (
              <form
                onSubmit={handleCreateProject}
                className="rounded-lg border bg-card p-6 space-y-5 text-left"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold">Step 2: Create Project</h2>
                  <Button type="button" variant="ghost" onClick={() => switchMode("choose")}>
                    <ArrowLeft className="h-4 w-4 mr-2" /> Back
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="projectName">Project Name</Label>
                  <Input
                    id="projectName"
                    value={projectName}
                    onChange={(event) => setProjectName(event.target.value)}
                    placeholder="ACME Risk Assessment"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="projectDirectory">Project Directory</Label>
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
                  <p className="text-xs text-muted-foreground">
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

                {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}

                <Button type="submit" size="lg" className="w-full" disabled={isCreating}>
                  {isCreating ? "Creating Project..." : "Create Project"}
                </Button>
              </form>
            ) : null}

            {mode === "open" ? (
              <Card className="mx-auto w-full text-left">
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle>Step 2: Open Existing Project</CardTitle>
                    <Button type="button" variant="ghost" onClick={() => switchMode("choose")}>
                      <ArrowLeft className="h-4 w-4 mr-2" /> Back
                    </Button>
                  </div>
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

                  {openError ? (
                    <p className="text-sm text-red-600 dark:text-red-400">{openError}</p>
                  ) : null}

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
            ) : null}
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
