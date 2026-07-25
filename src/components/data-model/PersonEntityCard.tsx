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
import { RelativeCloseAssociatesField } from "./RelativeCloseAssociatesField";
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
    const jurisdiction = firstProp(entity, "jurisdiction");
    const nationalities = propList(entity, "nationalities");
    const addresses = propList(entity, "addresses");
    const emails = propList(entity, "emails");
    const phones = propList(entity, "phones");
    const relativeCloseAssociates = propList(entity, "relativeCloseAssociates");

    const pepStatus = firstProp(entity, "pepStatus");
    const pepRcaStatus = firstProp(entity, "isPepRca");
    const sanctioned = firstProp(entity, "sanctioned");
    const notesText = notes
        && notes.value !== null
        && notes.value !== undefined
        && (typeof notes.value !== "string" || notes.value.trim() !== "")
        ? String(notes.value)
        : null;

    const isPep = pepStatus?.value === true;
    const isPepRca = pepRcaStatus?.value === true;
    const isSanctioned = sanctioned?.value === true;
    const isExplicitlyClear =
        pepStatus?.value === false
        && sanctioned?.value === false
        && pepRcaStatus?.value !== true;

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
                            <Badge variant="destructive" className="text-xs font-semibold bg-orange-500/80 hover:bg-orange-500/90">
                                ⚠️ PEP
                            </Badge>
                        )}
                        {isPepRca && (
                            <Badge variant="destructive" className="text-xs font-semibold bg-orange-500/80 hover:bg-orange-500/90">
                                PEP: RCA
                            </Badge>
                        )}
                        {isExplicitlyClear && (
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
                    <Field label="Jurisdiction" value={jurisdiction} />
                </div>

                <TagField label="Nationalities" values={nationalities} />
                <TagField label="Addresses" values={addresses} />
                <TagField label="Emails" values={emails} />
                <TagField label="Phones" values={phones} />
                <RelativeCloseAssociatesField values={relativeCloseAssociates} />

                {notesText && (
                    <p className="text-sm text-muted-foreground italic border-l-2 border-border pl-3">
                        {notesText}
                    </p>
                )}

                <EntityCardFooter
                    entity={entity}
                    excludePropKeys={[
                        "name",
                        "notes",
                        "aliases",
                        "birthDate",
                        "birthPlace",
                        "jurisdiction",
                        "nationalities",
                        "addresses",
                        "emails",
                        "phones",
                        "relativeCloseAssociates",
                        "pepStatus",
                        "isPepRca",
                        "sanctioned",
                    ]}
                />
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
