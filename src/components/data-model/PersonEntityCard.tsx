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

interface PersonEntityCardProps {
    entity: DataModelEntity;
}

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

export function PersonEntityCard({ entity }: PersonEntityCardProps) {
    const name = firstProp(entity, "name");
    const notes = firstProp(entity, "notes");
    const aliases = propList(entity, "aliases");
    const birthDate = firstProp(entity, "birthDate");
    const birthPlace = firstProp(entity, "birthPlace");
    const nationalities = propList(entity, "nationalities");
    const addresses = propList(entity, "addresses");
    const emails = propList(entity, "emails");
    const phones = propList(entity, "phones");

    const pepStatus = firstProp(entity, "pepStatus");
    const sanctioned = firstProp(entity, "sanctioned");
    const notesText = notes
        && notes.value !== null
        && notes.value !== undefined
        && (typeof notes.value !== "string" || notes.value.trim() !== "")
        ? String(notes.value)
        : null;

    const isPep = pepStatus?.value === true;
    const isSanctioned = sanctioned?.value === true;

    return (
        <Card>
            <CardHeader>
                <div className="space-y-1">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <EntityTypeBadge entityType="entity.person" />
                        {name ? String(name.value) : "Unknown"}
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
                        {!isSanctioned && !isPep && (pepStatus !== undefined || sanctioned !== undefined) && (
                            <Badge variant="secondary" className="text-xs font-semibold text-green-700 dark:text-green-400">
                                ✓ No PEP / No Sanctions
                            </Badge>
                        )}
                    </div>
                </div>
            </CardHeader>

            <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Birth Date" value={birthDate} />
                    <Field label="Birth Place" value={birthPlace} />
                </div>

                <TagField label="Nationalities" values={nationalities} />
                <TagField label="Addresses" values={addresses} />
                <TagField label="Emails" values={emails} />
                <TagField label="Phones" values={phones} />

                {notesText && (
                    <p className="text-sm text-muted-foreground italic border-l-2 border-border pl-3">
                        {notesText}
                    </p>
                )}

                <EntityCardFooter entity={entity} />
            </CardContent>
        </Card>
    );
}

function Field({
    label,
    value,
}: {
    label: string;
    value: TypedValue | undefined;
}) {
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

function TagField({ label, values }: { label: string; values: TypedValue[] }) {
    const displayValues = values.filter((value) => {
        const raw = value.value;
        if (raw === null || raw === undefined) return false;
        if (typeof raw === "string" && raw.trim() === "") return false;
        return true;
    });

    if (!displayValues.length) {
        return null;
    }

    return (
        <div className="space-y-2">
            <p className="text-xs uppercase text-muted-foreground">{label}</p>
            <div className="flex flex-wrap gap-2">
                {displayValues.map((value, index) => (
                    <Badge key={`${label}-${index}`} variant="secondary">
                        {String(value.value)}
                    </Badge>
                ))}
            </div>
        </div>
    );
}
