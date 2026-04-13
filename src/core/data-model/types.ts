export interface TypedValue<T = unknown> {
    $type: string;
    value: T;
}

export interface SourceDescriptor {
    name: string;
    source: string;
}

export interface DataModelEntity {
    $entity: string;
    $id: string;
    $sources?: SourceDescriptor[];
    $props?: Record<string, TypedValue[]>;
    $extra?: TypedValue[];
}

export type DataModelResult = DataModelEntity[];

export function isDataModelResult(value: unknown): value is DataModelResult {
    if (!Array.isArray(value)) {
        return false;
    }

    return value.every((item) => {
        if (!item || typeof item !== "object") {
            return false;
        }

        const candidate = item as Record<string, unknown>;
        return (
            typeof candidate.$entity === "string" &&
            typeof candidate.$id === "string"
        );
    });
}
