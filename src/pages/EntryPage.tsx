import { FormEvent, useEffect, useState } from "react";
import { ChevronRight, FolderOpen, FolderPlus, History, Trash, X } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { open, save } from "@tauri-apps/plugin-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toggle } from "@/components/ui/toggle";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@/components/ui/item";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { useBackendClient } from "@/hooks/useBackendClient";
import { unwrap } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

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
}

export function EntryPage({}: EntryPageProps) {
    const navigate = useNavigate();
    const backendClient = useBackendClient();

    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [recentProjects, setRecentProjects] = useState<string[]>([]);
    const [recentDeleteEnabled, setRecentDeleteEnabled] = useState(false);
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
        const selection = await save({
            defaultPath: "new-project.orproj",
            filters: PROJECT_FILE_FILTERS,
        });
        return typeof selection === "string" ? selection : null;
    };

    const chooseOpenFile = async () => {
        setError(null);
        const selection = await open({
            directory: false,
            multiple: false,
            filters: PROJECT_FILE_FILTERS,
        });
        return typeof selection === "string" ? selection : null;
    };

    const handleCreate = async () => {
        setError(null);
        const projectPath = await chooseCreateFile();
        if (!projectPath) {
            return;
        }

        const finalProjectName = inferProjectName(projectPath);

        setBusy(true);
        try {
            const project = await unwrap(backendClient.createProject(finalProjectName, projectPath));
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
        const openProjectPath = await chooseOpenFile();
        if (!openProjectPath) {
            return;
        }

        setBusy(true);
        try {
            const project = await unwrap(backendClient.openProject(openProjectPath, null));
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

    const openRecentProject = async (projectPathValue: string) => {
        setError(null);
        setBusy(true);
        try {
            const project = await unwrap(backendClient.openProject(projectPathValue, null));
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

    const removeRecentProject = (projectPathValue: string) => {
        const next = recentProjects.filter((item) => item !== projectPathValue);
        setRecentProjects(next);
        if (next.length === 0) {
            setRecentDeleteEnabled(false);
        }
        localStorage.setItem(RECENT_PROJECTS_KEY, JSON.stringify(next));
    };

    const handleUnlock = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!unlockPath) {
            return;
        }
        setUnlockError(null);
        setUnlockBusy(true);
        try {
            const project = await unwrap(backendClient.openProject(unlockPath, unlockPassword));
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

                <div className="space-y-2">
                    <Button type="button" size="lg" disabled={busy} className="w-full gap-2" onClick={() => void handleCreate()}>
                        <FolderPlus className="h-4 w-4" />
                        {busy ? "Creating..." : "Create New Project"}
                    </Button>

                    <Button type="button" size="lg" variant="outline" disabled={busy} onClick={handleOpen} className="w-full gap-2">
                        <FolderOpen className="h-4 w-4" />
                        {busy ? "Opening..." : "Open Existing Project"}
                    </Button>
                </div>

                <Card>
                    <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
                        <CardTitle className="text-base flex items-center gap-2">
                            <History className="h-4 w-4" />
                            Recent Projects
                        </CardTitle>
                        <div className="flex items-center gap-2">
                            <Toggle
                                variant="ghost"
                                size="default"
                                pressed={recentDeleteEnabled && recentProjects.length !== 0}
                                disabled={recentProjects.length === 0}
                                onPressedChange={setRecentDeleteEnabled}
                                aria-label="Enable removing recent projects"
                            >
                                <Trash className="group-data-[state=on]/toggle:fill-foreground" />
                            </Toggle>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <ScrollArea className="h-64 w-full pr-4">
                            <ItemGroup className="gap-2 p-4">
                                {recentProjects.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">No projects opened before.</p>
                                ) : (
                                    recentProjects.map((projectPathValue) => {
                                        const parts = projectPathValue.split(/[\\/]/).filter(Boolean);
                                        const fileName = parts[parts.length - 1] || projectPathValue;
                                        const name = fileName.replace(/\.(db|orproj)$/i, "");
                                        return (
                                            <Item
                                                key={projectPathValue}
                                                variant="outline"
                                                size="xs"
                                                className={recentDeleteEnabled ? "" : "hover:bg-muted"} >
                                                <button
                                                    type="button"
                                                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                                                    onClick={() => void openRecentProject(projectPathValue)}
                                                    disabled={busy || recentDeleteEnabled}
                                                >
                                                    <ItemContent>
                                                        <ItemTitle className="w-full">{name}</ItemTitle>
                                                        <ItemDescription className="line-clamp-1">{projectPathValue}</ItemDescription>
                                                    </ItemContent>
                                                    {!recentDeleteEnabled && (
                                                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                                                    )}
                                                </button>
                                                {recentDeleteEnabled ? (
                                                    <ItemActions>
                                                        <Button
                                                            type="button"
                                                            variant="destructive"
                                                            size="sm"
                                                            onClick={() => removeRecentProject(projectPathValue)}
                                                            disabled={busy}
                                                            aria-label={`Remove ${name} from recent projects`}
                                                        >
                                                            <X className="h-4 w-4" />
                                                            Remove
                                                        </Button>
                                                    </ItemActions>
                                                ) : null}
                                            </Item>
                                        );
                                    })
                                )}
                            </ItemGroup>
                        </ScrollArea>
                    </CardContent>
                </Card>

                {error ? <p className="text-sm text-red-600">{error}</p> : null}

            </div>

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
