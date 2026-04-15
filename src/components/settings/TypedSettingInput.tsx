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
}

export function TypedSettingInput({
    typeName,
    options,
    value,
    onChange,
    emptyAsNull = false,
}: TypedSettingInputProps) {
    if (options && options.length > 0) {
        const strValue = value === null || value === undefined ? "" : String(value);
        return (
            <Select value={strValue || options[0]} onValueChange={(v) => onChange(v)}>
                <SelectTrigger>
                    <SelectValue />
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
                />
            </div>
        );
    }

    if (typeName === "number" || typeName === "integer") {
        return (
            <Input
                type="number"
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
                value={value === null || value === undefined ? "" : String(value)}
                onChange={(event) => onChange(event.target.value)}
            />
        );
    }

    if (typeName === "url") {
        return (
            <Input
                type="url"
                value={value === null || value === undefined ? "" : String(value)}
                onChange={(event) => onChange(event.target.value)}
            />
        );
    }

    return (
        <Input
            type="text"
            value={value === null || value === undefined ? "" : String(value)}
            onChange={(event) => onChange(event.target.value)}
        />
    );
}
