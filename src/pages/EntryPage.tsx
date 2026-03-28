import { FormEvent, useEffect, useState } from "react";
import { FolderOpen, FolderPlus, History, LogOut, Settings } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { open, save } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { useBackendClient } from "@/hooks/useBackendClient";

const LAST_PROJECT_DIR_KEY = "openrisk:last-project-dir";
const RECENT_PROJECTS_KEY = "openrisk:recent-projects";
const LOCKED_PROJECT_ERROR_PREFIX = "PROJECT_LOCKED:";
const LEGACY_PROJECT_ERROR_PREFIX = "PROJECT_LEGACY:";
const OUTDATED_PROJECT_ERROR_PREFIX = "PROJECT_OUTDATED:";
const PROJECT_FILE_FILTERS = [
    { name: "OpenRisk Project", extensions: ["orproj", "db"] },
    { name: "SQLite Database", extensions: ["db", "sqlite", "sqlite3", "orproj"] },
];

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
    const [projectPath, setProjectPath] = useState("");
    const [openProjectPath, setOpenProjectPath] = useState("");

    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [recentProjects, setRecentProjects] = useState<string[]>([]);
    const [unlockOpen, setUnlockOpen] = useState(false);
    const [unlockPath, setUnlockPath] = useState("");
    const [unlockPassword, setUnlockPassword] = useState("");
    const [unlockError, setUnlockError] = useState<string | null>(null);
    const [unlockBusy, setUnlockBusy] = useState(false);

    const inferProjectName = (path: string) => {
        const parts = path.split(/[\\/]/).filter(Boolean);
        const fileName = parts[parts.length - 1] || "NewProject";
        return fileName.replace(/\.(db|orproj)$/i, "");
    };

    const isLockedError = (message: string) => message.startsWith(LOCKED_PROJECT_ERROR_PREFIX);
    const isLegacyError = (message: string) => message.startsWith(LEGACY_PROJECT_ERROR_PREFIX);
    const isOutdatedError = (message: string) => message.startsWith(OUTDATED_PROJECT_ERROR_PREFIX);

    const friendlyOpenError = (message: string): string => {
        if (isLegacyError(message)) {
            return "This project file is too old and cannot be opened. It was created with an incompatible version of OpenRisk.";
        }
        if (isOutdatedError(message)) {
            const ver = message.slice(OUTDATED_PROJECT_ERROR_PREFIX.length).replace(/:.*$/, "");
            return `This project file uses an outdated schema (version ${ver}) that is no longer supported. It cannot be automatically migrated.`;
        }
        return message;
    };

    const startUnlockFlow = (path: string, message?: string) => {
        setUnlockPath(path);
        setUnlockPassword("");
        setUnlockError(message ?? "This project file is encrypted. Enter password to unlock.");
        setUnlockOpen(true);
    };

    useEffect(() => {
        if (mode === "create" && projectPath && !projectName.trim()) {
            setProjectName(inferProjectName(projectPath));
        }
    }, [mode, projectPath, projectName]);

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

    const saveRecent = (projectPathValue: string) => {
        const next = [
            projectPathValue,
            ...recentProjects.filter((item) => item !== projectPathValue),
        ].slice(0, 10);
        setRecentProjects(next);
        localStorage.setItem(RECENT_PROJECTS_KEY, JSON.stringify(next));
    };

    const chooseCreateFile = async () => {
        setError(null);
        const fileNameHint = projectName.trim() ? `${projectName.trim()}.orproj` : "new-project.orproj";
        const selection = await save({
            defaultPath: fileNameHint,
            filters: PROJECT_FILE_FILTERS,
        });
        if (typeof selection === "string") {
            setProjectPath(selection);
            if (!projectName.trim()) {
                setProjectName(inferProjectName(selection));
            }
            setMode("create");
        }
    };

    const chooseOpenFile = async () => {
        setError(null);
        const selection = await open({
            directory: false,
            multiple: false,
            filters: PROJECT_FILE_FILTERS,
        });
        if (typeof selection === "string") {
            setOpenProjectPath(selection);
            setMode("open");
        }
    };

    const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError(null);
        if (!projectPath) {
            setError("Select project file path");
            return;
        }
        if (!projectName.trim()) {
            setError("Project name is required");
            return;
        }

        setBusy(true);
        try {
            const project = await backendClient.createProject(projectName.trim(), projectPath);
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
        if (!openProjectPath) {
            setError("Select project file");
            return;
        }

        setBusy(true);
        try {
            const project = await backendClient.openProject(openProjectPath);
            localStorage.setItem(LAST_PROJECT_DIR_KEY, project.directory);
            saveRecent(project.directory);
            await navigate({ to: "/project", search: { dir: project.directory } });
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            if (isLockedError(message)) {
                startUnlockFlow(openProjectPath);
            } else {
                setError(friendlyOpenError(message));
            }
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

    const openRecentProject = async (projectPathValue: string) => {
        setError(null);
        setBusy(true);
        try {
            const project = await backendClient.openProject(projectPathValue);
            localStorage.setItem(LAST_PROJECT_DIR_KEY, project.directory);
            saveRecent(project.directory);
            await navigate({ to: "/project", search: { dir: project.directory } });
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            if (isLockedError(message)) {
                startUnlockFlow(projectPathValue);
            } else {
                setError(friendlyOpenError(message));
            }
        } finally {
            setBusy(false);
        }
    };

    const handleUnlock = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!unlockPath) {
            return;
        }
        setUnlockError(null);
        setUnlockBusy(true);
        try {
            const project = await backendClient.openProject(unlockPath, unlockPassword);
            localStorage.setItem(LAST_PROJECT_DIR_KEY, project.directory);
            saveRecent(project.directory);
            setUnlockOpen(false);
            setUnlockPassword("");
            await navigate({ to: "/project", search: { dir: project.directory } });
        } catch (err) {
            setUnlockError(err instanceof Error ? err.message : String(err));
        } finally {
            setUnlockBusy(false);
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
                                recentProjects.map((projectPathValue) => {
                                    const parts = projectPathValue.split(/[\\/]/).filter(Boolean);
                                    const fileName = parts[parts.length - 1] || projectPathValue;
                                    const name = fileName.replace(/\.(db|orproj)$/i, "");
                                    return (
                                        <button
                                            key={projectPathValue}
                                            type="button"
                                            className="w-full text-left rounded-md border px-3 py-2 hover:bg-muted/30"
                                            onClick={() => void openRecentProject(projectPathValue)}
                                            disabled={busy}
                                        >
                                            <p className="text-sm font-medium truncate">{name}</p>
                                            <p className="text-xs text-muted-foreground truncate">{projectPathValue}</p>
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
                                    <Label>Project file</Label>
                                    <div className="flex gap-2">
                                        <Input value={projectPath} readOnly placeholder="Select .orproj or .db path" />
                                        <Button type="button" variant="outline" onClick={chooseCreateFile}>Browse</Button>
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
                                <Label>Project file</Label>
                                <div className="flex gap-2">
                                    <Input value={openProjectPath} readOnly placeholder="Select .orproj or .db file" />
                                    <Button type="button" variant="outline" onClick={chooseOpenFile}>Browse</Button>
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
                projectDir={openProjectPath || projectPath || undefined}
            />

            <Dialog open={unlockOpen} onOpenChange={setUnlockOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Unlock Encrypted Project</DialogTitle>
                        <DialogDescription>
                            This file is encrypted. Enter password to open it.
                        </DialogDescription>
                    </DialogHeader>
                    <form className="space-y-3" onSubmit={handleUnlock}>
                        <div className="space-y-1">
                            <Label>Project file</Label>
                            <Input value={unlockPath} readOnly />
                        </div>
                        <div className="space-y-1">
                            <Label>Password</Label>
                            <Input
                                type="password"
                                value={unlockPassword}
                                onChange={(e) => setUnlockPassword(e.target.value)}
                                placeholder="Enter password"
                                autoFocus
                            />
                        </div>
                        {unlockError ? <p className="text-sm text-red-600">{unlockError}</p> : null}
                        <Button type="submit" disabled={unlockBusy || !unlockPassword.trim()} className="w-full">
                            {unlockBusy ? "Unlocking..." : "Unlock"}
                        </Button>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
