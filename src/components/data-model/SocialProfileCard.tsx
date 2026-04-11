import { Badge } from "@/components/ui/badge";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import type { DataModelEntity, TypedValue } from "@/core/data-model/types";
import { EntityCardFooter } from "./EntityCardFooter";
import { EntityTypeBadge } from "./EntityTypeBadge";
import { TypedValueView } from "./TypedValueView";

const PLATFORM_ICONS: Record<string, string> = {
    twitter: "𝕏",
    x: "𝕏",
    facebook: "f",
    linkedin: "in",
    instagram: "ig",
    youtube: "▶",
    tiktok: "♪",
};

function firstProp(entity: DataModelEntity, key: string): TypedValue | undefined {
    const values = entity.$props?.[key];
    return Array.isArray(values) ? values[0] : undefined;
}

export function SocialProfileCard({ entity }: { entity: DataModelEntity }) {
    const targetName = firstProp(entity, "name");
    const platform = firstProp(entity, "platform");
    const profileTitle = firstProp(entity, "profileTitle");
    const profileUrl = firstProp(entity, "profileUrl");
    const userId = firstProp(entity, "userId");

    const platformStr = platform ? String(platform.value) : undefined;
    const platformLower = platformStr?.toLowerCase() ?? "";
    const platformIcon = PLATFORM_ICONS[platformLower];

    const displayTitle = profileTitle
        ? String(profileTitle.value)
        : targetName
            ? String(targetName.value)
            : "Social Profile";

    return (
        <Card>
            <CardHeader className="pb-3">
                <div className="flex items-start gap-3">
                    {platformIcon && (
                        <span className="text-xl font-bold text-muted-foreground shrink-0 w-8 text-center">
                            {platformIcon}
                        </span>
                    )}
                    <div className="space-y-1 flex-1 min-w-0">
                        <CardTitle className="text-base flex items-center gap-2">
                            <EntityTypeBadge entityType="entity.socialProfile" />
                            {displayTitle}
                        </CardTitle>
                        <div className="flex flex-wrap items-center gap-2">
                            {platformStr && (
                                <Badge variant="outline" className="text-xs">
                                    {platformStr}
                                </Badge>
                            )}
                            {targetName && (
                                <CardDescription>Target: {String(targetName.value)}</CardDescription>
                            )}
                        </div>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="space-y-3 pt-0">
                {profileUrl && (
                    <div>
                        <TypedValueView item={profileUrl} />
                    </div>
                )}
                {userId && (
                    <div className="space-y-0.5">
                        <p className="text-xs uppercase text-muted-foreground">User ID</p>
                        <p className="text-sm font-mono">{String(userId.value)}</p>
                    </div>
                )}

                <EntityCardFooter entity={entity} />
            </CardContent>
        </Card>
    );
}
