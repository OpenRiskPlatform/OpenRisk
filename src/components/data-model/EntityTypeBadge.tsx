import {
    AlertTriangle,
    Banknote,
    Building2,
    Newspaper,
    ScanSearch,
    Share2,
    User,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const ENTITY_META: Record<string, { icon: LucideIcon; label: string; color: string }> = {
    "entity.person": { icon: User, label: "Person", color: "text-blue-500" },
    "entity.organization": { icon: Building2, label: "Organization", color: "text-violet-500" },
    "entity.mediaMention": { icon: Newspaper, label: "Media Mention", color: "text-amber-500" },
    "entity.riskTopic": { icon: AlertTriangle, label: "Risk Topic", color: "text-red-500" },
    "entity.socialProfile": { icon: Share2, label: "Social Profile", color: "text-sky-500" },
    "entity.financialRecord": { icon: Banknote, label: "Financial Record", color: "text-emerald-500" },
    "entity.detectedEntity": { icon: ScanSearch, label: "Detected Entity", color: "text-muted-foreground" },
};

export function EntityTypeBadge({ entityType }: { entityType: string }) {
    const meta = ENTITY_META[entityType];
    const Icon = meta?.icon ?? ScanSearch;
    const label = meta?.label ?? entityType;
    const color = meta?.color ?? "text-muted-foreground";

    return (
        <TooltipProvider delayDuration={300}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <span className={`shrink-0 cursor-default ${color}`}>
                        <Icon size={16} />
                    </span>
                </TooltipTrigger>
                <TooltipContent side="right">
                    <span className="font-mono text-xs">{entityType}</span>
                    <span className="ml-1 text-primary-foreground/70">· {label}</span>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}
