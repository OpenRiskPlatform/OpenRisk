import { useMemo } from "react";
import {
    COUNTRY_CODE_ISO_3166_1_ALPHA_2,
    getCountryName,
    isCountryCodeIso31661Alpha2,
} from "@/core/countries";
import {
    SearchableSelect,
    type SearchableSelectOption,
} from "@/components/settings/SearchableSelect";

interface CountryInputProps {
    value: unknown;
    onChange: (value: unknown) => void;
    options?: string[];
    emptyAsNull?: boolean;
    placeholder?: string;
    disabled?: boolean;
}

const COUNTRY_ALIASES: Partial<Record<string, string[]>> = {
    CZ: ["Czech Republic"],
    GB: ["Great Britain", "UK"],
    US: ["USA", "United States of America"],
};

function buildCountryOptions(allowedValues?: string[]): SearchableSelectOption[] {
    const allowed = allowedValues?.length
        ? new Set(
            allowedValues
                .map((value) => value.toUpperCase())
                .filter(isCountryCodeIso31661Alpha2),
        )
        : undefined;

    return COUNTRY_CODE_ISO_3166_1_ALPHA_2
        .filter((code) => !allowed || allowed.has(code))
        .map((code) => ({
            value: code,
            label: getCountryName(code),
            description: code,
            keywords: COUNTRY_ALIASES[code],
        }))
        .sort((left, right) => left.label.localeCompare(right.label, "en"));
}

export function CountryInput({
    value,
    onChange,
    options,
    emptyAsNull = false,
    placeholder = "Select country",
    disabled = false,
}: CountryInputProps) {
    const countryOptions = useMemo(() => buildCountryOptions(options), [options]);
    const selectedCode = typeof value === "string" ? value.toUpperCase() : undefined;

    return (
        <SearchableSelect
            options={countryOptions}
            value={selectedCode}
            onValueChange={(nextValue) =>
                onChange(nextValue ?? (emptyAsNull ? null : ""))
            }
            placeholder={placeholder}
            searchPlaceholder="Search countries"
            emptyMessage="No countries found"
            disabled={disabled}
            clearable
        />
    );
}
