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
        <Card className="overflow-hidden rounded-[28px] border border-border/70 bg-card shadow-[0_18px_40px_-28px_rgba(15,23,42,0.18)]">
            <CardHeader className="border-b bg-muted/[0.12] px-6 py-5">
                <CardTitle>Select Plugin</CardTitle>
                <CardDescription>
                    Choose one plugin for this scan, then enable the entrypoints you want to run.
                </CardDescription>
            </CardHeader>
            <CardContent className="px-6 py-6">
                {!plugins.length ? (
                    <p className="text-sm text-muted-foreground">
                        No enabled plugins available. Open Settings to install and enable a plugin.
                    </p>
                ) : (
                    <ScrollArea className="max-h-[420px] rounded-[22px] border border-border/70 bg-background/80">
                        <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
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
