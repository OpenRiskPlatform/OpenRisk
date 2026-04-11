import { Badge } from "@/components/ui/badge";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import type { PluginRecord } from "@/core/backend/bindings";
import { Puzzle } from "lucide-react";

interface ProjectPluginCardProps {
    plugin: PluginRecord;
    selected: boolean;
    onSelect: (pluginId: string) => void;
}

export function ProjectPluginCard({
    plugin,
    selected,
    onSelect,
}: ProjectPluginCardProps) {
    const entrypointCount = plugin.entrypoints.length;
    const iconSrc = resolvePluginIconSrc(plugin.manifest.icon);
    const initials = plugin.name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join("") || plugin.id.slice(0, 2).toUpperCase();

    return (
        <Card
            role="button"
            tabIndex={0}
            className={`flex min-h-[220px] cursor-pointer flex-col transition-all hover:shadow-md ${
                selected ? "border-primary bg-primary/5 shadow-sm" : ""
            }`}
            onClick={() => onSelect(plugin.id)}
            onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect(plugin.id);
                }
            }}
        >
            <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
                        {iconSrc ? (
                            <img
                                src={iconSrc}
                                alt={`${plugin.name} icon`}
                                className="h-full w-full object-cover"
                            />
                        ) : (
                            <div className="flex h-full w-full flex-col items-center justify-center bg-muted/70 text-[10px] font-semibold text-muted-foreground">
                                <Puzzle className="mb-0.5 h-3.5 w-3.5" />
                                <span className="leading-none">{initials}</span>
                            </div>
                        )}
                    </div>
                    <div className="min-w-0 flex-1">
                        <CardTitle className="line-clamp-2 text-base leading-tight">
                            {plugin.name}
                        </CardTitle>
                        <CardDescription className="mt-0.5 text-xs">
                            v{plugin.version}
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col justify-between space-y-3">
                <p className="line-clamp-2 text-sm text-muted-foreground">
                    {plugin.manifest.description}
                </p>
                <div className="space-y-3">
                    <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Entrypoints</span>
                            <span className="font-medium text-foreground">
                                {entrypointCount}
                            </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                            <div
                                className={`h-full rounded-full transition-all ${
                                    selected ? "bg-primary" : "bg-foreground/60"
                                }`}
                                style={{
                                    width: `${Math.min(100, Math.max(22, entrypointCount * 18))}%`,
                                }}
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-[11px] text-muted-foreground">
                            {plugin.id}
                        </p>
                        <Badge
                            className="shrink-0"
                            variant={selected ? "default" : "outline"}
                        >
                            {selected ? "Selected" : "Select"}
                        </Badge>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function resolvePluginIconSrc(icon: string | null): string | null {
    if (!icon) {
        return null;
    }

    if (
        icon.startsWith("http://") ||
        icon.startsWith("https://") ||
        icon.startsWith("data:image/") ||
        icon.startsWith("/")
    ) {
        return icon;
    }

    return null;
}
