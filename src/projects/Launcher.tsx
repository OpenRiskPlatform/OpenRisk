import { useState } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { FolderOpen, FolderPlus, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/ui/BrandLogo";
import {
  addRecentProject,
  readRecentProjects,
  removeRecentProject,
} from "./recentProjects";

const PROJECT_FILTERS = [
  { name: "OpenRisk Project", extensions: ["orproj", "db"] },
];

interface LauncherProps {
  pending: boolean;
  error: string | null;
  onCreateProject: (name: string, projectPath: string) => Promise<void>;
  onOpenProject: (projectPath: string) => Promise<void>;
}

function projectName(projectPath: string): string {
  const parts = projectPath.split(/[\\/]/).filter(Boolean);
  const filename = parts[parts.length - 1];
  return (filename ?? "Project").replace(/\.(orproj|db)$/i, "");
}

export function Launcher({
  pending,
  error,
  onCreateProject,
  onOpenProject,
}: LauncherProps) {
  const [recentProjects, setRecentProjects] = useState(readRecentProjects);

  const createProject = async () => {
    const projectPath = await save({
      title: "Create OpenRisk Project",
      defaultPath: "new-project.orproj",
      filters: PROJECT_FILTERS,
    });

    if (typeof projectPath !== "string") {
      return;
    }

    await onCreateProject(projectName(projectPath), projectPath);
  };

  const chooseProject = async () => {
    const projectPath = await open({
      title: "Open OpenRisk Project",
      directory: false,
      multiple: false,
      filters: PROJECT_FILTERS,
    });

    if (typeof projectPath !== "string") {
      return;
    }

    await onOpenProject(projectPath);
  };

  const forgetProject = (projectPath: string) => {
    setRecentProjects(removeRecentProject(projectPath));
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-6 py-12">
      <section className="w-full max-w-2xl rounded-3xl border bg-background p-8 shadow-sm">
        <div className="mb-10 flex justify-center">
          <BrandLogo
            size={72}
            textSizeClassName="text-4xl"
            customWidth={320}
            className="max-w-full text-foreground"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Button
            size="lg"
            disabled={pending}
            onClick={() => void createProject()}
            className="h-14 gap-2"
          >
            <FolderPlus className="h-5 w-5" />
            Create project
          </Button>
          <Button
            size="lg"
            variant="outline"
            disabled={pending}
            onClick={() => void chooseProject()}
            className="h-14 gap-2"
          >
            <FolderOpen className="h-5 w-5" />
            Open project
          </Button>
        </div>

        {pending ? (
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Opening project…
          </p>
        ) : null}

        {error ? (
          <div role="alert" className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <div className="mt-10">
          <div className="mb-3 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Recent projects</h2>
          </div>

          {recentProjects.length === 0 ? (
            <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
              No recent projects.
            </p>
          ) : (
            <ul className="divide-y rounded-xl border">
              {recentProjects.map((projectPath) => (
                <li key={projectPath} className="flex items-center gap-2 p-2">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => void onOpenProject(projectPath)}
                    className="min-w-0 flex-1 rounded-lg px-3 py-2 text-left hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
                  >
                    <span className="block truncate text-sm font-medium">
                      {projectName(projectPath)}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {projectPath}
                    </span>
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={pending}
                    aria-label={`Forget ${projectName(projectPath)}`}
                    onClick={() => forgetProject(projectPath)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}

export { addRecentProject };
