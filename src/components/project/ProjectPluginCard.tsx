import { Badge } from "@/components/ui/badge";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import type { PluginRecord } from "@/core/backend/bindings";
import { Info, Puzzle } from "lucide-react";

interface ProjectPluginCardProps {
    plugin: PluginRecord;
    selected: boolean;
    onSelect: (pluginId: string) => void;
    disabled?: boolean;
}

export function ProjectPluginCard({
    plugin,
    selected,
    onSelect,
    disabled = false,
}: ProjectPluginCardProps) {

    return (
        <Card
            role="button"
            tabIndex={0}
            className={`transition-all ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:shadow-md"} ${
                selected ? "ring-2 ring-primary border-primary" : ""
            }`}
            onClick={() => !disabled && onSelect(plugin.id)}
            onKeyDown={(event) => {
                if (!disabled && (event.key === "Enter" || event.key === " ")) {
                    event.preventDefault();
                    onSelect(plugin.id);
                }
            }}
        >
            <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border bg-muted text-muted-foreground">
                        <Puzzle className="h-5 w-5" />
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
            <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground line-clamp-2">
                    {plugin.manifest.description}
                </p>

                {plugin.status && !/used/i.test(plugin.status) ? (
                    <div className="flex items-center gap-1.5 rounded-md bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 px-2.5 py-1.5">
                        <Info className="h-3.5 w-3.5 shrink-0 text-sky-500" />
                        <span className="text-xs font-medium text-sky-700 dark:text-sky-300 truncate">{plugin.status}</span>
                    </div>
                ) : null}

                <Badge className="mt-1" variant={selected ? "default" : "outline"}>
                    {selected ? "Selected" : "Select"}
                </Badge>
            </CardContent>
        </Card>
    );
}
