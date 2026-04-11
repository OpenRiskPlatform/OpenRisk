/**
 * Plugin Settings Panel
 */

import { useBackendClient } from "@/hooks/useBackendClient";
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
    const enabledPlugins = plugins.filter((p) => p.enabled);

    return (
        <div className="flex flex-col h-full min-h-0 gap-6">
            <div className="flex-shrink-0">
                <h2 className="text-2xl font-semibold mb-1">Plugin Settings</h2>
                <p className="text-sm text-muted-foreground">
                    Configure settings for enabled plugins.
                </p>
                {projectSettings && (
                    <p className="text-xs text-muted-foreground mt-2">
                        Locale: {projectSettings.locale} • Project settings ID: {projectSettings.id}
                    </p>
                )}
            </div>

            {!projectDir && (
                <div className="text-center py-12 text-muted-foreground">
                    Open or create a project to configure plugins.
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

            {projectDir && !loading && !error && enabledPlugins.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                    No enabled plugins. Enable plugins in the Manage tab.
                </div>
            )}

            {projectDir && !loading && !error && enabledPlugins.length > 0 && (
                <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-2">
                    {enabledPlugins.map((plugin) => (
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
