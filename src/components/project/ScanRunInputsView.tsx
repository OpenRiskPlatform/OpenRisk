import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ScanDetailRecord, ScanEntrypointInput, SettingValue } from "@/core/backend/bindings";

function settingValueToText(value: SettingValue): string {
    switch (value.type) {
        case "null":
            return "null";
        case "boolean":
            return value.value ? "true" : "false";
        case "number":
            return String(value.value);
        case "string":
            return value.value;
        default:
            return "";
    }
}

interface ScanRunInputsViewProps {
    scanDetail: ScanDetailRecord;
    pluginNameById: Record<string, string>;
}

export function ScanRunInputsView({ scanDetail, pluginNameById }: ScanRunInputsViewProps) {
    const groupedInputs = new Map<string, ScanEntrypointInput[]>();
    for (const input of scanDetail.inputs) {
        const key = `${input.pluginId}::${input.entrypointId}`;
        const list = groupedInputs.get(key) ?? [];
        list.push(input);
        groupedInputs.set(key, list);
    }

    if (!scanDetail.selectedPlugins.length) {
        return null;
    }

    return (
        <Card className="border-dashed">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm">Run inputs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
                {scanDetail.selectedPlugins.map((sel) => {
                    const key = `${sel.pluginId}::${sel.entrypointId}`;
                    const inputs = groupedInputs.get(key) ?? [];
                    return (
                        <div key={key} className="rounded border bg-muted/20 p-2">
                            <p className="font-medium">
                                {pluginNameById[sel.pluginId] ?? sel.pluginId}
                                <span className="ml-2 text-xs text-muted-foreground">/{sel.entrypointId}</span>
                            </p>
                            {inputs.length ? (
                                <div className="mt-1 space-y-0.5 text-xs">
                                    {inputs.map((input) => (
                                        <div key={`${key}::${input.fieldName}`} className="flex gap-2">
                                            <span className="text-muted-foreground min-w-28">{input.fieldName}:</span>
                                            <span className="break-all">{settingValueToText(input.value)}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="mt-1 text-xs text-muted-foreground">No input values</p>
                            )}
                        </div>
                    );
                })}
            </CardContent>
        </Card>
    );
}
