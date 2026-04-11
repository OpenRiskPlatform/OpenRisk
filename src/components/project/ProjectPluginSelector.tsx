import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { PluginRecord } from "@/core/backend/bindings";
import { ProjectPluginCard } from "@/components/project/ProjectPluginCard";

interface ProjectPluginSelectorProps {
    plugins: PluginRecord[];
    selectedPluginId: string | null;
    onSelect: (pluginId: string) => void;
}

export function ProjectPluginSelector({
    plugins,
    selectedPluginId,
    onSelect,
}: ProjectPluginSelectorProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Select Plugin</CardTitle>
                <CardDescription>
                    Choose one plugin for this scan, then enable the entrypoints you want to run.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {!plugins.length ? (
                    <p className="text-sm text-muted-foreground">
                        No enabled plugins available. Open Settings to install and enable a plugin.
                    </p>
                ) : (
                    <ScrollArea className="max-h-[420px]">
                        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4 pr-3">
                            {plugins.map((plugin) => (
                                <ProjectPluginCard
                                    key={plugin.id}
                                    plugin={plugin}
                                    selected={selectedPluginId === plugin.id}
                                    onSelect={onSelect}
                                />
                            ))}
                        </div>
                    </ScrollArea>
                )}
            </CardContent>
        </Card>
    );
}
