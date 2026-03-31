/**
 * Plugin Settings Panel
 */

import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { useBackendClient } from "@/hooks/useBackendClient";
import { unwrap } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import type {
    PluginRecord,
    ProjectSettingsRecord,
    SettingValue,
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
            const payload = await unwrap(backendClient.upsertProjectPluginFromDir(selected, replacePluginId ?? null));
            onPluginUpdated(payload);
        } catch (error) {
            setImportError(error instanceof Error ? error.message : String(error));
        } finally {
            setImporting(false);
        }
    };

    const pickAndImportPluginZip = async (replacePluginId?: string) => {
        if (!projectDir) {
            return;
        }

        setImportError(null);

        const selected = await open({
            directory: false,
            multiple: false,
            filters: [{ name: "Plugin Archive", extensions: ["zip"] }],
            title: replacePluginId ? "Select replacement plugin archive" : "Select plugin archive (.zip)",
        });

        if (!selected || Array.isArray(selected)) {
            return;
        }

        setImporting(true);
        try {
            const payload = await unwrap(backendClient.upsertProjectPluginFromZip(selected, replacePluginId ?? null));
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
                            Add or replace a plugin from a folder or .zip archive.
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
                            projectDir={projectDir}
                            plugin={plugin}
                            onPluginUpdated={onPluginUpdated}
                            backendClient={backendClient}
                            onReplaceFromFolder={() => pickAndImportPlugin(plugin.id)}
                            onReplaceFromZip={() => pickAndImportPluginZip(plugin.id)}
                            isReplacing={importing}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function unknownToSettingValue(v: unknown): SettingValue {
    if (v === null || v === undefined) return { type: "null" };
    if (typeof v === "boolean") return { type: "boolean", value: v };
    if (typeof v === "number") return { type: "number", value: v };
    return { type: "string", value: String(v) };
}

function PluginSettingsCard({
    plugin,
    onPluginUpdated,
    backendClient,
    onReplaceFromFolder,
    onReplaceFromZip,
    isReplacing,
}: {
    projectDir: string;
    plugin: PluginRecord;
    onPluginUpdated: (plugin: PluginRecord) => void;
    backendClient: ReturnType<typeof useBackendClient>;
    onReplaceFromFolder: () => void;
    onReplaceFromZip: () => void;
    isReplacing: boolean;
}) {
    const [draft, setDraft] = useState<Record<string, unknown>>(() => {
        const r: Record<string, unknown> = {};
        for (const sv of plugin.settingValues) {
            r[sv.name] = sv.value.type === "null" ? null : sv.value.value;
        }
        return r;
    });
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [savedAt, setSavedAt] = useState<number | null>(null);

    const handleSave = async () => {
        setSaveError(null);
        setSaving(true);
        try {
            let result: PluginRecord | undefined;
            for (const [name, rawValue] of Object.entries(draft)) {
                result = await unwrap(backendClient.setPluginSetting(
                    plugin.id,
                    name,
                    unknownToSettingValue(rawValue),
                ));
            }
            if (result) onPluginUpdated(result);
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
                <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm text-muted-foreground">v{plugin.version}</p>
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={onReplaceFromFolder}
                        disabled={isReplacing}
                    >
                        Replace Folder
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={onReplaceFromZip}
                        disabled={isReplacing}
                    >
                        Replace ZIP
                    </Button>
                </div>
            </div>

            {plugin.settingDefs.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                    This plugin does not declare configurable settings.
                </p>
            ) : (
                <div className="space-y-4">
                    {plugin.settingDefs.map((setting) => {
                        const defaultValue =
                            setting.defaultValue === null || setting.defaultValue.type === "null"
                                ? null
                                : setting.defaultValue.value;
                        const currentValue =
                            draft[setting.name] !== undefined ? draft[setting.name] : defaultValue;

                        return (
                            <div key={`${plugin.id}-${setting.name}`} className="space-y-1">
                                <Label className="text-sm font-medium">{setting.title}</Label>
                                {setting.description ? (
                                    <p className="text-xs text-muted-foreground">{setting.description}</p>
                                ) : null}
                                <SettingInput
                                    typeName={setting.type.name}
                                    options={setting.type.name === "enum" ? setting.type.values ?? undefined : undefined}
                                    value={currentValue}
                                    onChange={(value) => setField(setting.name, value)}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Type: {setting.type.name}
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
    typeName,
    options,
    value,
    onChange,
}: {
    typeName: string;
    options?: string[];
    value: unknown;
    onChange: (value: unknown) => void;
}) {
    if (options && options.length > 0) {
        const strValue = value === null || value === undefined ? "" : String(value);
        return (
            <Select value={strValue || options[0]} onValueChange={(v) => onChange(v)}>
                <SelectTrigger>
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {options.map((opt) => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        );
    }

    if (typeName === "boolean") {
        return (
            <div className="pt-1">
                <Switch
                    checked={Boolean(value)}
                    onCheckedChange={(checked) => onChange(checked)}
                />
            </div>
        );
    }

    if (typeName === "number" || typeName === "integer") {
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

    if (typeName === "date") {
        return (
            <Input
                type="date"
                value={value === null || value === undefined ? "" : String(value)}
                onChange={(event) => onChange(event.target.value)}
            />
        );
    }

    if (typeName === "url") {
        return (
            <Input
                type="url"
                value={value === null || value === undefined ? "" : String(value)}
                onChange={(event) => onChange(event.target.value)}
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
