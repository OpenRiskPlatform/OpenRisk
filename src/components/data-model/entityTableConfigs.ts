import type { DataModelEntity } from "@/core/data-model/types";
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
    {
        id: "country",
        header: "country",
        getValues: (entity) => collectPropValues(entity, ["country"]),
        variant: "badges",
    },
    {
        id: "position",
        header: "position",
        getValues: (entity) => collectPropValues(entity, ["position"]),
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
        id: "country",
        header: "country",
        getValues: (entity) => collectPropValues(entity, ["country"]),
        variant: "badges",
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
