import type { TypedValue } from "@/core/data-model/types";
import { TypedValueView } from "./TypedValueView";

function hasDisplayValue(value: TypedValue): boolean {
    if (value.value === null || value.value === undefined) return false;
    if (typeof value.value === "string" && value.value.trim() === "") return false;
    return true;
}

export function RelativeCloseAssociatesField({ values }: { values: TypedValue[] }) {
    const displayValues = values.filter(hasDisplayValue);

    if (!displayValues.length) {
        return null;
    }

    return (
        <div className="space-y-2">
            <p className="text-xs uppercase text-muted-foreground">Relatives and Close Associates</p>
            <div className="grid gap-2 sm:grid-cols-2">
                {displayValues.map((value, index) => (
                    <div
                        key={`relative-close-associate-${index}`}
                        className="rounded-md border border-border/70 px-3 py-2 text-sm"
                    >
                        <TypedValueView item={value} />
                    </div>
                ))}
            </div>
        </div>
    );
}
