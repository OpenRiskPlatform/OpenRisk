import { Badge } from "@/components/ui/badge";
import type { PluginMetricValue, PluginRecord, SettingValue } from "@/core/backend/bindings";
import { Activity } from "lucide-react";

interface PluginMetricsStripProps {
    plugin: PluginRecord;
    compact?: boolean;
}

const STATUS_METRIC_NAME = "status";

function settingValueToDisplay(value: SettingValue | undefined | null): string {
    if (!value || value.type === "null") return "—";
    // SettingValue has { type, value? } shape; type === "null" handled above.
    if ("value" in value) {
        return String(value.value);
    }
    return "—";
}

function statusTone(status: string): string {
    const s = status.toLowerCase();
    if (s === "ok" || s === "ready" || s === "healthy" || s === "active") {
        return "border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";
    }
    if (s === "warn" || s === "warning" || s === "degraded") {
        return "border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300";
    }
    if (s === "error" || s === "failed" || s === "down") {
        return "border-red-300 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300";
    }
    return "border-border bg-muted/40 text-muted-foreground";
}

export function PluginMetricsStrip({ plugin, compact = false }: PluginMetricsStripProps) {
    const valuesByName: Record<string, PluginMetricValue> = {};
    for (const mv of plugin.metricValues ?? []) {
        valuesByName[mv.name] = mv;
    }

    // Build display metrics: declared metric defs + the builtin "status" metric
    // (which may be present in metricValues even if not in metricDefs).
    const defs = plugin.metricDefs ?? [];
    const orderedNames: string[] = [];
    if (valuesByName[STATUS_METRIC_NAME] || defs.some((d) => d.name === STATUS_METRIC_NAME)) {
        orderedNames.push(STATUS_METRIC_NAME);
    }
    for (const def of defs) {
        if (def.name === STATUS_METRIC_NAME) continue;
        orderedNames.push(def.name);
    }

    if (!orderedNames.length) {
        return (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Activity className="h-3.5 w-3.5" />
                <span>No metrics declared</span>
            </div>
        );
    }

    return (
        <div className={`flex flex-wrap items-center gap-1.5 ${compact ? "" : "py-1"}`}>
            {orderedNames.map((name) => {
                const mv = valuesByName[name];
                const def = defs.find((d) => d.name === name);
                const title = mv?.title ?? def?.title ?? name;
                const display = settingValueToDisplay(mv?.value);
                const isStatus = name === STATUS_METRIC_NAME;

                if (isStatus) {
                    return (
                        <span
                            key={name}
                            className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium ${statusTone(display)}`}
                            title={def?.description ?? title}
                        >
                            <Activity className="h-3 w-3" />
                            {title}: {display}
                        </span>
                    );
                }

                return (
                    <Badge
                        key={name}
                        variant="outline"
                        className="text-[11px] font-normal"
                        title={def?.description ?? title}
                    >
                        <span className="text-muted-foreground mr-1">{title}:</span>
                        <span className="font-medium text-foreground">{display}</span>
                    </Badge>
                );
            })}
        </div>
    );
}

