import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import type { DataModelEntity } from "@/core/data-model/types";
import { EntityCardFooter } from "./EntityCardFooter";
import { EntityTypeBadge } from "./EntityTypeBadge";
import { FinancialRecordCard } from "./FinancialRecordCard";
import { MediaMentionCard } from "./MediaMentionCard";
import { OrganizationCard } from "./OrganizationCard";
import { PersonEntityCard } from "./PersonEntityCard";
import { SocialProfileCard } from "./SocialProfileCard";

interface EntityCardProps {
    entity: DataModelEntity;
}

export function EntityCard({ entity }: EntityCardProps) {
    if (entity.$entity === "entity.person") return <PersonEntityCard entity={entity} />;
    if (entity.$entity === "entity.organization") return <OrganizationCard entity={entity} />;
    if (entity.$entity === "entity.mediaMention") return <MediaMentionCard entity={entity} />;
    if (entity.$entity === "entity.socialProfile") return <SocialProfileCard entity={entity} />;
    if (entity.$entity === "entity.financialRecord") return <FinancialRecordCard entity={entity} />;
    if (entity.$entity === "entity.detectedEntity") return <PersonEntityCard entity={entity} />;

    const nameValue = entity.$props?.["name"]?.[0]?.value;
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
                <EntityCardFooter entity={entity} />
            </CardContent>
        </Card>
    );
}
