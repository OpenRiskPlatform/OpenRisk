import type { DataModelEntity, TypedValue } from "@/core/data-model/types";
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
    excludeExtraKeys,
}: {
    entity: DataModelEntity;
    excludeExtraKeys?: string[];
}) {
    const extra = (entity.$extra ?? []).filter((item) => {
        if (!excludeExtraKeys?.length) return true;
        if (!isKeyValue(item)) return true;
        const key = String(item.value.key.value).toLowerCase();
        return !excludeExtraKeys.some((ex) => key === ex.toLowerCase());
    });

    return (
        <div className="space-y-3 border-t pt-3 mt-1">
            <p className="text-xs text-muted-foreground font-mono break-all">ID: {entity.$id}</p>

            {extra.length > 0 && (
                <div className="space-y-1.5">
                    <p className="text-xs uppercase text-muted-foreground">Details</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {extra.map((item, idx) =>
                            isKeyValue(item) ? (
                                <div key={idx} className="rounded border bg-muted/20 p-2 space-y-0.5">
                                    <p className="text-xs text-muted-foreground">
                                        {String(item.value.key.value)}
                                    </p>
                                    <div className="text-sm">
                                        <TypedValueView item={item.value.value} />
                                    </div>
                                </div>
                            ) : (
                                <div key={idx} className="rounded border bg-muted/20 p-2 text-sm">
                                    <TypedValueView item={item} />
                                </div>
                            )
                        )}
                    </div>
                </div>
            )}

            {entity.$sources && entity.$sources.length > 0 && (
                <div className="space-y-1">
                    <p className="text-xs uppercase text-muted-foreground">Sources</p>
                    <div className="space-y-1">
                        {entity.$sources.map((source) => (
                            <a
                                key={source.source}
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
            )}
        </div>
    );
}
