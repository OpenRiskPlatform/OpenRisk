import { type FormEvent, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { PluginRecord } from "@/core/backend/bindings";
import type { OpenRiskClient } from "@/backend/OpenRiskClient";
import { PluginField } from "@/shared/fields/PluginField";
import {
  toSettingValue,
  type InvestigationValues,
} from "@/investigations/scanInput";

interface PluginSettingsFormProps {
  client: OpenRiskClient;
  plugin: PluginRecord;
  readOnly: boolean;
  onPluginUpdated: (plugin: PluginRecord) => void;
}

function settingDefaults(plugin: PluginRecord): InvestigationValues {
  const defaults: InvestigationValues = {};
  const savedValues = new Map(
    plugin.settingValues.map((item) => [item.name, item.value]),
  );

  for (const definition of plugin.settingDefs) {
    const saved = savedValues.get(definition.name);
    const fallback = definition.defaultValue;
    const value = saved ?? fallback;
    defaults[definition.name] =
      !value || value.type === "null" ? null : value.value;
  }

  return defaults;
}

export function PluginSettingsForm({
  client,
  plugin,
  readOnly,
  onPluginUpdated,
}: PluginSettingsFormProps) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    reset,
    formState: { dirtyFields, errors, isDirty },
  } = useForm<InvestigationValues>({
    defaultValues: settingDefaults(plugin),
  });

  const save = handleSubmit(async (values) => {
    const changedDefinitions = plugin.settingDefs.filter(
      (definition) => dirtyFields[definition.name],
    );
    setPending(true);
    setMessage(null);
    try {
      let updated = plugin;
      for (const definition of changedDefinitions) {
        updated = await client.setPluginSetting(
          plugin.id,
          definition.name,
          toSettingValue(values[definition.name]),
        );
      }
      onPluginUpdated(updated);
      reset(settingDefaults(updated));
      setMessage("Settings saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setPending(false);
    }
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    if (!isDirty) {
      event.preventDefault();
      setMessage("No changes to save.");
      return;
    }
    void save(event);
  };

  if (plugin.settingDefs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        This plugin has no configurable settings.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {plugin.settingDefs.map((definition) => {
        const fieldId = `setting-${plugin.id}-${definition.name}`;
        const isBoolean = definition.type.name === "boolean";
        return (
          <div
            key={definition.name}
            className={isBoolean ? "space-y-1" : "space-y-2"}
          >
            <Controller
              name={definition.name}
              control={control}
              rules={{
                validate: (value) =>
                  !definition.required ||
                  value === false ||
                  (value !== null &&
                    value !== undefined &&
                    String(value).trim() !== "") ||
                  `${definition.title} is required`,
              }}
              render={({ field }) => (
                <>
                  {isBoolean ? (
                    <div className="flex min-h-9 items-center justify-between gap-4">
                      <Label htmlFor={fieldId}>{definition.title}</Label>
                      <PluginField
                        id={fieldId}
                        type={definition.type}
                        value={field.value}
                        disabled={readOnly || pending}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                      />
                    </div>
                  ) : (
                    <>
                      <Label htmlFor={fieldId}>
                        {definition.title}
                        {definition.required ? (
                          <span className="ml-1 text-destructive">*</span>
                        ) : null}
                      </Label>
                      <PluginField
                        id={fieldId}
                        type={definition.type}
                        value={field.value}
                        secret={definition.secret}
                        disabled={readOnly || pending}
                        placeholder={definition.title}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                      />
                    </>
                  )}
                </>
              )}
            />
            {definition.description ? (
              <p className="text-xs text-muted-foreground">
                {definition.description}
              </p>
            ) : null}
            {errors[definition.name]?.message ? (
              <p role="alert" className="text-xs text-destructive">
                {String(errors[definition.name]?.message)}
              </p>
            ) : null}
          </div>
        );
      })}

      {message ? (
        <p role="status" className="text-sm text-muted-foreground">
          {message}
        </p>
      ) : null}

      {!readOnly ? (
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save settings"}
        </Button>
      ) : null}
    </form>
  );
}
