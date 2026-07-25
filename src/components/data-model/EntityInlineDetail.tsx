import { Badge } from "@/components/ui/badge";
import type { DataModelEntity, TypedValue } from "@/core/data-model/types";
import { EntityCardFooter } from "./EntityCardFooter";
import { RelativeCloseAssociatesField } from "./RelativeCloseAssociatesField";
import { TypedValueView } from "./TypedValueView";

// ── helpers ────────────────────────────────────────────────────────────────

function propList(entity: DataModelEntity, key: string): TypedValue[] {
    const values = entity.$props?.[key];
    return Array.isArray(values) ? values : [];
}

function firstProp(entity: DataModelEntity, key: string): TypedValue | undefined {
    return propList(entity, key)[0];
}

function hasValue(v: TypedValue | undefined): boolean {
    if (!v) return false;
    const raw = v.value;
    if (raw === null || raw === undefined) return false;
    if (typeof raw === "string" && raw.trim() === "") return false;
    return true;
}

// ── shared field primitives ────────────────────────────────────────────────

function Field({ label, value }: { label: string; value: TypedValue | undefined }) {
    if (!hasValue(value)) return null;
    return (
        <div className="space-y-0.5">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
            <div className="text-sm text-foreground">
                <TypedValueView item={value} />
            </div>
        </div>
    );
}

function TagField({ label, values }: { label: string; values: TypedValue[] }) {
    const display = values.filter((v) => hasValue(v));
    if (!display.length) return null;
    return (
        <div className="space-y-1">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
            <div className="flex flex-wrap gap-1.5">
                {display.map((v, i) => (
                    <Badge key={i} variant="secondary" className="text-xs font-normal">
                        {String(v.value)}
                    </Badge>
                ))}
            </div>
        </div>
    );
}

// ── Person ─────────────────────────────────────────────────────────────────

export function PersonEntityInline({ entity }: { entity: DataModelEntity }) {
    const name = firstProp(entity, "name");
    const aliases = propList(entity, "aliases");
    const birthDate = firstProp(entity, "birthDate");
    const birthPlace = firstProp(entity, "birthPlace");
    const nationalities = propList(entity, "nationalities");
    const addresses = propList(entity, "addresses");
    const emails = propList(entity, "emails");
    const phones = propList(entity, "phones");
    const relativeCloseAssociates = propList(entity, "relativeCloseAssociates");
    const notes = firstProp(entity, "notes");
    const pepStatus = firstProp(entity, "pepStatus");
    const pepRcaStatus = firstProp(entity, "isPepRca");
    const sanctioned = firstProp(entity, "sanctioned");

    const isPep = pepStatus?.value === true;
    const isPepRca = pepRcaStatus?.value === true;
    const isSanctioned = sanctioned?.value === true;
    const isExplicitlyClear =
        pepStatus?.value === false
        && sanctioned?.value === false
        && pepRcaStatus?.value !== true;
    const notesText = notes && hasValue(notes) ? String(notes.value) : null;

    return (
        <div className="space-y-4">
            {/* header row */}
            <div className="flex flex-wrap items-center gap-2">
                <span className="text-base font-semibold text-foreground">
                    {name ? String(name.value) : "Unknown"}
                </span>
                {aliases.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                        aka {aliases.map((a) => String(a.value)).join(", ")}
                    </span>
                )}
                {isSanctioned && (
                    <Badge variant="destructive" className="text-xs font-semibold">Sanctioned</Badge>
                )}
                {isPep && (
                    <Badge variant="destructive" className="text-xs font-semibold bg-orange-500/80 hover:bg-orange-500/90">PEP</Badge>
                )}
                {isPepRca && (
                    <Badge variant="destructive" className="text-xs font-semibold bg-orange-500/80 hover:bg-orange-500/90">
                        PEP: RCA
                    </Badge>
                )}
                {isExplicitlyClear && (
                    <Badge variant="secondary" className="text-xs font-semibold text-green-700 dark:text-green-400">
                        No PEP / No Sanctions
                    </Badge>
                )}
            </div>

            {/* fields grid */}
            <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Birth Date" value={birthDate} />
                <Field label="Birth Place" value={birthPlace} />
            </div>

            <TagField label="Nationalities" values={nationalities} />
            <TagField label="Addresses" values={addresses} />
            <TagField label="Emails" values={emails} />
            <TagField label="Phones" values={phones} />
            <RelativeCloseAssociatesField values={relativeCloseAssociates} />

            {notesText && (
                <p className="text-sm text-muted-foreground italic border-l-2 border-border pl-3">{notesText}</p>
            )}

            <EntityCardFooter
                entity={entity}
                excludePropKeys={["name", "notes", "aliases", "birthDate", "birthPlace",
                    "nationalities", "addresses", "emails", "phones", "relativeCloseAssociates",
                    "pepStatus", "isPepRca", "sanctioned"]}
            />
        </div>
    );
}

// ── Organization ───────────────────────────────────────────────────────────

export function OrganizationInline({ entity }: { entity: DataModelEntity }) {
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
        <div className="space-y-4">
            {/* header row */}
            <div className="flex flex-wrap items-center gap-2">
                <span className="text-base font-semibold text-foreground">
                    {name ? String(name.value) : "Unknown Organization"}
                </span>
                {aliases.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                        aka {aliases.map((a) => String(a.value)).join(", ")}
                    </span>
                )}
                {isSanctioned && (
                    <Badge variant="destructive" className="text-xs font-semibold">Sanctioned</Badge>
                )}
                {isPep && (
                    <Badge variant="destructive" className="text-xs font-semibold bg-orange-500/80 hover:bg-orange-500/90">PEP</Badge>
                )}
                {statusStr && (
                    <Badge
                        variant={statusStr === "active" ? "secondary" : "outline"}
                        className={statusStr === "active" ? "text-xs text-green-700 dark:text-green-400" : "text-xs"}
                    >
                        {statusStr.charAt(0).toUpperCase() + statusStr.slice(1)}
                    </Badge>
                )}
            </div>

            {/* fields grid */}
            <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Registration ID" value={registrationId} />
                <Field label="Country" value={country} />
                <Field label="Address" value={address} />
                {hasValue(sourceRegister) && <Field label="Register" value={sourceRegister} />}
                {hasValue(effectiveTo) && <Field label="Active Until" value={effectiveTo} />}
            </div>

            <TagField label="Previous Names" values={previousNames} />
            <TagField label="Legal Roles" values={legalRoles} />
            <TagField label="Entry Types" values={entryTypes} />
            <TagField label="Involved Persons" values={involvedPersons} />

            <EntityCardFooter
                entity={entity}
                excludePropKeys={["name", "aliases", "registrationId", "organizationId",
                    "country", "address", "residenceAddress", "status", "involvedPersons",
                    "legalRoles", "previousNames", "entryTypes", "sourceRegister",
                    "effectiveTo", "pepStatus", "sanctioned"]}
            />
        </div>
    );
}
