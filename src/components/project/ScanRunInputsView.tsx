import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ScanDetailRecord, SettingValue } from "@/core/backend/bindings";

function settingValueToText(value: SettingValue): string {
    switch (value.type) {
        case "null":
            return "—";
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

export function ScanRunInputsView({ scanDetail }: ScanRunInputsViewProps) {
    if (!scanDetail.selectedPlugins.length) return null;

    // Deduplicate inputs by field name — first non-null value wins
    const seen = new Map<string, string>();
    for (const input of scanDetail.inputs) {
        if (!seen.has(input.fieldName) && input.value.type !== "null") {
            seen.set(input.fieldName, settingValueToText(input.value));
        }
    }

    if (seen.size === 0) return null;

    return (
        <Card className="border-dashed">
            <CardHeader className="pb-2">
                <CardTitle className="text-base">Used Inputs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
                {Array.from(seen.entries()).map(([fieldName, value]) => (
                    <div key={fieldName} className="flex gap-2">
                        <span className="text-muted-foreground min-w-32 shrink-0">
                            {fieldName}:
                        </span>
                        <span className="break-all font-medium">{value}</span>
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}
