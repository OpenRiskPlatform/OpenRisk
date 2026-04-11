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

function propList(entity: DataModelEntity, key: string): TypedValue[] {
    const values = entity.$props?.[key];
    return Array.isArray(values) ? values : [];
}

function firstProp(entity: DataModelEntity, key: string): TypedValue | undefined {
    return propList(entity, key)[0];
}

function hasDisplayValue(value: TypedValue | undefined): boolean {
    if (!value) return false;
    const raw = value.value;
    if (raw === null || raw === undefined) return false;
    if (typeof raw === "string" && raw.trim() === "") return false;
    return true;
}

export function OrganizationCard({ entity }: { entity: DataModelEntity }) {
    const name = firstProp(entity, "name");
    const aliases = propList(entity, "aliases");
    const registrationId = firstProp(entity, "registrationId");
    const country = firstProp(entity, "country");
    const address = firstProp(entity, "address");
    const status = firstProp(entity, "status");
    const involvedPersons = propList(entity, "involvedPersons");
    const legalRoles = propList(entity, "legalRoles");
    const previousNames = propList(entity, "previousNames");
    const entryTypes = propList(entity, "entryTypes");
    const sourceRegister = firstProp(entity, "sourceRegister");
    const effectiveTo = firstProp(entity, "effectiveTo");
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
                    {sourceRegister && <Field label="Register" value={sourceRegister} />}
                    {effectiveTo && <Field label="Active Until" value={effectiveTo} />}
                </div>

                {previousNames.length > 0 && (
                    <div className="space-y-2">
                        <p className="text-xs uppercase text-muted-foreground">Previous Names</p>
                        <div className="flex flex-wrap gap-2">
                            {previousNames.map((v, i) => (
                                <Badge key={i} variant="outline" className="text-xs">{String(v.value)}</Badge>
                            ))}
                        </div>
                    </div>
                )}

                {legalRoles.length > 0 && (
                    <div className="space-y-2">
                        <p className="text-xs uppercase text-muted-foreground">Legal Roles</p>
                        <div className="flex flex-wrap gap-2">
                            {legalRoles.map((v, i) => (
                                <Badge key={i} variant="secondary" className="text-xs">{String(v.value)}</Badge>
                            ))}
                        </div>
                    </div>
                )}

                {entryTypes.length > 0 && (
                    <div className="space-y-2">
                        <p className="text-xs uppercase text-muted-foreground">Entry Types</p>
                        <div className="flex flex-wrap gap-2">
                            {entryTypes.map((v, i) => (
                                <Badge key={i} variant="outline" className="text-xs">{String(v.value)}</Badge>
                            ))}
                        </div>
                    </div>
                )}

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
    if (!hasDisplayValue(value)) {
        return null;
    }

    return (
        <div className="space-y-1">
            <p className="text-xs uppercase text-muted-foreground">{label}</p>
            <div className="text-sm">
                <TypedValueView item={value} />
            </div>
        </div>
    );
}
