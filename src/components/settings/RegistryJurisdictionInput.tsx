import { useEffect, useMemo, useRef, useState } from "react";
import {
    formatRegistryJurisdictionValue,
    REGISTRY_JURISDICTION_OPTIONS,
} from "@/core/registryJurisdictions";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

const MAX_VISIBLE_RESULTS = 12;

interface RegistryJurisdictionInputProps {
    value: unknown;
    onChange: (value: unknown) => void;
    options?: string[];
    emptyAsNull?: boolean;
    placeholder?: string;
    disabled?: boolean;
}

function normalizeSearch(value: string): string {
    return value.trim().toLowerCase();
}

export function RegistryJurisdictionInput({
    value,
    onChange,
    options,
    emptyAsNull = false,
    placeholder = "Search jurisdictions",
    disabled = false,
}: RegistryJurisdictionInputProps) {
    const rootRef = useRef<HTMLDivElement>(null);
    const selectedCode = typeof value === "string" ? value : "";
    const [query, setQuery] = useState(
        selectedCode ? formatRegistryJurisdictionValue(selectedCode) : "",
    );
    const [open, setOpen] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(0);

    const availableOptions = useMemo(() => {
        if (!options?.length) {
            return REGISTRY_JURISDICTION_OPTIONS;
        }

        const allowed = new Set(options);
        return REGISTRY_JURISDICTION_OPTIONS.filter((option) =>
            allowed.has(option.value),
        );
    }, [options]);

    const filteredOptions = useMemo(() => {
        const normalized = normalizeSearch(query);
        const results = normalized.length === 0
            ? availableOptions
            : availableOptions.filter((option) => {
                const haystack = `${option.label} ${option.value}`.toLowerCase();
                return haystack.includes(normalized);
            });

        return results.slice(0, MAX_VISIBLE_RESULTS);
    }, [availableOptions, query]);

    const exactMatch = useMemo(() => {
        const normalized = normalizeSearch(query);
        if (!normalized) {
            return undefined;
        }

        return availableOptions.find((option) => {
            const display = formatRegistryJurisdictionValue(option.value).toLowerCase();
            return (
                option.value.toLowerCase() === normalized ||
                option.label.toLowerCase() === normalized ||
                display === normalized
            );
        });
    }, [availableOptions, query]);

    useEffect(() => {
        if (!open) {
            setQuery(selectedCode ? formatRegistryJurisdictionValue(selectedCode) : "");
        }
    }, [open, selectedCode]);

    useEffect(() => {
        setHighlightedIndex(0);
    }, [query]);

    const commit = (nextCode?: string) => {
        if (nextCode) {
            onChange(nextCode);
            setQuery(formatRegistryJurisdictionValue(nextCode));
        } else {
            onChange(emptyAsNull ? null : "");
            setQuery("");
        }
        setOpen(false);
    };

    const resetToSelectedValue = () => {
        setQuery(selectedCode ? formatRegistryJurisdictionValue(selectedCode) : "");
        setOpen(false);
    };

    return (
        <div ref={rootRef} className="relative">
            <Input
                type="text"
                value={query}
                placeholder={placeholder}
                disabled={disabled}
                onFocus={() => setOpen(true)}
                onBlur={() => {
                    window.setTimeout(() => {
                        if (rootRef.current?.contains(document.activeElement)) {
                            return;
                        }

                        if (!query.trim()) {
                            commit();
                            return;
                        }

                        if (exactMatch) {
                            commit(exactMatch.value);
                            return;
                        }

                        resetToSelectedValue();
                    }, 0);
                }}
                onChange={(event) => {
                    if (disabled) {
                        return;
                    }
                    setQuery(event.target.value);
                    setOpen(true);
                }}
                onKeyDown={(event) => {
                    if (disabled) {
                        return;
                    }
                    if (event.key === "ArrowDown") {
                        event.preventDefault();
                        setOpen(true);
                        setHighlightedIndex((current) =>
                            Math.min(current + 1, Math.max(filteredOptions.length - 1, 0)),
                        );
                        return;
                    }

                    if (event.key === "ArrowUp") {
                        event.preventDefault();
                        setHighlightedIndex((current) => Math.max(current - 1, 0));
                        return;
                    }

                    if (event.key === "Enter") {
                        event.preventDefault();
                        const selected = filteredOptions[highlightedIndex] ?? exactMatch;
                        if (selected) {
                            commit(selected.value);
                        }
                        return;
                    }

                    if (event.key === "Escape") {
                        event.preventDefault();
                        resetToSelectedValue();
                    }
                }}
            />

            {open ? (
                <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md">
                    <ScrollArea className="max-h-72">
                        {filteredOptions.length > 0 ? (
                            <div className="p-1">
                                {filteredOptions.map((option, index) => (
                                    <button
                                        key={option.value}
                                        type="button"
                                        className={cn(
                                            "flex w-full flex-col items-start rounded-sm px-3 py-2 text-left text-sm",
                                            highlightedIndex === index
                                                ? "bg-accent text-accent-foreground"
                                                : "hover:bg-accent/60",
                                        )}
                                        onMouseDown={(event) => event.preventDefault()}
                                        onMouseEnter={() => setHighlightedIndex(index)}
                                        onClick={() => commit(option.value)}
                                    >
                                        <span>{option.label}</span>
                                        <span className="text-xs text-muted-foreground font-mono">
                                            {option.value}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <p className="px-3 py-2 text-sm text-muted-foreground">
                                No jurisdictions found
                            </p>
                        )}
                    </ScrollArea>
                </div>
            ) : null}
        </div>
    );
}
