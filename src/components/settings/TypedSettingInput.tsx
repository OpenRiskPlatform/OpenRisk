import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface TypedSettingInputProps {
    typeName: string;
    options?: string[];
    value: unknown;
    onChange: (value: unknown) => void;
    emptyAsNull?: boolean;
    placeholder?: string;
    disabled?: boolean;
}

export function TypedSettingInput({
    typeName,
    options,
    value,
    onChange,
    emptyAsNull = false,
    placeholder,
    disabled = false,
}: TypedSettingInputProps) {
    if (options && options.length > 0) {
        const strValue = value === null || value === undefined ? "" : String(value);
        return (
            <Select value={strValue || options[0]} onValueChange={(v) => onChange(v)} disabled={disabled}>
                <SelectTrigger>
                    <SelectValue placeholder={placeholder} />
                </SelectTrigger>
                <SelectContent>
                    {options.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                            {opt}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        );
    }

    if (typeName === "boolean") {
        return (
            <div className="pt-1">
                <Switch
                    checked={Boolean(value)}
                    onCheckedChange={(checked) => onChange(checked)}
                    disabled={disabled}
                />
            </div>
        );
    }

    if (typeName === "number" || typeName === "integer") {
        return (
            <Input
                type="number"
                placeholder={placeholder}
                disabled={disabled}
                value={typeof value === "number" ? String(value) : ""}
                onChange={(event) => {
                    const raw = event.target.value;
                    if (!raw.trim()) {
                        onChange(emptyAsNull ? null : undefined);
                        return;
                    }
                    const parsed = Number(raw);
                    onChange(Number.isNaN(parsed) ? (emptyAsNull ? null : undefined) : parsed);
                }}
            />
        );
    }

    if (typeName === "date") {
        return (
            <Input
                type="date"
                placeholder={placeholder}
                disabled={disabled}
                value={value === null || value === undefined ? "" : String(value)}
                onChange={(event) => onChange(event.target.value)}
            />
        );
    }

    if (typeName === "url") {
        return (
            <Input
                type="url"
                placeholder={placeholder}
                disabled={disabled}
                value={value === null || value === undefined ? "" : String(value)}
                onChange={(event) => onChange(event.target.value)}
            />
        );
    }

    return (
        <Input
            type="text"
            placeholder={placeholder}
            disabled={disabled}
            value={value === null || value === undefined ? "" : String(value)}
            onChange={(event) => onChange(event.target.value)}
        />
    );
}
