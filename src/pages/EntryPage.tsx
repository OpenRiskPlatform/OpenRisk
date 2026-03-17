import { FormEvent, useEffect, useState } from "react";
import { FolderOpen, FolderPlus, History, LogOut, Settings } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { open } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { useBackendClient } from "@/hooks/useBackendClient";

const LAST_PROJECT_DIR_KEY = "openrisk:last-project-dir";
const RECENT_PROJECTS_KEY = "openrisk:recent-projects";

interface EntryPageProps {
    initialMode?: "create" | "open";
}

export function EntryPage({ initialMode }: EntryPageProps) {
    const navigate = useNavigate();
    const backendClient = useBackendClient();

    const [mode, setMode] = useState<"idle" | "create" | "open" | "recent">(
        initialMode ?? "recent"
    );
    const [settingsOpen, setSettingsOpen] = useState(false);

    const [projectName, setProjectName] = useState("");
    const [projectDir, setProjectDir] = useState("");
    const [openProjectDir, setOpenProjectDir] = useState("");

    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [recentProjects, setRecentProjects] = useState<string[]>([]);

    useEffect(() => {
        if (mode === "create" && projectDir && !projectName.trim()) {
            const parts = projectDir.split(/[\\/]/).filter(Boolean);
            const fallback = parts[parts.length - 1] || "NewProject";
            setProjectName(fallback);
        }
    }, [mode, projectDir, projectName]);

    useEffect(() => {
        try {
            const raw = localStorage.getItem(RECENT_PROJECTS_KEY);
            if (!raw) {
                setRecentProjects([]);
                return;
            }
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) {
                setRecentProjects([]);
                return;
            }
            const normalized = parsed
                .filter((item): item is string => typeof item === "string")
                .map((item) => item.trim())
                .filter((item) => item.length > 0);
            setRecentProjects(normalized.slice(0, 10));
        } catch {
            setRecentProjects([]);
        }
    }, []);

    useEffect(() => {
        let cancelled = false;

        const pruneRecent = async () => {
            if (!recentProjects.length) {
                return;
            }

            const valid: string[] = [];
            for (const directory of recentProjects) {
                try {
                    await backendClient.openProject(directory);
                    valid.push(directory);
                } catch {
                    // Skip invalid or missing project directories.
                }
            }

            if (cancelled) {
                return;
            }

            if (valid.length !== recentProjects.length) {
                setRecentProjects(valid);
                localStorage.setItem(RECENT_PROJECTS_KEY, JSON.stringify(valid));
            }
        };

        void pruneRecent();

        return () => {
            cancelled = true;
        };
    }, [backendClient, recentProjects]);

    const saveRecent = (directory: string) => {
        const next = [
            directory,
            ...recentProjects.filter((item) => item !== directory),
        ].slice(0, 10);
        setRecentProjects(next);
        localStorage.setItem(RECENT_PROJECTS_KEY, JSON.stringify(next));
    };

    const chooseCreateDir = async () => {
        setError(null);
        const selection = await open({ directory: true, multiple: false });
        if (typeof selection === "string") {
            setProjectDir(selection);
            setMode("create");
        }
    };

    const chooseOpenDir = async () => {
        setError(null);
        const selection = await open({ directory: true, multiple: false });
        if (typeof selection === "string") {
            setOpenProjectDir(selection);
            setMode("open");
        }
    };

    const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError(null);
        if (!projectDir) {
            setError("Select parent folder for new project");
            return;
        }
        if (!projectName.trim()) {
            setError("Project name is required");
            return;
        }

        setBusy(true);
        try {
            const project = await backendClient.createProject(projectName.trim(), projectDir);
            localStorage.setItem(LAST_PROJECT_DIR_KEY, project.directory);
            saveRecent(project.directory);
            await navigate({ to: "/project", search: { dir: project.directory } });
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setBusy(false);
        }
    };

    const handleOpen = async () => {
        setError(null);
        if (!openProjectDir) {
            setError("Select project directory");
            return;
        }

        setBusy(true);
        try {
            const project = await backendClient.openProject(openProjectDir);
            localStorage.setItem(LAST_PROJECT_DIR_KEY, project.directory);
            saveRecent(project.directory);
            await navigate({ to: "/project", search: { dir: project.directory } });
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setBusy(false);
        }
    };

    const handleExit = async () => {
        try {
            const win = getCurrentWindow();
            await win.destroy();
        } catch {
            window.close();
        }
    };

    const openRecentProject = async (directory: string) => {
        setError(null);
        setBusy(true);
        try {
            const project = await backendClient.openProject(directory);
            localStorage.setItem(LAST_PROJECT_DIR_KEY, project.directory);
            saveRecent(project.directory);
            await navigate({ to: "/project", search: { dir: project.directory } });
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="min-h-screen bg-background flex items-center justify-center px-6 py-10">
            <div className="w-full max-w-xl space-y-7">
                <div className="h-48 rounded-[44px] bg-[#11131d] flex items-center justify-center text-white text-6xl font-bold tracking-tight">
                    LOGO
                </div>

                <div className="flex items-center justify-center gap-3">
                    <Button
                        size="icon"
                        variant={mode === "open" ? "default" : "outline"}
                        onClick={() => {
                            setMode("open");
                        }}
                    >
                        <FolderOpen className="h-5 w-5" />
                    </Button>
                    <Button
                        size="icon"
                        variant={mode === "create" ? "default" : "outline"}
                        onClick={() => {
                            setMode("create");
                        }}
                    >
                        <FolderPlus className="h-5 w-5" />
                    </Button>
                    <Button
                        size="icon"
                        variant={mode === "recent" ? "default" : "outline"}
                        onClick={() => setMode("recent")}
                    >
                        <History className="h-5 w-5" />
                    </Button>
                    <Button size="icon" variant="outline" onClick={() => setSettingsOpen(true)}>
                        <Settings className="h-5 w-5" />
                    </Button>
                    <Button size="icon" variant="outline" onClick={handleExit}>
                        <LogOut className="h-5 w-5" />
                    </Button>
                </div>

                {mode === "recent" ? (
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-2xl">Recent Projects</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {recentProjects.length === 0 ? (
                                <p className="text-sm text-muted-foreground">no projects opened before</p>
                            ) : (
                                recentProjects.map((directory) => {
                                    const parts = directory.split(/[\\/]/).filter(Boolean);
                                    const name = parts[parts.length - 1] || directory;
                                    return (
                                        <button
                                            key={directory}
                                            type="button"
                                            className="w-full text-left rounded-md border px-3 py-2 hover:bg-muted/30"
                                            onClick={() => void openRecentProject(directory)}
                                            disabled={busy}
                                        >
                                            <p className="text-sm font-medium truncate">{name}</p>
                                            <p className="text-xs text-muted-foreground truncate">{directory}</p>
                                        </button>
                                    );
                                })
                            )}
                        </CardContent>
                    </Card>
                ) : null}

                {mode === "create" ? (
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base">Create Project</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form className="space-y-3" onSubmit={handleCreate}>
                                <div className="space-y-1">
                                    <Label>Parent folder</Label>
                                    <div className="flex gap-2">
                                        <Input value={projectDir} readOnly placeholder="Select folder" />
                                        <Button type="button" variant="outline" onClick={chooseCreateDir}>Browse</Button>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <Label>Project name</Label>
                                    <Input value={projectName} onChange={(e) => setProjectName(e.target.value)} />
                                </div>
                                <Button type="submit" disabled={busy} className="w-full">
                                    {busy ? "Creating..." : "Create"}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                ) : null}

                {mode === "open" ? (
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base">Open Project</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="space-y-1">
                                <Label>Project folder</Label>
                                <div className="flex gap-2">
                                    <Input value={openProjectDir} readOnly placeholder="Select project folder" />
                                    <Button type="button" variant="outline" onClick={chooseOpenDir}>Browse</Button>
                                </div>
                            </div>
                            <Button type="button" disabled={busy} onClick={handleOpen} className="w-full">
                                {busy ? "Opening..." : "Open"}
                            </Button>
                        </CardContent>
                    </Card>
                ) : null}

                {error ? <p className="text-sm text-red-600">{error}</p> : null}

            </div>

            <SettingsDialog
                open={settingsOpen}
                onOpenChange={setSettingsOpen}
                projectDir={openProjectDir || projectDir || undefined}
            />
        </div>
    );
}
