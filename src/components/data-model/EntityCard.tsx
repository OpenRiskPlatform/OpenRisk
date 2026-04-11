import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import type { DataModelEntity, TypedValue } from "@/core/data-model/types";
import { DetectedEntityCard } from "./DetectedEntityCard";
import { EntityCardFooter } from "./EntityCardFooter";
import { EntityTypeBadge } from "./EntityTypeBadge";
import { FinancialRecordCard } from "./FinancialRecordCard";
import { MediaMentionCard } from "./MediaMentionCard";
import { OrganizationCard } from "./OrganizationCard";
import { PersonEntityCard } from "./PersonEntityCard";
import { SocialProfileCard } from "./SocialProfileCard";
import { TypedValueView } from "./TypedValueView";

interface EntityCardProps {
    entity: DataModelEntity;
}

export function EntityCard({ entity }: EntityCardProps) {
    if (entity.$entity === "entity.person") return <PersonEntityCard entity={entity} />;
    if (entity.$entity === "entity.organization") return <OrganizationCard entity={entity} />;
    if (entity.$entity === "entity.mediaMention") return <MediaMentionCard entity={entity} />;
    if (entity.$entity === "entity.socialProfile") return <SocialProfileCard entity={entity} />;
    if (entity.$entity === "entity.financialRecord") return <FinancialRecordCard entity={entity} />;
    if (entity.$entity === "entity.detectedEntity") return <DetectedEntityCard entity={entity} />;

    const nameValue = (entity.$props?.["name"] as TypedValue[] | undefined)?.[0]?.value;
    const displayName = nameValue != null ? String(nameValue) : undefined;

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <EntityTypeBadge entityType={entity.$entity} />
                    {displayName ?? entity.$entity}
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-3">
                    {Object.entries(entity.$props ?? {}).map(([key, values]) => (
                        <div key={key} className="space-y-1">
                            <p className="text-xs text-muted-foreground">{key}</p>
                            <div className="space-y-1 text-sm">
                                {(values as TypedValue[]).map((value, idx) => (
                                    <TypedValueView key={`${key}-${idx}`} item={value} />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                <EntityCardFooter entity={entity} />
            </CardContent>
        </Card>
    );
}
