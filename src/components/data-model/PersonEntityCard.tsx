import { Badge } from "@/components/ui/badge";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import type { DataModelEntity, TypedValue } from "@/core/data-model/types";
import { TypedValueView } from "./TypedValueView";

interface PersonEntityCardProps {
    entity: DataModelEntity;
}

function isKeyValue(item: TypedValue): item is {
    $type: "key-value";
    value: { key: TypedValue<string>; value: TypedValue };
} {
    if (item.$type !== "key-value") {
        return false;
    }
    if (!item.value || typeof item.value !== "object") {
        return false;
    }
    const candidate = item.value as { key?: TypedValue<string>; value?: TypedValue };
    return Boolean(candidate.key && candidate.value);
}

function propList(entity: DataModelEntity, key: string): TypedValue[] {
    const values = entity.$props?.[key];
    return Array.isArray(values) ? values : [];
}

function firstProp(entity: DataModelEntity, key: string): TypedValue | undefined {
    return propList(entity, key)[0];
}

export function PersonEntityCard({ entity }: PersonEntityCardProps) {
    const name = firstProp(entity, "name");
    const surname = firstProp(entity, "surname");
    const position = firstProp(entity, "position");
    const age = firstProp(entity, "age");
    const birthDate = firstProp(entity, "birthDate");
    const nationality = propList(entity, "nationality");
    const country = propList(entity, "country");
    const photo = firstProp(entity, "photo");
    const documentId = firstProp(entity, "documentId");
    const personId = firstProp(entity, "personId");
    const residenceAddress = firstProp(entity, "residenceAddress");

    const pepStatus = firstProp(entity, "pepStatus");
    const sanctioned = firstProp(entity, "sanctioned");

    const isPep = pepStatus?.value === true;
    const isSanctioned = sanctioned?.value === true;

    return (
        <Card>
            <CardHeader>
                <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                        <CardTitle className="text-lg">
                            <span className="mr-2">{name ? String(name.value) : "Unknown"}</span>
                            {surname ? <span>{String(surname.value)}</span> : null}
                        </CardTitle>
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
                            {!isSanctioned && !isPep && (pepStatus !== undefined || sanctioned !== undefined) && (
                                <Badge variant="secondary" className="text-xs font-semibold text-green-700 dark:text-green-400">
                                    ✓ No PEP / No Sanctions
                                </Badge>
                            )}
                        </div>
                    </div>
                    {photo ? <TypedValueView item={photo} /> : null}
                </div>
            </CardHeader>

            <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Position" value={position} />
                    <Field label="Age" value={age} />
                    <Field label="Birth Date" value={birthDate} />
                    <Field label="Person ID" value={personId} />
                    <Field label="Document ID" value={documentId} />
                    <Field label="Residence Address" value={residenceAddress} />
                </div>

                <TagField label="Nationality" values={nationality} />
                <TagField label="Country" values={country} />

                {entity.$sources && entity.$sources.length > 0 ? (
                    <div className="space-y-2">
                        <p className="text-xs uppercase text-muted-foreground">Sources</p>
                        <div className="space-y-1">
                            {entity.$sources.map((source) => (
                                <a
                                    key={`${entity.$id}-${source.name}-${source.source}`}
                                    href={source.source}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="block text-sm text-primary underline underline-offset-4 break-all"
                                >
                                    {source.name}
                                </a>
                            ))}
                        </div>
                    </div>
                ) : null}

                {entity.$extra && entity.$extra.length > 0 ? (
                    <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">Extra</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {entity.$extra.map((item, idx) =>
                                isKeyValue(item) ? (
                                    <div key={`${entity.$id}-extra-${idx}`} className="rounded border bg-muted/20 p-2 space-y-1">
                                        <p className="text-xs text-muted-foreground">
                                            {String(item.value.key.value)}
                                        </p>
                                        <div className="text-sm">
                                            <TypedValueView item={item.value.value} />
                                        </div>
                                    </div>
                                ) : (
                                    <div key={`${entity.$id}-extra-${idx}`} className="rounded border bg-muted/20 p-2 text-sm">
                                        <TypedValueView item={item} />
                                    </div>
                                )
                            )}
                        </div>
                    </div>
                ) : null}
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
    if (!values.length) {
        return null;
    }

    return (
        <div className="space-y-2">
            <p className="text-xs uppercase text-muted-foreground">{label}</p>
            <div className="flex flex-wrap gap-2">
                {values.map((value, index) => (
                    <Badge key={`${label}-${index}`} variant="secondary">
                        {String(value.value)}
                    </Badge>
                ))}
            </div>
        </div>
    );
}
