import { useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface SearchableSelectOption {
    value: string;
    label: string;
    description?: string;
    keywords?: string[];
}

interface SearchableSelectProps {
    options: SearchableSelectOption[];
    value?: string;
    onValueChange: (value: string | undefined) => void;
    placeholder: string;
    searchPlaceholder?: string;
    emptyMessage: string;
    disabled?: boolean;
    clearable?: boolean;
}

export function SearchableSelect({
    options,
    value,
    onValueChange,
    placeholder,
    searchPlaceholder = "Search",
    emptyMessage,
    disabled = false,
    clearable = false,
}: SearchableSelectProps) {
    const [open, setOpen] = useState(false);
    const selectedOption = options.find((option) => option.value === value);

    const selectValue = (nextValue: string | undefined) => {
        onValueChange(nextValue);
        setOpen(false);
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    disabled={disabled}
                    className="w-full justify-between px-3 font-normal"
                >
                    <span className="min-w-0 truncate">
                        {selectedOption?.label ?? value ?? placeholder}
                    </span>
                    <span className="ml-auto flex shrink-0 items-center gap-2">
                        {selectedOption?.description ? (
                            <span className="font-mono text-xs text-muted-foreground">
                                {selectedOption.description}
                            </span>
                        ) : null}
                        <ChevronsUpDown className="opacity-50" />
                    </span>
                </Button>
            </PopoverTrigger>
            <PopoverContent
                align="start"
                className="w-[var(--radix-popover-trigger-width)] p-0"
            >
                <Command>
                    <CommandInput placeholder={searchPlaceholder} />
                    <CommandList>
                        <CommandEmpty>{emptyMessage}</CommandEmpty>
                        {clearable && value ? (
                            <>
                                <CommandGroup>
                                    <CommandItem
                                        value="Clear selection"
                                        onSelect={() => selectValue(undefined)}
                                    >
                                        <X />
                                        Clear selection
                                    </CommandItem>
                                </CommandGroup>
                                <CommandSeparator />
                            </>
                        ) : null}
                        <CommandGroup>
                            {options.map((option) => (
                                <CommandItem
                                    key={option.value}
                                    value={[
                                        option.label,
                                        option.value,
                                        ...(option.keywords ?? []),
                                    ].join(" ")}
                                    onSelect={() => selectValue(option.value)}
                                >
                                    <Check
                                        className={cn(
                                            "opacity-0",
                                            value === option.value && "opacity-100",
                                        )}
                                    />
                                    <span className="min-w-0 flex-1 truncate">
                                        {option.label}
                                    </span>
                                    {option.description ? (
                                        <span className="shrink-0 font-mono text-xs text-muted-foreground">
                                            {option.description}
                                        </span>
                                    ) : null}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
