import type { TypedValue } from "@/core/data-model/types";

interface TypedValueViewProps {
    item: TypedValue | undefined;
}

export function TypedValueView({ item }: TypedValueViewProps) {
    if (!item) {
        return <span className="text-muted-foreground">-</span>;
    }

    if (item.$type === "image-url" && typeof item.value === "string") {
        return (
            <img
                src={item.value}
                alt="entity"
                className="h-14 w-14 rounded-md object-cover border"
            />
        );
    }

    if (item.$type === "url" && typeof item.value === "string") {
        return (
            <a
                href={item.value}
                target="_blank"
                rel="noreferrer"
                className="text-primary underline underline-offset-4 break-all"
            >
                {item.value}
            </a>
        );
    }

    if (typeof item.value === "object") {
        return <span className="break-all">{JSON.stringify(item.value)}</span>;
    }

    return <span className="break-all">{String(item.value)}</span>;
}
