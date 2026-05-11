import { formatRegistryJurisdictionValue, getRegistryJurisdictionLabel } from "@/core/registryJurisdictions";

interface RegistryJurisdictionValueProps {
    code: string;
}

export function RegistryJurisdictionValue({ code }: RegistryJurisdictionValueProps) {
    const label = getRegistryJurisdictionLabel(code);

    if (label === code) {
        return <span className="break-all">{code}</span>;
    }

    return (
        <span className="inline-flex flex-wrap items-baseline gap-2">
            <span className="break-all">{label}</span>
            <span className="text-xs text-muted-foreground font-mono">{code}</span>
        </span>
    );
}

export function registryJurisdictionCompactText(code: string): string {
    return formatRegistryJurisdictionValue(code);
}
