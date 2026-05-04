import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { DataModelEntity, DataModelResult } from "@/core/data-model/types";
import { EntityCard } from "./EntityCard";
import { EntityTableSection } from "./EntityTableSection";
import { buildDynamicColumns } from "./entityTableConfigs";
import { RiskTopicGroupCard } from "./RiskTopicGroupCard";
import { PersonEntityInline, OrganizationInline } from "./EntityInlineDetail";
import { EntityTypeBadge } from "./EntityTypeBadge";

interface PluginResultViewProps {
    entities: DataModelResult;
    flat?: boolean;
    hideFavorite?: boolean;
}
type RenderItem =
    | { type: "otherGroup"; entities: DataModelEntity[] }
    | { type: "personInline"; entity: DataModelEntity }
    | { type: "orgInline"; entity: DataModelEntity }
    | { type: "personTable"; entities: DataModelEntity[] }
    | { type: "organizationTable"; entities: DataModelEntity[] }
    | { type: "riskTopicGroup"; topics: DataModelEntity[] };
function buildRenderItems(entities: DataModelResult): RenderItem[] {
    const items: RenderItem[] = [];
    const personEntities = entities.filter((e) => e.$entity === "entity.person");
    const organizationEntities = entities.filter((e) => e.$entity === "entity.organization");
    const riskTopics = entities.filter((e) => e.$entity === "entity.riskTopic");
    const otherEntities: DataModelEntity[] = [];
    let personAdded = false;
    let orgAdded = false;
    let riskAdded = false;
    for (const entity of entities) {
        if (entity.$entity === "entity.person") {
            if (!personAdded) {
                if (personEntities.length === 1) {
                    items.push({ type: "personInline", entity: personEntities[0] });
                } else {
                    items.push({ type: "personTable", entities: personEntities });
                }
                personAdded = true;
            }
            continue;
        }
        if (entity.$entity === "entity.organization") {
            if (!orgAdded) {
                if (organizationEntities.length === 1) {
                    items.push({ type: "orgInline", entity: organizationEntities[0] });
                } else {
                    items.push({ type: "organizationTable", entities: organizationEntities });
                }
                orgAdded = true;
            }
            continue;
        }
        if (entity.$entity === "entity.riskTopic") {
            if (!riskAdded) {
                items.push({ type: "riskTopicGroup", topics: riskTopics });
                riskAdded = true;
            }
            continue;
        }
        otherEntities.push(entity);
    }
    if (otherEntities.length > 0) {
        items.push({ type: "otherGroup", entities: otherEntities });
    }
    return items;
}

function CollapsibleOtherGroup({ entities }: { entities: DataModelEntity[] }) {
    const [open, setOpen] = useState(true);
    return (
        <div className="space-y-2">
            <button
                type="button"
                className="flex w-full items-center gap-2 sticky top-0 z-20 bg-background/95 backdrop-blur py-1 -mx-1 px-1"
                onClick={() => setOpen((v) => !v)}
            >
                {open
                    ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                    : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                <span className="text-sm font-medium text-foreground">Entities</span>
                <span className="text-xs text-muted-foreground">({entities.length})</span>
                <span className="flex-1 h-px bg-border/50" />
            </button>
            {open && (
                <div className="space-y-3">
                    {entities.map((entity) => (
                        <EntityCard
                            key={`${entity.$entity}-${entity.$id}`}
                            entity={entity}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
export function PluginResultView({ entities, flat = false, hideFavorite = false }: PluginResultViewProps) {
    if (!entities.length) {
        return <p className="text-muted-foreground text-center py-8">No entities in result</p>;
    }
    const items = buildRenderItems(entities);

    // Only show section labels when there are 2+ distinct entity-group types
    const groupTypes = items.filter(
        (i) => i.type === "personTable" || i.type === "personInline" ||
               i.type === "organizationTable" || i.type === "orgInline" ||
               i.type === "riskTopicGroup" || i.type === "otherGroup"
    );
    const showLabels = groupTypes.length > 1;

    const SECTION_META: Record<string, { entityType: string; label: string; count: (item: RenderItem) => number }> = {
        personInline:      { entityType: "entity.person",       label: "Person",       count: () => 1 },
        personTable:       { entityType: "entity.person",       label: "Persons",      count: (i) => (i as { type: "personTable"; entities: DataModelEntity[] }).entities.length },
        orgInline:         { entityType: "entity.organization",  label: "Organization", count: () => 1 },
        organizationTable: { entityType: "entity.organization",  label: "Organizations",count: (i) => (i as { type: "organizationTable"; entities: DataModelEntity[] }).entities.length },
        riskTopicGroup:    { entityType: "entity.riskTopic",    label: "Risk Topics",  count: (i) => (i as { type: "riskTopicGroup"; topics: DataModelEntity[] }).topics.length },
    };

    return (
        <div className="space-y-6">
            {items.map((item, idx) => {
                const meta = SECTION_META[item.type];

                const sectionHeader = showLabels && meta ? (
                    <div className="flex items-center gap-2 pt-2 sticky top-0 z-20 bg-background/95 backdrop-blur py-1 -mx-1 px-1">
                        <EntityTypeBadge entityType={meta.entityType} />
                        <span className="text-sm font-medium text-foreground">{meta.label}</span>
                        <span className="text-xs text-muted-foreground">({meta.count(item)})</span>
                        <span className="flex-1 h-px bg-border/50" />
                    </div>
                ) : null;

                if (item.type === "otherGroup") {
                    return (
                        <CollapsibleOtherGroup
                            key={`otherGroup-${idx}`}
                            entities={item.entities}
                        />
                    );
                }

                if (item.type === "riskTopicGroup") {
                    return (
                        <div key={`riskTopicGroup-${idx}`} className="space-y-2">
                            {sectionHeader}
                            <RiskTopicGroupCard topics={item.topics} />
                        </div>
                    );
                }
                if (item.type === "personInline") {
                    return (
                        <div key={`personInline-${idx}`} className="space-y-2">
                            {sectionHeader}
                            <div className="p-8">
                                <PersonEntityInline entity={item.entity} />
                            </div>
                        </div>
                    );
                }
                if (item.type === "orgInline") {
                    return (
                        <div key={`orgInline-${idx}`} className="space-y-2">
                            {sectionHeader}
                            <div className="p-8">
                                <OrganizationInline entity={item.entity} />
                            </div>
                        </div>
                    );
                }
                if (item.type === "personTable") {
                    return (
                        <div key={`personTable-${idx}`} className="space-y-2">
                            {sectionHeader}
                            <EntityTableSection
                                entityType="entity.person"
                                title="Person"
                                entities={item.entities}
                                columns={buildDynamicColumns(item.entities, 3)}
                                renderExpanded={(entity) => <PersonEntityInline entity={entity} />}
                                flat={flat}
                                hideFavorite={hideFavorite}
                            />
                        </div>
                    );
                }
                if (item.type === "organizationTable") {
                    return (
                        <div key={`organizationTable-${idx}`} className="space-y-2">
                            {sectionHeader}
                            <EntityTableSection
                                entityType="entity.organization"
                                title="Organization"
                                entities={item.entities}
                                columns={buildDynamicColumns(item.entities, 3)}
                                renderExpanded={(entity) => <OrganizationInline entity={entity} />}
                                flat={flat}
                                hideFavorite={hideFavorite}
                            />
                        </div>
                    );
                }
                return null;
            })}
        </div>
    );
}
