/**
 * Plugin Settings Panel
 */

import { useMemo, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { useBackendClient } from "@/hooks/useBackendClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type {
    PluginSettingsDescriptor,
    ProjectSettingsRecord,
} from "@/core/backend/types";

interface PluginSettingsProps {
    projectDir?: string;
    projectSettings: ProjectSettingsRecord | null;
    plugins: PluginSettingsDescriptor[];
    loading: boolean;
    error?: string | null;
    onPluginUpdated: (plugin: PluginSettingsDescriptor) => void;
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

    const pickAndImportPlugin = async (replacePluginId?: string) => {
        if (!projectDir) {
            return;
        }

        setImportError(null);

        const selected = await open({
            directory: true,
            multiple: false,
            title: replacePluginId ? "Select replacement plugin folder" : "Select plugin folder",
        });

        if (!selected || Array.isArray(selected)) {
            return;
        }

        setImporting(true);
        try {
            const payload = await backendClient.upsertProjectPluginFromDir(
                selected,
                replacePluginId
            );
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

            {projectDir && !loading && !error && plugins.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                    No plugins found in this project.
                </div>
            )}

            {projectDir && !loading && !error && plugins.length > 0 && (
                <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-2">
                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            size="sm"
                            onClick={() => pickAndImportPlugin()}
                            disabled={importing}
                        >
                            {importing ? "Loading..." : "Load Plugin Folder"}
                        </Button>
                        <p className="text-xs text-muted-foreground">
                            Replaces or adds plugin from folder with plugin.json and entrypoint.
                        </p>
                    </div>

                    {importError ? <p className="text-sm text-red-600">{importError}</p> : null}

                    {plugins.map((plugin) => (
                        <PluginSettingsCard
                            key={plugin.id}
                            projectDir={projectDir}
                            plugin={plugin}
                            onPluginUpdated={onPluginUpdated}
                            backendClient={backendClient}
                            onReplaceFromFolder={() => pickAndImportPlugin(plugin.id)}
                            isReplacing={importing}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function PluginSettingsCard({
    plugin,
    onPluginUpdated,
    backendClient,
    onReplaceFromFolder,
    isReplacing,
}: {
    projectDir: string;
    plugin: PluginSettingsDescriptor;
    onPluginUpdated: (plugin: PluginSettingsDescriptor) => void;
    backendClient: ReturnType<typeof useBackendClient>;
    onReplaceFromFolder: () => void;
    isReplacing: boolean;
}) {
    const manifestSettings = useMemo(
        () =>
            Array.isArray((plugin.manifest as any)?.settings)
                ? ((plugin.manifest as any).settings as Array<any>)
                : [],
        [plugin.manifest]
    );

    const [draft, setDraft] = useState<Record<string, unknown>>(
        () => ({ ...((plugin.settings ?? {}) as Record<string, unknown>) })
    );
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [savedAt, setSavedAt] = useState<number | null>(null);

    const handleSave = async () => {
        setSaveError(null);
        setSaving(true);
        try {
            const updated = await backendClient.updateProjectPluginSettings(
                plugin.id,
                draft
            );
            onPluginUpdated(updated);
            setSavedAt(Date.now());
        } catch (error) {
            setSaveError(error instanceof Error ? error.message : String(error));
        } finally {
            setSaving(false);
        }
    };

    const setField = (key: string, value: unknown) => {
        setDraft((prev) => ({
            ...prev,
            [key]: value,
        }));
    };

    return (
        <div className="border rounded-lg p-4 space-y-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                    <p className="font-medium text-lg">{plugin.name}</p>
                    <p className="text-sm text-muted-foreground">ID: {plugin.id}</p>
                </div>
                <div className="flex items-center gap-2">
                    <p className="text-sm text-muted-foreground">v{plugin.version}</p>
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={onReplaceFromFolder}
                        disabled={isReplacing}
                    >
                        Replace From Folder
                    </Button>
                </div>
            </div>

            {manifestSettings.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                    This plugin does not declare configurable settings.
                </p>
            ) : (
                <div className="space-y-4">
                    {manifestSettings.map((setting: any) => {
                        const key = String(setting?.name ?? "");
                        if (!key) {
                            return null;
                        }

                        const label = String(setting?.title ?? key);
                        const description =
                            setting?.description !== undefined
                                ? String(setting.description)
                                : undefined;
                        const defaultValue =
                            setting?.default !== undefined ? setting.default : null;
                        const currentValue =
                            draft[key] !== undefined ? draft[key] : defaultValue;

                        return (
                            <div key={`${plugin.id}-${key}`} className="space-y-1">
                                <Label className="text-sm font-medium">{label}</Label>
                                {description ? (
                                    <p className="text-xs text-muted-foreground">{description}</p>
                                ) : null}
                                <SettingInput
                                    type={String(setting?.type ?? "string")}
                                    value={currentValue}
                                    onChange={(value) => setField(key, value)}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Type: {String(setting?.type ?? "unknown")}
                                </p>
                            </div>
                        );
                    })}

                    <div className="flex items-center gap-3 pt-2">
                        <Button type="button" size="sm" onClick={handleSave} disabled={saving}>
                            {saving ? "Saving..." : "Save settings"}
                        </Button>
                        {savedAt && !saveError ? (
                            <p className="text-xs text-muted-foreground">
                                Saved at {new Date(savedAt).toLocaleTimeString()}
                            </p>
                        ) : null}
                    </div>

                    {saveError ? <p className="text-sm text-red-600">{saveError}</p> : null}
                </div>
            )}
        </div>
    );
}

function SettingInput({
    type,
    value,
    onChange,
}: {
    type: string;
    value: unknown;
    onChange: (value: unknown) => void;
}) {
    if (type === "boolean") {
        return (
            <div className="pt-1">
                <Switch
                    checked={Boolean(value)}
                    onCheckedChange={(checked) => onChange(checked)}
                />
            </div>
        );
    }

    if (type === "number") {
        return (
            <Input
                type="number"
                value={typeof value === "number" ? String(value) : ""}
                onChange={(event) => {
                    const raw = event.target.value;
                    if (raw.trim() === "") {
                        onChange(null);
                        return;
                    }
                    const parsed = Number(raw);
                    onChange(Number.isNaN(parsed) ? null : parsed);
                }}
            />
        );
    }

    return (
        <Input
            type="text"
            value={value === null || value === undefined ? "" : String(value)}
            onChange={(event) => onChange(event.target.value)}
        />
    );
}
