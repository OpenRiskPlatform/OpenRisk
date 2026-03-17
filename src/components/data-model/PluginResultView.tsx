import type { DataModelResult } from "@/core/data-model/types";
import { EntityCard } from "./EntityCard";

interface PluginResultViewProps {
    entities: DataModelResult;
}

export function PluginResultView({ entities }: PluginResultViewProps) {
    if (!entities.length) {
        return (
            <p className="text-muted-foreground text-center py-8">No entities in result</p>
        );
    }

    return (
        <div className="space-y-4">
            {entities.map((entity) => (
                <EntityCard key={`${entity.$entity}-${entity.$id}`} entity={entity} />
            ))}
        </div>
    );
}
