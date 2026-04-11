import { Badge } from "@/components/ui/badge";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import type { DataModelEntity, TypedValue } from "@/core/data-model/types";
import { EntityCardFooter } from "./EntityCardFooter";
import { EntityTypeBadge } from "./EntityTypeBadge";
import { TypedValueView } from "./TypedValueView";

/** Maps known source registry codes to human-readable labels. */
const SOURCE_LABELS: Record<string, string> = {
    SK_TAX: "Tax Authority (Slovakia)",
    SK_SOCIAL_INSURANCE: "Social Insurance Agency (Slovakia)",
    SK_HEALTH_INSURANCE: "Health Insurance (Slovakia)",
    SK_CUSTOMS: "Customs Authority (Slovakia)",
    CZ_TAX: "Tax Authority (Czechia)",
    CZ_SOCIAL_INSURANCE: "Social Insurance Agency (Czechia)",
};

function humanSource(src: string): string {
    return SOURCE_LABELS[src] ?? src;
}

function firstProp(entity: DataModelEntity, key: string): TypedValue | undefined {
    const values = entity.$props?.[key];
    return Array.isArray(values) ? values[0] : undefined;
}

export function FinancialRecordCard({ entity }: { entity: DataModelEntity }) {
    const name = firstProp(entity, "name");
    const amountOwed = firstProp(entity, "amountOwed");
    const location = firstProp(entity, "location");
    const debtSource = firstProp(entity, "debtSource");
    const sourceName = debtSource ? humanSource(String(debtSource.value)) : undefined;

    return (
        <Card className="border-amber-200 dark:border-amber-900">
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                        <CardTitle className="text-base flex items-center gap-2">
                            <EntityTypeBadge entityType="entity.financialRecord" />
                            {name ? String(name.value) : "Unknown Debtor"}
                        </CardTitle>
                        {sourceName && (
                            <CardDescription>
                                Found in: <span className="font-medium text-foreground">{sourceName}</span>
                            </CardDescription>
                        )}
                    </div>
                    {amountOwed && (
                        <Badge variant="destructive" className="text-sm font-semibold shrink-0 tabular-nums">
                            {String(amountOwed.value)}
                        </Badge>
                    )}
                </div>
            </CardHeader>

            <CardContent className="space-y-3 pt-0">
                {location && (
                    <div className="space-y-0.5">
                        <p className="text-xs uppercase text-muted-foreground">Address</p>
                        <div className="text-sm">
                            <TypedValueView item={location} />
                        </div>
                    </div>
                )}

                <EntityCardFooter entity={entity} />
            </CardContent>
        </Card>
    );
}
