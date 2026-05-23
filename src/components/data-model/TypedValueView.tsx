import type { TypedValue } from "@/core/data-model/types";
import { ExternalLink } from "@/components/ui/ExternalLink";
import { RegistryJurisdictionValue } from "./RegistryJurisdictionValue";
import { RelativeCloseAssociateValue } from "./RelativeCloseAssociateValue";

interface TypedValueViewProps {
    item: TypedValue | undefined;
}

export function TypedValueView({ item }: TypedValueViewProps) {
    if (!item) {
        return null;
    }

    if (item.value === null || item.value === undefined) {
        return null;
    }

    if (typeof item.value === "string" && item.value.trim() === "") {
        return null;
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
            <ExternalLink
                href={item.value}
                className="text-primary underline underline-offset-4 break-all"
            >
                {item.value}
            </ExternalLink>
        );
    }

    if (item.$type === "registry-jurisdiction-code" && typeof item.value === "string") {
        return <RegistryJurisdictionValue code={item.value} />;
    }

    if (item.$type === "relative-close-associate") {
        return <RelativeCloseAssociateValue value={item.value} />;
    }

    if (typeof item.value === "object") {
        return <span className="break-all">{JSON.stringify(item.value)}</span>;
    }

    return <span className="break-all">{String(item.value)}</span>;
}
