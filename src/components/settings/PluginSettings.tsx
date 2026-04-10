/**
 * Plugin Settings Panel
 */

import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { useBackendClient } from "@/hooks/useBackendClient";
import { unwrap } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PluginSettingsCard } from "@/components/settings/PluginSettingsCard";
import type {
    PluginRecord,
    ProjectSettingsRecord,
} from "@/core/backend/bindings";

interface PluginSettingsProps {
    projectDir?: string;
    projectSettings: ProjectSettingsRecord | null;
    plugins: PluginRecord[];
    loading: boolean;
    error?: string | null;
    onPluginUpdated: (plugin: PluginRecord) => void;
}

export function PluginSettings({
    projectDir,
    projectSettings,
    plugins,
    loading,
    error,
    onPluginUpdated,
}: PluginSettingsProps) {
    const backendClient = useBackendClient();
    const [importing, setImporting] = useState(false);
    const [importError, setImportError] = useState<string | null>(null);

    const pickAndImportPlugin = async () => {
        if (!projectDir) {
            return;
        }

        setImportError(null);

        const selected = await open({
            directory: true,
            multiple: false,
            title: "Select plugin folder",
        });

        if (!selected || Array.isArray(selected)) {
            return;
        }

        setImporting(true);
        try {
            const payload = await unwrap(backendClient.upsertProjectPluginFromDir(selected));
            onPluginUpdated(payload);
        } catch (error) {
            setImportError(error instanceof Error ? error.message : String(error));
        } finally {
            setImporting(false);
        }
    };

    const pickAndImportPluginZip = async () => {
        if (!projectDir) {
            return;
        }

        setImportError(null);

        const selected = await open({
            directory: false,
            multiple: false,
            filters: [{ name: "Plugin Archive", extensions: ["zip"] }],
            title: "Select plugin archive (.zip)",
        });

        if (!selected || Array.isArray(selected)) {
            return;
        }

        setImporting(true);
        try {
            const payload = await unwrap(backendClient.upsertProjectPluginFromZip(selected));
            onPluginUpdated(payload);
        } catch (error) {
            setImportError(error instanceof Error ? error.message : String(error));
        } finally {
            setImporting(false);
        }
    };

    return (
        <div className="flex flex-col h-full min-h-0 gap-6">
            <div className="flex-shrink-0">
                <h2 className="text-2xl font-semibold mb-1">Project Plugins</h2>
                <p className="text-sm text-muted-foreground">
                    View plugins provisioned for this project and edit their settings.
                </p>
                {projectSettings && (
                    <p className="text-xs text-muted-foreground mt-2">
                        Locale: {projectSettings.locale} • Project settings ID: {projectSettings.id}
                    </p>
                )}
            </div>

            {!projectDir && (
                <div className="text-center py-12 text-muted-foreground">
                    Open or create a project to inspect plugin settings.
                </div>
            )}

            {projectDir && loading && (
                <div className="text-center py-12 text-muted-foreground">
                    Loading plugins from project database...
                </div>
            )}

            {projectDir && !loading && error && (
                <div className="text-center py-12 text-red-600 text-sm">{error}</div>
            )}

            {projectDir && !loading && !error && (
                <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-2">
                    <div className="flex items-center gap-2 flex-wrap">
                        <Button
                            type="button"
                            size="sm"
                            onClick={() => pickAndImportPlugin()}
                            disabled={importing}
                        >
                            {importing ? "Loading..." : "Load Folder"}
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => pickAndImportPluginZip()}
                            disabled={importing}
                        >
                            Load ZIP
                        </Button>
                        <p className="text-xs text-muted-foreground">
                            Load a plugin from a folder or .zip archive. If its ID already exists, it is updated in place.
                        </p>
                    </div>

                    {importError ? <p className="text-sm text-red-600">{importError}</p> : null}

                    {plugins.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            No plugins found in this project.
                        </div>
                    ) : null}

                    {plugins.map((plugin) => (
                        <PluginSettingsCard
                            key={plugin.id}
                            plugin={plugin}
                            onPluginUpdated={onPluginUpdated}
                            backendClient={backendClient}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
