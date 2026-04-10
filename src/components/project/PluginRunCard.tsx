import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { TypedSettingInput } from "@/components/settings/TypedSettingInput";
import type { PluginRecord } from "@/core/backend/bindings";

interface PluginRunCardProps {
    plugin: PluginRecord;
    enabledEntrypoints: Record<string, boolean>;
    onEntrypointChange: (entrypointId: string, enabled: boolean) => void;
    entrypointInputs: Record<string, Record<string, unknown>>;
    onFieldChange: (entrypointId: string, fieldName: string, value: unknown) => void;
}

export function PluginRunCard({
    plugin,
    enabledEntrypoints,
    onEntrypointChange,
    entrypointInputs,
    onFieldChange,
}: PluginRunCardProps) {
    const entrypoints = plugin.entrypoints;
    const inputDefs = plugin.inputDefs;

    return (
        <div className="rounded-lg border bg-card p-3">
            <div className="mb-2">
                <p className="text-sm font-semibold">{plugin.name}</p>
                <p className="text-xs text-muted-foreground">{plugin.id}</p>
            </div>

            <div className="space-y-2">
                {entrypoints.map((ep) => {
                    const inputsForEntrypoint = inputDefs.filter((input) => input.entrypointId === ep.id);
                    return (
                        <div key={ep.id}>
                            <div className="flex items-center justify-between gap-2">
                                <div>
                                    <p className="text-sm">{ep.name}</p>
                                    {ep.description ? (
                                        <p className="text-xs text-muted-foreground">{ep.description}</p>
                                    ) : null}
                                </div>
                                <Switch
                                    checked={Boolean(enabledEntrypoints[ep.id])}
                                    onCheckedChange={(enabled) => onEntrypointChange(ep.id, enabled)}
                                />
                            </div>
                            {Boolean(enabledEntrypoints[ep.id]) && inputsForEntrypoint.length > 0 ? (
                                <div className="mt-2 space-y-2 pl-3 border-l-2 border-border/40">
                                    {inputsForEntrypoint.map((input) => {
                                        const current = entrypointInputs[ep.id]?.[input.name];
                                        const options =
                                            input.type.name === "enum"
                                                ? input.type.values ?? undefined
                                                : undefined;
                                        return (
                                            <div key={`${ep.id}-${input.name}`} className="space-y-1">
                                                <Label className="text-sm">{input.title}</Label>
                                                {input.description ? (
                                                    <p className="text-xs text-muted-foreground">{input.description}</p>
                                                ) : null}
                                                <TypedSettingInput
                                                    typeName={input.type.name}
                                                    value={current}
                                                    options={options}
                                                    onChange={(value) => onFieldChange(ep.id, input.name, value)}
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : null}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
