import { Badge } from "@/components/ui/badge";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import type { DataModelEntity, TypedValue } from "@/core/data-model/types";
import { EntityCardFooter } from "./EntityCardFooter";
import { EntityTypeBadge } from "./EntityTypeBadge";
import { TypedValueView } from "./TypedValueView";

function firstProp(entity: DataModelEntity, key: string): TypedValue | undefined {
    const values = entity.$props?.[key];
    return Array.isArray(values) ? values[0] : undefined;
}

export function FinancialRecordCard({ entity }: { entity: DataModelEntity }) {
    const name = firstProp(entity, "name");
    const amountOwed = firstProp(entity, "amountOwed");
    const location = firstProp(entity, "location");
    const debtSource = firstProp(entity, "debtSource");

    return (
        <Card>
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        <EntityTypeBadge entityType="entity.financialRecord" />
                        {name ? String(name.value) : "Financial Record"}
                    </CardTitle>
                    {amountOwed && (
                        <Badge variant="destructive" className="text-sm font-semibold shrink-0 tabular-nums">
                            {String(amountOwed.value)}
                        </Badge>
                    )}
                </div>
            </CardHeader>

            <CardContent className="space-y-3 pt-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {location && (
                        <div className="space-y-0.5">
                            <p className="text-xs uppercase text-muted-foreground">Location</p>
                            <div className="text-sm">
                                <TypedValueView item={location} />
                            </div>
                        </div>
                    )}
                    {debtSource && (
                        <div className="space-y-0.5">
                            <p className="text-xs uppercase text-muted-foreground">Source</p>
                            <p className="text-sm">{String(debtSource.value)}</p>
                        </div>
                    )}
                </div>

                <EntityCardFooter entity={entity} />
            </CardContent>
        </Card>
    );
}
