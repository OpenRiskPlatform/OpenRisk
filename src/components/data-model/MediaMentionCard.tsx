import { Badge } from "@/components/ui/badge";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import type { DataModelEntity, TypedValue } from "@/core/data-model/types";
import { EntityCardFooter } from "./EntityCardFooter";
import { EntityTypeBadge } from "./EntityTypeBadge";
import { TypedValueView } from "./TypedValueView";

function propList(entity: DataModelEntity, key: string): TypedValue[] {
    const values = entity.$props?.[key];
    return Array.isArray(values) ? values : [];
}

function firstProp(entity: DataModelEntity, key: string): TypedValue | undefined {
    return propList(entity, key)[0];
}

function isKeyValue(item: TypedValue): item is {
    $type: "key-value";
    value: { key: TypedValue<string>; value: TypedValue };
} {
    if (item.$type !== "key-value") return false;
    if (!item.value || typeof item.value !== "object") return false;
    const c = item.value as { key?: TypedValue<string>; value?: TypedValue };
    return Boolean(c.key && c.value);
}

export function MediaMentionCard({ entity }: { entity: DataModelEntity }) {
    const targetName = firstProp(entity, "name");
    const title = firstProp(entity, "title");
    const url = firstProp(entity, "url");
    const analysis = firstProp(entity, "analysis");
    const adverseProp = firstProp(entity, "adverseActivityDetected");

    const isAdverse = adverseProp?.value === true;
    const isClean = adverseProp?.value === false;

    // Claims are stored in $extra as key-value pairs with key "Claim"
    const claims = (entity.$extra ?? [])
        .filter((item) => isKeyValue(item) && String(item.value.key.value).toLowerCase() === "claim")
        .map((item) => {
            const kv = item as { $type: "key-value"; value: { key: TypedValue<string>; value: TypedValue } };
            return String(kv.value.value.value);
        });

    const displayTitle = title ? String(title.value) : targetName ? String(targetName.value) : "Media Mention";

    return (
        <Card>
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 flex-1 min-w-0">
                        <CardTitle className="text-base leading-snug flex items-center gap-2">
                            <EntityTypeBadge entityType="entity.mediaMention" />
                            {displayTitle}
                        </CardTitle>
                        {targetName && title && (
                            <CardDescription>Target: {String(targetName.value)}</CardDescription>
                        )}
                    </div>
                    <div className="shrink-0">
                        <TooltipProvider>
                            <Tooltip delayDuration={200}>
                                <TooltipTrigger asChild>
                                    <span>
                                        {isAdverse ? (
                                            <Badge variant="destructive" className="text-xs cursor-help">⚠ Adverse</Badge>
                                        ) : isClean ? (
                                            <Badge variant="secondary" className="text-xs text-green-700 dark:text-green-400 cursor-help">✓ Clean</Badge>
                                        ) : null}
                                    </span>
                                </TooltipTrigger>
                                {(isAdverse || isClean) && (
                                    <TooltipContent side="left" className="max-w-60 text-xs">
                                        {isAdverse
                                            ? "Adversea AI detected signs of adverse activity in this article — e.g. criminal charges, sanctions, fraud, corruption, or other red flags related to the target."
                                            : "No adverse activity detected. The article does not indicate red flags related to the target."}
                                    </TooltipContent>
                                )}
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                </div>
                {url && (
                    <div className="pt-1">
                        <TypedValueView item={url} />
                    </div>
                )}
            </CardHeader>

            <CardContent className="space-y-4 pt-0">
                {analysis && (
                    <p className="text-sm text-foreground leading-relaxed">
                        {String(analysis.value)}
                    </p>
                )}

                {claims.length > 0 && (
                    <div className="space-y-2">
                        <p className="text-xs uppercase text-muted-foreground">Claims</p>
                        <ul className="space-y-1">
                            {claims.map((claim, i) => (
                                <li key={i} className="text-sm flex gap-2">
                                    <span className="text-muted-foreground shrink-0">·</span>
                                    <span>{claim}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                <EntityCardFooter entity={entity} excludeExtraKeys={["claim"]} />
            </CardContent>
        </Card>
    );
}
