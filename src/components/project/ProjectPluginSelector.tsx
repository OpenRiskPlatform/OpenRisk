import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import type { PluginRecord } from "@/core/backend/bindings";
import { ProjectPluginCard } from "@/components/project/ProjectPluginCard";

interface ProjectPluginSelectorProps {
    plugins: PluginRecord[];
    selectedPluginId: string | null;
    onSelect: (pluginId: string) => void;
    disabled?: boolean;
}

export function ProjectPluginSelector({
    plugins,
    selectedPluginId,
    onSelect,
    disabled = false,
}: ProjectPluginSelectorProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">Select Plugin</CardTitle>
                <CardDescription>
                    Choose which plugin to use for this scan.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {!plugins.length ? (
                    <p className="text-sm text-muted-foreground">
                        No enabled plugins available. Open Settings to install and enable a plugin.
                    </p>
                ) : (
                    <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {plugins.map((plugin) => (
                                <ProjectPluginCard
                                    key={plugin.id}
                                    plugin={plugin}
                                    selected={selectedPluginId === plugin.id}
                                    disabled={disabled}
                                    onSelect={onSelect}
                                />
                            ))}
                        </div>
                        <p className="text-xs text-muted-foreground mt-3">
                            Select a plugin, then enable the entrypoints you want to run below.
                        </p>
                    </>
                )}
            </CardContent>
        </Card>
    );
}
