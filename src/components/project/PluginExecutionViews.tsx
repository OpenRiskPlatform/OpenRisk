import { useState } from "react";
import { AlertTriangle, ChevronDown, ChevronUp, Terminal } from "lucide-react";
import type { PluginMetricValue, SettingValue } from "@/core/backend/bindings";

export interface PluginLogEntry {
    level: "log" | "warn" | "error";
    message: string;
}

export function PluginErrorView({ message }: { message: string }) {
    const [expanded, setExpanded] = useState(false);
    const stackStart = message.search(/ at (?:async )?[A-Za-z]/);
    const summary = stackStart !== -1 ? message.slice(0, stackStart).trim() : message;
    const stack = stackStart !== -1 ? message.slice(stackStart).trim() : null;

    return (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 space-y-2">
            <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                <p className="text-sm font-medium text-red-700 leading-snug">{summary}</p>
            </div>
            {stack ? (
                <button
                    className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600"
                    onClick={() => setExpanded((v) => !v)}
                >
                    {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    {expanded ? "Hide stack trace" : "Show stack trace"}
                </button>
            ) : null}
            {expanded && stack ? (
                <pre className="text-xs text-red-500 whitespace-pre-wrap break-all bg-red-100 rounded p-2 overflow-auto max-h-48">
                    {stack}
                </pre>
            ) : null}
        </div>
    );
}

export function PluginLogsView({ logs }: { logs: PluginLogEntry[] }) {
    const [expanded, setExpanded] = useState(false);
    if (!logs.length) return null;

    const warnCount = logs.filter((l) => l.level === "warn").length;
    const errorCount = logs.filter((l) => l.level === "error").length;
    const badge =
        errorCount > 0
            ? `${errorCount} error${errorCount > 1 ? "s" : ""}`
            : warnCount > 0
                ? `${warnCount} warning${warnCount > 1 ? "s" : ""}`
                : `${logs.length} log${logs.length > 1 ? "s" : ""}`;

    const levelColor = (level: string) =>
        level === "error"
            ? "text-red-500"
            : level === "warn"
                ? "text-yellow-600"
                : "text-muted-foreground";

    return (
        <div className="mt-2">
            <button
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setExpanded((v) => !v)}
            >
                <Terminal className="h-3.5 w-3.5" />
                <span>Logs ({badge})</span>
                {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
            {expanded ? (
                <div className="mt-1.5 rounded border bg-muted/30 p-2 max-h-48 overflow-auto space-y-0.5">
                    {logs.map((entry, i) => (
                        <div key={i} className={`flex gap-2 text-xs font-mono ${levelColor(entry.level)}`}>
                            <span className="shrink-0 w-12 opacity-60">[{entry.level}]</span>
                            <span className="break-all">{entry.message}</span>
                        </div>
                    ))}
                </div>
            ) : null}
        </div>
    );
}

function metricValueToText(value: SettingValue): string {
    if (value.type === "null") {
        return "null";
    }
    return String(value.value);
}

export function PluginMetricsView({ metrics }: { metrics: PluginMetricValue[] }) {
    const [expanded, setExpanded] = useState(true);
    const count = metrics.length;

    return (
        <div className="mt-2">
            <button
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setExpanded((v) => !v)}
            >
                <span>Stats ({count})</span>
                {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
            {expanded ? (
                <div className="mt-1.5 rounded border bg-muted/20 p-2 space-y-1">
                    {metrics.length > 0 ? (
                        metrics.map((metric) => (
                            <div key={metric.name} className="grid grid-cols-[1fr_auto] gap-2 text-xs items-start">
                                <div>
                                    <div className="font-medium">{metric.title}</div>
                                    <div className="text-muted-foreground">
                                        {metric.name} • {metric.type.name}
                                    </div>
                                    {metric.description ? (
                                        <div className="text-muted-foreground">{metric.description}</div>
                                    ) : null}
                                </div>
                                <div className="font-mono text-foreground rounded bg-muted px-2 py-0.5">
                                    {metricValueToText(metric.value)}
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="text-xs text-muted-foreground">No stats emitted by plugin for this run.</p>
                    )}
                </div>
            ) : null}
        </div>
    );
}
