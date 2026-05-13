import { Badge } from "@/components/ui/badge";

interface RelativeCloseAssociate {
    name: string;
    relation?: string;
}

function parseRelativeCloseAssociate(value: unknown): RelativeCloseAssociate | null {
    if (!value || typeof value !== "object") {
        return null;
    }

    const candidate = value as Record<string, unknown>;
    const name = typeof candidate.name === "string" ? candidate.name.trim() : "";
    const relation = typeof candidate.relation === "string" ? candidate.relation.trim() : "";

    if (!name) {
        return null;
    }

    return relation ? { name, relation } : { name };
}

export function relativeCloseAssociateCompactText(value: unknown): string {
    const parsed = parseRelativeCloseAssociate(value);
    if (!parsed) {
        return "";
    }

    return parsed.relation ? `${parsed.name} - ${parsed.relation}` : parsed.name;
}

export function RelativeCloseAssociateValue({ value }: { value: unknown }) {
    const parsed = parseRelativeCloseAssociate(value);

    if (!parsed) {
        return null;
    }

    return (
        <span className="inline-flex max-w-full flex-wrap items-center gap-2">
            <span className="break-words">{parsed.name}</span>
            {parsed.relation && (
                <Badge variant="outline" className="text-xs font-normal">
                    {parsed.relation}
                </Badge>
            )}
        </span>
    );
}
