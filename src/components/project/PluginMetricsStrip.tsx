import { Badge } from "@/components/ui/badge";
import type { PluginMetricValue, PluginRecord, SettingValue } from "@/core/backend/bindings";
import { Activity } from "lucide-react";

interface PluginMetricsStripProps {
    plugin: PluginRecord;
    compact?: boolean;
}

const STATUS_METRIC_NAME = "status";

function settingValueToDisplay(value: SettingValue | undefined | null): string {
    if (!value || value.type === "null") return "";
    if ("value" in value) {
        return String(value.value);
    }
    return "";
}

function hasValue(mv: PluginMetricValue | undefined): boolean {
    if (!mv) return false;
    const display = settingValueToDisplay(mv.value);
    return display.length > 0 && display !== "—";
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

    const statusMv = valuesByName[STATUS_METRIC_NAME];
    const statusDisplay = statusMv ? settingValueToDisplay(statusMv.value) : "";

    // Only show other metrics if there's a status value set
    const defs = plugin.metricDefs ?? [];
    const otherMetrics = defs
        .filter((d) => d.name !== STATUS_METRIC_NAME)
        .filter((d) => hasValue(valuesByName[d.name]));

    // Nothing to show at all
    if (!statusDisplay && !otherMetrics.length) {
        return null;
    }

    return (
        <div className={`flex flex-wrap items-center gap-1.5 ${compact ? "" : "py-1"}`}>
            {statusDisplay ? (
                <span
                    key={STATUS_METRIC_NAME}
                    className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium ${statusTone(statusDisplay)}`}
                    title={statusMv?.description ?? "Status"}
                >
                    <Activity className="h-3 w-3" />
                    {statusMv?.title ?? "Status"}: {statusDisplay}
                </span>
            ) : null}

            {otherMetrics.map((def) => {
                const mv = valuesByName[def.name];
                const display = settingValueToDisplay(mv?.value);
                return (
                    <Badge
                        key={def.name}
                        variant="outline"
                        className="text-[11px] font-normal"
                        title={def.description ?? def.title}
                    >
                        <span className="text-muted-foreground mr-1">{def.title}:</span>
                        <span className="font-medium text-foreground">{display}</span>
                    </Badge>
                );
            })}
        </div>
    );
}
