import type { DataModelEntity, TypedValue } from "@/core/data-model/types";

export function hasDisplayValue(value: TypedValue | undefined): boolean {
    if (!value) return false;
    if (value.value === null || value.value === undefined) return false;
    if (typeof value.value === "string" && value.value.trim() === "") return false;
    return true;
}

export function propList(entity: DataModelEntity, key: string): TypedValue[] {
    const values = entity.$props?.[key];
    return Array.isArray(values) ? values.filter(hasDisplayValue) : [];
}

export function firstProp(entity: DataModelEntity, key: string): TypedValue | undefined {
    return propList(entity, key)[0];
}

export function collectPropValues(entity: DataModelEntity, keys: string[]): TypedValue[] {
    const collected: TypedValue[] = [];
    const seen = new Set<string>();

    for (const key of keys) {
        for (const value of propList(entity, key)) {
            const marker = `${value.$type}:${typedValueToCompactText(value)}`;
            if (seen.has(marker)) {
                continue;
            }
            seen.add(marker);
            collected.push(value);
        }
    }

    return collected;
}

export function typedValueToCompactText(value: TypedValue | undefined): string {
    if (!value) {
        return "";
    }

    const rawValue = value.value;
    if (rawValue === null || rawValue === undefined) {
        return "";
    }
    if (typeof rawValue === "string" && rawValue.trim() === "") {
        return "";
    }

    if (typeof rawValue === "object") {
        return JSON.stringify(rawValue);
    }

    return String(rawValue);
}
