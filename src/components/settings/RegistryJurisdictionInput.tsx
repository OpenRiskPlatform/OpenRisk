import { useMemo } from "react";
import {
    REGISTRY_JURISDICTION_OPTIONS,
} from "@/core/registryJurisdictions";
import { SearchableSelect } from "@/components/settings/SearchableSelect";

interface RegistryJurisdictionInputProps {
    value: unknown;
    onChange: (value: unknown) => void;
    options?: string[];
    emptyAsNull?: boolean;
    placeholder?: string;
    disabled?: boolean;
}

export function RegistryJurisdictionInput({
    value,
    onChange,
    options,
    emptyAsNull = false,
    placeholder = "Select jurisdiction",
    disabled = false,
}: RegistryJurisdictionInputProps) {
    const availableOptions = useMemo(() => {
        const allowed = options?.length ? new Set(options) : undefined;
        return REGISTRY_JURISDICTION_OPTIONS
            .filter((option) => !allowed || allowed.has(option.value))
            .map((option) => ({
                ...option,
                description: option.value,
            }));
    }, [options]);

    return (
        <SearchableSelect
            options={availableOptions}
            value={typeof value === "string" ? value : undefined}
            onValueChange={(nextValue) =>
                onChange(nextValue ?? (emptyAsNull ? null : ""))
            }
            placeholder={placeholder}
            searchPlaceholder="Search jurisdictions"
            emptyMessage="No jurisdictions found"
            disabled={disabled}
            clearable
        />
    );
}
