import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { PluginFieldTypeDef } from "@/core/backend/bindings";

type FieldValue = string | number | boolean | null | undefined;

interface PluginFieldProps {
  id: string;
  type: PluginFieldTypeDef;
  value: FieldValue;
  disabled?: boolean;
  secret?: boolean;
  placeholder?: string;
  onChange: (value: FieldValue) => void;
  onBlur?: () => void;
}

export function PluginField({
  id,
  type,
  value,
  disabled = false,
  secret = false,
  placeholder,
  onChange,
  onBlur,
}: PluginFieldProps) {
  if (type.values?.length) {
    return (
      <Select
        value={typeof value === "string" ? value : ""}
        disabled={disabled}
        onValueChange={onChange}
      >
        <SelectTrigger id={id} onBlur={onBlur}>
          <SelectValue placeholder={placeholder ?? "Select a value"} />
        </SelectTrigger>
        <SelectContent>
          {type.values.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (type.name === "boolean") {
    return (
      <Switch
        id={id}
        checked={value === true}
        disabled={disabled}
        onCheckedChange={onChange}
        onBlur={onBlur}
      />
    );
  }

  if (type.name === "number" || type.name === "integer") {
    return (
      <Input
        id={id}
        type="number"
        step={type.name === "integer" ? 1 : "any"}
        value={typeof value === "number" ? value : ""}
        disabled={disabled}
        placeholder={placeholder}
        onBlur={onBlur}
        onChange={(event) => {
          if (!event.target.value) {
            onChange(null);
            return;
          }
          const parsed = Number(event.target.value);
          onChange(Number.isNaN(parsed) ? null : parsed);
        }}
      />
    );
  }

  return (
    <Input
      id={id}
      type={
        secret
          ? "password"
          : type.name === "date"
            ? "date"
            : type.name === "url"
              ? "url"
              : "text"
      }
      value={typeof value === "string" ? value : ""}
      disabled={disabled}
      autoComplete={secret ? "off" : undefined}
      placeholder={placeholder}
      onBlur={onBlur}
      onChange={(event) => onChange(event.target.value || null)}
    />
  );
}
