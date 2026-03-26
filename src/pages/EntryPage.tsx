/**
 * Entry Page - Landing/Home screen
 */

import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { open, save } from "@tauri-apps/plugin-dialog";
import {
  ArrowRight,
  Box,
  FolderOpen,
  Loader2,
  LogOut,
  Plus,
  Settings,
} from "lucide-react";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useBackendClient } from "@/hooks/useBackendClient";

const RECENT_PROJECTS_KEY = "openrisk.recentProjects";
const MAX_RECENT_PROJECTS = 5;

function getBaseName(pathValue: string): string {
  const normalized = pathValue.replace(/[\\/]+$/, "");
  const parts = normalized.split(/[\\/]/);
  return parts[parts.length - 1] ?? "";
}

function getParentDirectory(pathValue: string): string | null {
  const normalized = pathValue.replace(/[\\/]+$/, "");
  const lastSlash = Math.max(normalized.lastIndexOf("/"), normalized.lastIndexOf("\\"));

  if (lastSlash < 0) {
    return null;
  }

  if (lastSlash === 0) {
    return normalized[0] ?? null;
  }

  return normalized.slice(0, lastSlash);
}

function normalizeProjectDirectory(pathValue: string): string {
  if (!pathValue.toLowerCase().endsWith(".project")) {
    return pathValue;
  }

  return getParentDirectory(pathValue) ?? pathValue;
}

function getProjectLabel(projectDir: string): string {
  const name = getBaseName(projectDir);
  if (!name) {
    return "untitled.project";
  }
  return `${name}.project`;
}

function pushRecentProject(recent: string[], projectDir: string): string[] {
  const deduplicated = recent.filter((entry) => entry !== projectDir);
  return [projectDir, ...deduplicated].slice(0, MAX_RECENT_PROJECTS);
}

export function EntryPage() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsProjectDir, setSettingsProjectDir] = useState<string | undefined>(undefined);
  const [recentProjects, setRecentProjects] = useState<string[]>([]);
  const [loadingRecentProject, setLoadingRecentProject] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<"open" | "save" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();
  const backendClient = useBackendClient();

  const controlsDisabled = pendingAction !== null || loadingRecentProject !== null;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(RECENT_PROJECTS_KEY);
      if (!raw) {
        return;
      }
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.every((item) => typeof item === "string")) {
        setRecentProjects(parsed.slice(0, MAX_RECENT_PROJECTS));
      }
    } catch {
      setRecentProjects([]);
    }
  }, []);

  const persistRecentProjects = (updater: (current: string[]) => string[]) => {
    setRecentProjects((current) => {
      const next = updater(current);
      localStorage.setItem(RECENT_PROJECTS_KEY, JSON.stringify(next));
      return next;
    });
  };

  const openProjectDirectory = async (projectDir: string) => {
    const project = await backendClient.openProject(projectDir);
    setSettingsProjectDir(project.directory);
    persistRecentProjects((current) => pushRecentProject(current, project.directory));
    await navigate({ to: "/project", search: { dir: project.directory } });
  };

  const handleOpenProjectFile = async () => {
    setError(null);
    setPendingAction("open");
    try {
      const selection = await open({
        directory: false,
        multiple: false,
        filters: [{ name: "OpenRisk Project", extensions: ["project"] }],
      });

      if (typeof selection !== "string") {
        return;
      }

      await openProjectDirectory(normalizeProjectDirectory(selection));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPendingAction(null);
    }
  };

  const handleCreateProjectFile = async () => {
    setError(null);
    setPendingAction("save");
    try {
      const selection = await save({
        defaultPath: "new-project.project",
        filters: [{ name: "OpenRisk Project", extensions: ["project"] }],
      });

      if (typeof selection !== "string") {
        return;
      }

      const parentDirectory = getParentDirectory(selection);
      if (!parentDirectory) {
        throw new Error("Could not determine target directory from selected file path");
      }

      const fileName = getBaseName(selection);
      const projectName = fileName.replace(/\.project$/i, "").trim() || "new-project";

      const project = await backendClient.createProject(projectName, parentDirectory);
      setSettingsProjectDir(project.directory);
      persistRecentProjects((current) => pushRecentProject(current, project.directory));
      await navigate({ to: "/project", search: { dir: project.directory } });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPendingAction(null);
    }
  };

  const handleRecentProjectClick = async (projectDir: string) => {
    setError(null);
    setLoadingRecentProject(projectDir);
    try {
      await openProjectDirectory(projectDir);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingRecentProject(null);
    }
  };

  const handleExitApp = () => {
    console.info("Mock exit app action triggered");
    window.close();
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-sm space-y-8">
          <div className="flex justify-center">
            <div className="flex h-28 w-64 items-center justify-center rounded-3xl bg-slate-950 text-4xl font-extrabold text-white">
              OpenRisk
            </div>
          </div>

          <div className="flex items-center justify-center gap-2">
            <Button
              type="button"
              variant="default"
              size="icon"
              onClick={handleOpenProjectFile}
              disabled={controlsDisabled}
              aria-label="Open project file"
            >
              <FolderOpen className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleCreateProjectFile}
              disabled={controlsDisabled}
              aria-label="Create project file"
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => undefined}
              disabled={controlsDisabled}
              aria-label="Plugins menu placeholder"
            >
              <Box className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setSettingsOpen(true)}
              disabled={controlsDisabled}
              aria-label="Open settings"
            >
              <Settings className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleExitApp}
              disabled={controlsDisabled}
              aria-label="Exit application"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Recent Projects</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {recentProjects.length === 0 && (
                <p className="py-4 text-sm text-muted-foreground">No recent projects yet.</p>
              )}

              {recentProjects.map((projectDir) => {
                const isLoading = loadingRecentProject === projectDir;
                return (
                  <Button
                    key={projectDir}
                    type="button"
                    variant="ghost"
                    className="h-10 w-full justify-between border px-3"
                    onClick={() => {
                      void handleRecentProjectClick(projectDir);
                    }}
                    disabled={controlsDisabled}
                  >
                    <span className="truncate text-sm">{getProjectLabel(projectDir)}</span>
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : (
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                );
              })}
            </CardContent>
          </Card>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      </main>

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        projectDir={settingsProjectDir}
      />
    </div>
  );
}
