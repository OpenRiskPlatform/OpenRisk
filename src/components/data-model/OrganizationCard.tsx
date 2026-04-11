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

function propList(entity: DataModelEntity, key: string): TypedValue[] {
    const values = entity.$props?.[key];
    return Array.isArray(values) ? values : [];
}

function firstProp(entity: DataModelEntity, key: string): TypedValue | undefined {
    return propList(entity, key)[0];
}

export function OrganizationCard({ entity }: { entity: DataModelEntity }) {
    const name = firstProp(entity, "name");
    const aliases = propList(entity, "aliases");
    const registrationId = firstProp(entity, "registrationId");
    const country = firstProp(entity, "country");
    const address = firstProp(entity, "address");
    const status = firstProp(entity, "status");
    const involvedPersons = propList(entity, "involvedPersons");
    const pepStatus = firstProp(entity, "pepStatus");
    const sanctioned = firstProp(entity, "sanctioned");

    const isPep = pepStatus?.value === true;
    const isSanctioned = sanctioned?.value === true;
    const statusStr = status ? String(status.value) : undefined;

    return (
        <Card>
            <CardHeader>
                <div className="space-y-1">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <EntityTypeBadge entityType="entity.organization" />
                        {name ? String(name.value) : "Unknown Organization"}
                    </CardTitle>
                    {aliases.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                            aka {aliases.map((a) => String(a.value)).join(", ")}
                        </p>
                    )}
                    <CardDescription>ID: {entity.$id}</CardDescription>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                        {isSanctioned && (
                            <Badge variant="destructive" className="text-xs font-semibold">
                                🚫 Sanctioned
                            </Badge>
                        )}
                        {isPep && (
                            <Badge variant="destructive" className="text-xs font-semibold bg-orange-600 hover:bg-orange-700">
                                ⚠️ PEP
                            </Badge>
                        )}
                        {statusStr && (
                            <Badge
                                variant={statusStr === "active" ? "secondary" : "outline"}
                                className={
                                    statusStr === "active"
                                        ? "text-xs text-green-700 dark:text-green-400"
                                        : "text-xs"
                                }
                            >
                                {statusStr.charAt(0).toUpperCase() + statusStr.slice(1)}
                            </Badge>
                        )}
                    </div>
                </div>
            </CardHeader>

            <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Registration ID" value={registrationId} />
                    <Field label="Country" value={country} />
                    <Field label="Address" value={address} />
                </div>

                {involvedPersons.length > 0 && (
                    <div className="space-y-2">
                        <p className="text-xs uppercase text-muted-foreground">Involved Persons</p>
                        <div className="flex flex-wrap gap-2">
                            {involvedPersons.map((v, i) => (
                                <Badge key={i} variant="secondary">{String(v.value)}</Badge>
                            ))}
                        </div>
                    </div>
                )}

                <EntityCardFooter entity={entity} />
            </CardContent>
        </Card>
    );
}

function Field({ label, value }: { label: string; value: TypedValue | undefined }) {
    return (
        <div className="space-y-1">
            <p className="text-xs uppercase text-muted-foreground">{label}</p>
            <div className="text-sm">
                <TypedValueView item={value} />
            </div>
        </div>
    );
}
