import type { DataModelEntity, DataModelResult } from "@/core/data-model/types";
import { EntityCard } from "./EntityCard";
import { RiskTopicGroupCard } from "./RiskTopicGroupCard";

interface PluginResultViewProps {
    entities: DataModelResult;
}

type RenderItem =
    | { type: "single"; entity: DataModelEntity }
    | { type: "riskTopicGroup"; topics: DataModelEntity[] };

function buildRenderItems(entities: DataModelResult): RenderItem[] {
    const items: RenderItem[] = [];
    let i = 0;
    while (i < entities.length) {
        if (entities[i].$entity === "entity.riskTopic") {
            const group: DataModelEntity[] = [];
            while (i < entities.length && entities[i].$entity === "entity.riskTopic") {
                group.push(entities[i]);
                i++;
            }
            items.push({ type: "riskTopicGroup", topics: group });
        } else {
            items.push({ type: "single", entity: entities[i] });
            i++;
        }
    }
    return items;
}

export function PluginResultView({ entities }: PluginResultViewProps) {
    if (!entities.length) {
        return (
            <p className="text-muted-foreground text-center py-8">No entities in result</p>
        );
    }

    const items = buildRenderItems(entities);

    return (
        <div className="space-y-4">
            {items.map((item, idx) => {
                if (item.type === "riskTopicGroup") {
                    return (
                        <RiskTopicGroupCard
                            key={`riskTopicGroup-${idx}`}
                            topics={item.topics}
                        />
                    );
                }
                return (
                    <EntityCard
                        key={`${item.entity.$entity}-${item.entity.$id}`}
                        entity={item.entity}
                    />
                );
            })}
        </div>
    );
}

