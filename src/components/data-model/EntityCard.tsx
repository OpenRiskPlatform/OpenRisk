import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import type { DataModelEntity, TypedValue } from "@/core/data-model/types";
import { PersonEntityCard } from "./PersonEntityCard";
import { TypedValueView } from "./TypedValueView";

interface EntityCardProps {
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

export function EntityCard({ entity }: EntityCardProps) {
    if (entity.$entity === "entity.person") {
        return <PersonEntityCard entity={entity} />;
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>{entity.$entity}</CardTitle>
                <CardDescription>ID: {entity.$id}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-3">
                    {Object.entries(entity.$props ?? {}).map(([key, values]) => (
                        <div key={key} className="space-y-1">
                            <p className="text-xs text-muted-foreground">{key}</p>
                            <div className="space-y-1 text-sm">
                                {(values as TypedValue[]).map((value, idx) => (
                                    <TypedValueView key={`${key}-${idx}`} item={value} />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

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
