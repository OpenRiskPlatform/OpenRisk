import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { FolderOpen, Archive, Power } from "lucide-react";
import { useBackendClient } from "@/hooks/useBackendClient";
import { unwrap } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { PluginRecord } from "@/core/backend/bindings";

interface ManagePluginsProps {
    projectDir?: string;
    plugins: PluginRecord[];
    loading: boolean;
    error?: string | null;
    onPluginUpdated: (plugin: PluginRecord) => void;
}

export function ManagePlugins({
    projectDir,
    plugins,
    loading,
    error,
    onPluginUpdated,
}: ManagePluginsProps) {
    const backendClient = useBackendClient();
    const [importing, setImporting] = useState(false);
    const [importError, setImportError] = useState<string | null>(null);
    const [togglingId, setTogglingId] = useState<string | null>(null);

    const pickAndImportPlugin = async () => {
        if (!projectDir) return;
        setImportError(null);
        const selected = await open({
            directory: true,
            multiple: false,
            title: "Select plugin folder",
        });
        if (!selected || Array.isArray(selected)) return;
        setImporting(true);
        try {
            const payload = await unwrap(backendClient.upsertProjectPluginFromDir(selected));
            onPluginUpdated(payload);
        } catch (err) {
            setImportError(err instanceof Error ? err.message : String(err));
        } finally {
            setImporting(false);
        }
    };

    const pickAndImportPluginZip = async () => {
        if (!projectDir) return;
        setImportError(null);
        const selected = await open({
            directory: false,
            multiple: false,
            filters: [{ name: "Plugin Archive", extensions: ["zip"] }],
            title: "Select plugin archive (.zip)",
        });
        if (!selected || Array.isArray(selected)) return;
        setImporting(true);
        try {
            const payload = await unwrap(backendClient.upsertProjectPluginFromZip(selected));
            onPluginUpdated(payload);
        } catch (err) {
            setImportError(err instanceof Error ? err.message : String(err));
        } finally {
            setImporting(false);
        }
    };

    const toggleEnabled = async (plugin: PluginRecord) => {
        setTogglingId(plugin.id);
        try {
            const updated = await unwrap(
                backendClient.setPluginEnabled(plugin.id, !plugin.enabled),
            );
            onPluginUpdated(updated);
        } catch (err) {
            setImportError(err instanceof Error ? err.message : String(err));
        } finally {
            setTogglingId(null);
        }
    };

    return (
        <div className="flex flex-col h-full min-h-0 gap-6">
            <div className="flex-shrink-0">
                <h2 className="text-2xl font-semibold mb-1">Manage Plugins</h2>
                <p className="text-sm text-muted-foreground">
                    Install plugins and enable or disable them for this project.
                </p>
            </div>

            {!projectDir && (
                <div className="text-center py-12 text-muted-foreground">
                    Open or create a project to manage plugins.
                </div>
            )}

            {projectDir && loading && (
                <div className="text-center py-12 text-muted-foreground">
                    Loading plugins...
                </div>
            )}

            {projectDir && !loading && error && (
                <div className="text-center py-12 text-red-600 text-sm">{error}</div>
            )}

            {projectDir && !loading && !error && (
                <div className="flex-1 min-h-0 overflow-y-auto space-y-6 pr-2">
                    <div className="flex items-center gap-2 flex-wrap">
                        <Button
                            type="button"
                            size="sm"
                            onClick={pickAndImportPlugin}
                            disabled={importing}
                        >
                            <FolderOpen className="h-4 w-4 mr-2" />
                            {importing ? "Loading..." : "Load Folder"}
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={pickAndImportPluginZip}
                            disabled={importing}
                        >
                            <Archive className="h-4 w-4 mr-2" />
                            Load ZIP
                        </Button>
                        <p className="text-xs text-muted-foreground">
                            Load from folder or .zip archive. Existing plugin IDs are updated in place.
                        </p>
                    </div>

                    {importError ? (
                        <p className="text-sm text-red-600">{importError}</p>
                    ) : null}

                    {plugins.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            No plugins installed in this project yet.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {plugins.map((plugin) => (
                                <div
                                    key={plugin.id}
                                    className="flex items-center justify-between border rounded-lg px-4 py-3"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <Power
                                            className={`h-4 w-4 flex-shrink-0 ${plugin.enabled ? "text-green-500" : "text-muted-foreground"}`}
                                        />
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium truncate">{plugin.name}</p>
                                            <p className="text-xs text-muted-foreground truncate">
                                                {plugin.id} · v{plugin.version}
                                            </p>
                                        </div>
                                    </div>
                                    <Switch
                                        checked={plugin.enabled}
                                        disabled={togglingId === plugin.id}
                                        onCheckedChange={() => toggleEnabled(plugin)}
                                        className="flex-shrink-0 ml-4"
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
