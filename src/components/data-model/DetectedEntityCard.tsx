import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import type { DataModelEntity, TypedValue } from "@/core/data-model/types";
import { EntityCardFooter } from "./EntityCardFooter";
import { EntityTypeBadge } from "./EntityTypeBadge";

function firstProp(entity: DataModelEntity, key: string): TypedValue | undefined {
    const values = entity.$props?.[key];
    return Array.isArray(values) ? values[0] : undefined;
}

export function DetectedEntityCard({ entity }: { entity: DataModelEntity }) {
    const name = firstProp(entity, "name");
    const description = firstProp(entity, "description");

    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                    <EntityTypeBadge entityType="entity.detectedEntity" />
                    {name ? String(name.value) : "Detected Entity"}
                </CardTitle>
            </CardHeader>

            {(description || (entity.$sources && entity.$sources.length > 0)) && (
                <CardContent className="space-y-3 pt-0">
                    {description && (
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            {String(description.value)}
                        </p>
                    )}

                    <EntityCardFooter entity={entity} />
                </CardContent>
            )}
        </Card>
    );
}
