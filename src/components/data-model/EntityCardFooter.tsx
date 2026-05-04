import type { DataModelEntity, TypedValue } from "@/core/data-model/types";
import { useSettings } from "@/core/settings/SettingsContext";
import { TypedValueView } from "./TypedValueView";

function isKeyValue(item: TypedValue): item is {
    $type: "key-value";
    value: { key: TypedValue<string>; value: TypedValue };
} {
    if (item.$type !== "key-value") return false;
    if (!item.value || typeof item.value !== "object") return false;
    const c = item.value as { key?: TypedValue<string>; value?: TypedValue };
    return Boolean(c.key && c.value);
}

/**
 * Renders entity ID, $extra key-value pairs, and $sources links.
 * Optionally filter out $extra keys already rendered by the parent card.
 */
export function EntityCardFooter({
    entity,
    excludePropKeys,
    excludeExtraKeys,
}: {
    entity: DataModelEntity;
    excludePropKeys?: string[];
    excludeExtraKeys?: string[];
}) {
    const { globalSettings } = useSettings();
    const advancedMode = globalSettings.advancedMode ?? false;
    const props = Object.entries(entity.$props ?? {}).filter(([key, values]) => {
        if (excludePropKeys?.some((excluded) => excluded.toLowerCase() === key.toLowerCase())) {
            return false;
        }

        return (values as TypedValue[]).some((item) => {
            if (item.value === null || item.value === undefined) return false;
            if (typeof item.value === "string" && item.value.trim() === "") return false;
            return true;
        });
    });

    const extra = (entity.$extra ?? []).filter((item) => {
        if (!excludeExtraKeys?.length) return true;
        if (!isKeyValue(item)) return true;
        const key = String(item.value.key.value).toLowerCase();
        return !excludeExtraKeys.some((ex) => key === ex.toLowerCase());
    });
    const groupedExtra = groupExtraValues(extra);
    const propertiesCount = props.length + groupedExtra.length;

    return (
        <div className="mt-2 space-y-3 border-t border-border/40 pt-4">
            {advancedMode && (
                <p className="text-xs text-muted-foreground font-mono break-all">ID: {entity.$id}</p>
            )}

            {propertiesCount > 0 && (
                <div className="space-y-2">
                    {props.map(([key, values]) => (
                        <FlatPropertyRow
                            key={`prop-${key}`}
                            label={key}
                            values={values as TypedValue[]}
                        />
                    ))}
                    {groupedExtra.map((group) => (
                        <FlatPropertyRow
                            key={`extra-${group.key}`}
                            label={group.label}
                            values={group.values}
                        />
                    ))}
                </div>
            )}

            {entity.$sources && entity.$sources.length > 0 && (
                <div className="space-y-1">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Sources</p>
                    {entity.$sources.map((source) => (
                        <a
                            key={source.source}
                            href={source.source}
                            target="_blank"
                            rel="noreferrer"
                            className="block text-xs text-primary underline underline-offset-4 break-all"
                        >
                            {source.name}
                        </a>
                    ))}
                </div>
            )}
        </div>
    );
}

function groupExtraValues(items: TypedValue[]) {
    const groups = new Map<string, { key: string; label: string; values: TypedValue[] }>();

    for (const item of items) {
        if (isKeyValue(item)) {
            const label = String(item.value.key.value);
            const groupKey = label.toLowerCase();
            const existing = groups.get(groupKey);
            if (existing) {
                existing.values.push(item.value.value);
            } else {
                groups.set(groupKey, {
                    key: groupKey,
                    label,
                    values: [item.value.value],
                });
            }
            continue;
        }

        const groupKey = "$extra";
        const existing = groups.get(groupKey);
        if (existing) {
            existing.values.push(item);
        } else {
            groups.set(groupKey, {
                key: groupKey,
                label: "$extra",
                values: [item],
            });
        }
    }

    return Array.from(groups.values());
}

function FlatPropertyRow({
    label,
    values,
}: {
    label: string;
    values: TypedValue[];
}) {
    const nonEmpty = values.filter((v) => {
        if (v.value === null || v.value === undefined) return false;
        if (typeof v.value === "string" && v.value.trim() === "") return false;
        return true;
    });
    if (!nonEmpty.length) return null;
    return (
        <div className="flex items-start gap-3 py-1 border-b border-border/30 last:border-0">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground w-32 shrink-0 pt-0.5">{label}</p>
            <div className="flex flex-wrap gap-1 flex-1 min-w-0">
                {nonEmpty.map((value, idx) => (
                    <span key={`${label}-${idx}`} className="text-xs text-foreground">
                        <TypedValueView item={value} />
                    </span>
                ))}
            </div>
        </div>
    );
}
