import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DataModelEntity } from "@/core/data-model/types";

interface RiskTopicGroupCardProps {
    topics: DataModelEntity[];
}

const TOPIC_LABELS: Record<string, string> = {
    basic_check: "Basic Check",
    political_activity: "Political Activity",
    legal_issues: "Legal Issues",
    corruption: "Corruption",
    financial_crime: "Financial Crime",
    violent_crime: "Violent Crime",
    sex_crime: "Sex Crime",
};

function getTopicId(entity: DataModelEntity): string {
    const topicIdProp = entity.$props?.topicId?.[0];
    return topicIdProp ? String(topicIdProp.value) : entity.$id;
}

function isAdverse(entity: DataModelEntity): boolean {
    const val = entity.$props?.adverseActivityDetected?.[0];
    return val?.value === true;
}

function getSummary(entity: DataModelEntity): string | undefined {
    const val = entity.$props?.summary?.[0];
    return val ? String(val.value) : undefined;
}

function getTargetName(entity: DataModelEntity): string | undefined {
    const val = entity.$props?.name?.[0];
    return val ? String(val.value) : undefined;
}

export function RiskTopicGroupCard({ topics }: RiskTopicGroupCardProps) {
    if (!topics.length) return null;

    const targetName = getTargetName(topics[0]);
    const adverseCount = topics.filter(isAdverse).length;

    return (
        <Card>
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3">
                    <CardTitle className="text-base">
                        Topic Report{targetName ? `: ${targetName}` : ""}
                    </CardTitle>
                    <div className="flex gap-2 shrink-0">
                        {adverseCount > 0 ? (
                            <Badge variant="destructive" className="text-xs">
                                {adverseCount} adverse topic{adverseCount !== 1 ? "s" : ""}
                            </Badge>
                        ) : (
                            <Badge variant="secondary" className="text-xs text-green-700 dark:text-green-400">
                                ✓ No adverse topics
                            </Badge>
                        )}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-0 p-0">
                <div className="divide-y">
                    {topics.map((entity) => {
                        const topicId = getTopicId(entity);
                        const label = TOPIC_LABELS[topicId] ?? topicId
                            .replace(/_/g, " ")
                            .replace(/\b\w/g, (c) => c.toUpperCase());
                        const adverse = isAdverse(entity);
                        const summary = getSummary(entity);
                        const sources = entity.$sources ?? [];

                        return (
                            <div key={entity.$id} className="px-6 py-3 space-y-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium w-40 shrink-0">{label}</span>
                                    {adverse ? (
                                        <Badge variant="destructive" className="text-xs shrink-0">Adverse</Badge>
                                    ) : (
                                        <Badge variant="secondary" className="text-xs shrink-0 text-green-700 dark:text-green-400">Clean</Badge>
                                    )}
                                </div>
                                {summary && (
                                    <p className="text-sm text-muted-foreground leading-snug pl-40">{summary}</p>
                                )}
                                {sources.length > 0 && (
                                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 pl-40">
                                        {sources.map((src) => (
                                            <a
                                                key={src.source}
                                                href={src.source}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="text-xs text-primary underline underline-offset-2 truncate max-w-xs"
                                            >
                                                {src.name}
                                            </a>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}
