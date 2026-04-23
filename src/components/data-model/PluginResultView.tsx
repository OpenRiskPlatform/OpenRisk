import type { DataModelEntity, DataModelResult } from "@/core/data-model/types";
import { EntityCard } from "./EntityCard";
import { EntityTableSection } from "./EntityTableSection";
import { ORGANIZATION_TABLE_COLUMNS, PERSON_TABLE_COLUMNS } from "./entityTableConfigs";
import { OrganizationCard } from "./OrganizationCard";
import { PersonEntityCard } from "./PersonEntityCard";
import { RiskTopicGroupCard } from "./RiskTopicGroupCard";

interface PluginResultViewProps {
    entities: DataModelResult;
    flat?: boolean;
    hideFavorite?: boolean;
}

type RenderItem =
    | { type: "single"; entity: DataModelEntity }
    | { type: "personTable"; entities: DataModelEntity[] }
    | { type: "organizationTable"; entities: DataModelEntity[] }
    | { type: "riskTopicGroup"; topics: DataModelEntity[] };

function buildRenderItems(entities: DataModelResult): RenderItem[] {
    const items: RenderItem[] = [];
    const personEntities = entities.filter((entity) => entity.$entity === "entity.person");
    const organizationEntities = entities.filter((entity) => entity.$entity === "entity.organization");
    const riskTopics = entities.filter((entity) => entity.$entity === "entity.riskTopic");

    let personSectionAdded = false;
    let organizationSectionAdded = false;
    let riskTopicGroupAdded = false;

    for (const entity of entities) {
        if (entity.$entity === "entity.person") {
            if (!personSectionAdded) {
                items.push({ type: "personTable", entities: personEntities });
                personSectionAdded = true;
            }
            continue;
        }

        if (entity.$entity === "entity.organization") {
            if (!organizationSectionAdded) {
                items.push({ type: "organizationTable", entities: organizationEntities });
                organizationSectionAdded = true;
            }
            continue;
        }

        if (entity.$entity === "entity.riskTopic") {
            if (!riskTopicGroupAdded) {
                items.push({ type: "riskTopicGroup", topics: riskTopics });
                riskTopicGroupAdded = true;
            }
            continue;
        }

        items.push({ type: "single", entity });
    }
    return items;
}

export function PluginResultView({ entities, flat = false, hideFavorite = false }: PluginResultViewProps) {
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
                if (item.type === "personTable") {
                    return (
                        <EntityTableSection
                            key={`personTable-${idx}`}
                            entityType="entity.person"
                            title="Person"
                            entities={item.entities}
                            columns={PERSON_TABLE_COLUMNS}
                            renderExpanded={(entity) => <PersonEntityCard entity={entity} />}
                            flat={flat}
                            hideFavorite={hideFavorite}
                        />
                    );
                }
                if (item.type === "organizationTable") {
                    return (
                        <EntityTableSection
                            key={`organizationTable-${idx}`}
                            entityType="entity.organization"
                            title="Organization"
                            entities={item.entities}
                            columns={ORGANIZATION_TABLE_COLUMNS}
                            renderExpanded={(entity) => <OrganizationCard entity={entity} />}
                            flat={flat}
                            hideFavorite={hideFavorite}
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
