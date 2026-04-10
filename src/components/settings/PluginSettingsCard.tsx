import { useState } from "react";
import { unwrap } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { TypedSettingInput } from "@/components/settings/TypedSettingInput";
import type { PluginRecord, SettingValue } from "@/core/backend/bindings";
import { useBackendClient } from "@/hooks/useBackendClient";

function unknownToSettingValue(v: unknown): SettingValue {
    if (v === null || v === undefined) return { type: "null" };
    if (typeof v === "boolean") return { type: "boolean", value: v };
    if (typeof v === "number") return { type: "number", value: v };
    return { type: "string", value: String(v) };
}

interface PluginSettingsCardProps {
    plugin: PluginRecord;
    onPluginUpdated: (plugin: PluginRecord) => void;
    backendClient: ReturnType<typeof useBackendClient>;
}

export function PluginSettingsCard({
    plugin,
    onPluginUpdated,
    backendClient,
}: PluginSettingsCardProps) {
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
                result = await unwrap(
                    backendClient.setPluginSetting(
                        plugin.id,
                        name,
                        unknownToSettingValue(rawValue),
                    ),
                );
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
                                <TypedSettingInput
                                    typeName={setting.type.name}
                                    options={setting.type.name === "enum" ? setting.type.values ?? undefined : undefined}
                                    value={currentValue}
                                    onChange={(value) => setField(setting.name, value)}
                                    emptyAsNull
                                />
                                <p className="text-xs text-muted-foreground">Type: {setting.type.name}</p>
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
