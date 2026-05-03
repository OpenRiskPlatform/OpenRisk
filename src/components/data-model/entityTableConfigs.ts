import type { DataModelEntity, TypedValue } from "@/core/data-model/types";
import type { EntityTableColumnConfig } from "./EntityTableSection";
import { collectPropValues, propList, typedValueToCompactText } from "./entityProps";

function previewList(entity: DataModelEntity, keys: string[]): string | null {
    for (const key of keys) {
        const values = propList(entity, key)
            .map((value) => typedValueToCompactText(value))
            .filter((value) => value.length > 0);
        if (!values.length) {
            continue;
        }
        const preview = values.slice(0, 2).join(", ");
        const suffix = values.length > 2 ? ` +${values.length - 2}` : "";
        return `${key}: ${preview}${suffix}`;
    }

    return null;
}

export const PERSON_TABLE_COLUMNS: EntityTableColumnConfig[] = [
    {
        id: "name",
        header: "name",
        getValues: (entity) => collectPropValues(entity, ["name"]),
        secondaryText: (entity) => previewList(entity, ["aliases", "alias"]),
    },
    {
        id: "birthDate",
        header: "birthDate",
        getValues: (entity) => collectPropValues(entity, ["birthDate"]),
    },
    {
        id: "nationality",
        header: "nationality",
        getValues: (entity) => collectPropValues(entity, ["nationality", "nationalities"]),
        variant: "badges",
    },
];

export const ORGANIZATION_TABLE_COLUMNS: EntityTableColumnConfig[] = [
    {
        id: "name",
        header: "name",
        getValues: (entity) => collectPropValues(entity, ["name"]),
        secondaryText: (entity) => previewList(entity, ["aliases", "previousNames"]),
    },
    {
        id: "registrationId",
        header: "registrationId",
        getValues: (entity) => collectPropValues(entity, ["registrationId", "organizationId"]),
    },
    {
        id: "status",
        header: "status",
        getValues: (entity) => collectPropValues(entity, ["status"]),
        variant: "badges",
    },
    {
        id: "address",
        header: "address",
        getValues: (entity) => collectPropValues(entity, ["address", "residenceAddress"]),
    },
];

// Props that are never useful as table column headers
const SKIP_PROPS = new Set([
    "name", "aliases", "alias", // name always first; aliases shown as secondary text
    "notes", "description", "remarks", "summary", // too long
    "pepStatus", "sanctioned", // shown as badges in expanded view
    "id", "uuid", "sourceId", "externalId", // raw IDs, not useful in column
]);

// Human-readable labels for known camelCase prop keys
const PROP_LABELS: Record<string, string> = {
    birthDate: "Birth Date",
    birthPlace: "Birth Place",
    nationality: "Nationality",
    nationalities: "Nationality",
    country: "Country",
    address: "Address",
    residenceAddress: "Address",
    registrationId: "Reg. ID",
    organizationId: "Org. ID",
    status: "Status",
    legalForm: "Legal Form",
    legalRoles: "Legal Roles",
    involvedPersons: "Persons",
    previousNames: "Prev. Names",
    entryTypes: "Entry Types",
    sourceRegister: "Register",
    effectiveTo: "Active Until",
    phone: "Phone",
    email: "Email",
    website: "Website",
    position: "Position",
    employer: "Employer",
};

function labelForProp(key: string): string {
    if (PROP_LABELS[key]) return PROP_LABELS[key];
    // camelCase → Title Case
    return key
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (s) => s.toUpperCase())
        .trim();
}

function hasAnyValue(values: TypedValue[]): boolean {
    return values.some((v) => {
        if (v.value === null || v.value === undefined) return false;
        if (typeof v.value === "string" && v.value.trim() === "") return false;
        return true;
    });
}

/**
 * Builds table columns dynamically from the actual prop data present in the entities.
 * Always puts "name" first, then the most-populated additional props (up to maxExtra).
 */
export function buildDynamicColumns(
    entities: DataModelEntity[],
    maxExtra = 3,
): EntityTableColumnConfig[] {
    // Count entities that have a non-empty value for each prop key
    const propPopularity = new Map<string, number>();
    for (const entity of entities) {
        for (const [key, values] of Object.entries(entity.$props ?? {})) {
            if (SKIP_PROPS.has(key)) continue;
            if (hasAnyValue(values as TypedValue[])) {
                propPopularity.set(key, (propPopularity.get(key) ?? 0) + 1);
            }
        }
    }

    // Pick the most-popular props
    const topProps = [...propPopularity.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, maxExtra)
        .map(([key]) => key);

    // Name column always first
    const nameCol: EntityTableColumnConfig = {
        id: "name",
        header: "Name",
        getValues: (entity) => collectPropValues(entity, ["name", "fullName"]),
        secondaryText: (entity) => previewList(entity, ["aliases", "alias", "previousNames"]),
    };

    const extraCols: EntityTableColumnConfig[] = topProps.map((key) => ({
        id: key,
        header: labelForProp(key),
        getValues: (entity) => {
            const vals = entity.$props?.[key];
            return Array.isArray(vals) ? (vals as TypedValue[]) : [];
        },
        variant: Array.isArray(entities[0]?.$props?.[key]) &&
            (entities[0].$props![key] as TypedValue[]).length > 1
            ? "badges"
            : "text",
    }));

    return [nameCol, ...extraCols];
}


