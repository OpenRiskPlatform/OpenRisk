import { useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { Play, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  PluginEntrypointSelection,
  PluginInputDef,
  PluginRecord,
  ScanDetailRecord,
  ScanEntrypointInput,
  SettingValue,
} from "@/core/backend/bindings";
import { PluginField } from "@/shared/fields/PluginField";
import { displayName } from "@/shared/humanizeIdentifier";
import {
  buildScanInputs,
  type InvestigationValues,
} from "./scanInput";

interface InvestigationFormProps {
  plugins: PluginRecord[];
  draft: ScanDetailRecord | null;
  saveStatus: "idle" | "saving" | "saved";
  running: boolean;
  error: string | null;
  onDraftChange: (
    preview: string,
    selectedPlugins: PluginEntrypointSelection[],
    inputs: ScanEntrypointInput[],
  ) => void;
  onRun: (
    preview: string,
    selectedPlugins: PluginEntrypointSelection[],
    inputs: ScanEntrypointInput[],
  ) => Promise<void>;
}

function valueFromDefault(definition: PluginInputDef) {
  const value = definition.defaultValue;
  return !value || value.type === "null" ? null : value.value;
}

function valueFromSetting(value: SettingValue) {
  return value.type === "null" ? null : value.value;
}

function initialPluginId(draft: ScanDetailRecord | null) {
  return (
    draft?.selectedPlugins[0]?.pluginId ??
    draft?.inputs[0]?.pluginId ??
    ""
  );
}

function initialEntrypointIds(draft: ScanDetailRecord | null) {
  return Array.from(
    new Set(draft?.selectedPlugins.map((item) => item.entrypointId) ?? []),
  );
}

function initialValues(draft: ScanDetailRecord | null): InvestigationValues {
  return Object.fromEntries(
    (draft?.inputs ?? []).map((input) => [
      input.fieldName,
      valueFromSetting(input.value),
    ]),
  );
}

export function InvestigationForm({
  plugins,
  draft,
  saveStatus,
  running,
  error,
  onDraftChange,
  onRun,
}: InvestigationFormProps) {
  const [investigationName, setInvestigationName] = useState(
    () => draft?.preview ?? "",
  );
  const [pluginId, setPluginId] = useState(() => initialPluginId(draft));
  const [entrypointIds, setEntrypointIds] = useState(() =>
    initialEntrypointIds(draft),
  );
  const loadedDraftId = useRef(draft?.id ?? null);
  const firstAutosave = useRef(true);
  const onDraftChangeRef = useRef(onDraftChange);
  const {
    control,
    getValues,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<InvestigationValues>({
    defaultValues: initialValues(draft),
  });
  const watchedValues = useWatch({ control }) as InvestigationValues;
  const formLocked = running || isSubmitting;

  useEffect(() => {
    onDraftChangeRef.current = onDraftChange;
  }, [onDraftChange]);

  useEffect(() => {
    if (loadedDraftId.current && draft?.id === loadedDraftId.current) {
      setInvestigationName(draft.preview ?? "");
    }
  }, [draft?.id, draft?.preview]);

  const plugin = plugins.find((item) => item.id === pluginId) ?? null;

  const inputDefinitions = useMemo(() => {
    if (!plugin) {
      return [];
    }

    const selected = new Set(entrypointIds);
    const seen = new Set<string>();
    const definitions: PluginInputDef[] = [];

    for (const definition of plugin.inputDefs) {
      if (!selected.has(definition.entrypointId) || seen.has(definition.name)) {
        continue;
      }
      seen.add(definition.name);
      definitions.push(definition);
    }

    return definitions;
  }, [entrypointIds, plugin]);

  const valuesSnapshot = JSON.stringify(watchedValues);

  useEffect(() => {
    if (firstAutosave.current) {
      firstAutosave.current = false;
      return;
    }

    if (
      formLocked ||
      (!investigationName.trim() &&
        (!plugin || entrypointIds.length === 0))
    ) {
      return;
    }

    const values = JSON.parse(valuesSnapshot) as InvestigationValues;
    const selectedPlugins =
      plugin && entrypointIds.length > 0
        ? entrypointIds.map((entrypointId) => ({
            pluginId: plugin.id,
            entrypointId,
          }))
        : [];
    onDraftChangeRef.current(
      investigationName,
      selectedPlugins,
      plugin
        ? buildScanInputs(plugin, entrypointIds, values)
        : [],
    );
  }, [
    entrypointIds,
    formLocked,
    investigationName,
    plugin,
    valuesSnapshot,
  ]);

  const selectPlugin = (nextPluginId: string) => {
    setPluginId(nextPluginId);
    setEntrypointIds([]);
    reset({});
  };

  const toggleEntrypoint = (entrypointId: string, enabled: boolean) => {
    if (!plugin) {
      return;
    }

    const next = enabled
      ? [...entrypointIds, entrypointId]
      : entrypointIds.filter((item) => item !== entrypointId);
    setEntrypointIds(next);

    if (enabled) {
      for (const definition of plugin.inputDefs) {
        if (
          definition.entrypointId === entrypointId &&
          getValues(definition.name) === undefined
        ) {
          setValue(definition.name, valueFromDefault(definition));
        }
      }
    }
  };

  const submit = handleSubmit(async (values) => {
    if (!plugin || entrypointIds.length === 0) {
      return;
    }

    const selectedPlugins = entrypointIds.map((entrypointId) => ({
      pluginId: plugin.id,
      entrypointId,
    }));

    await onRun(
      investigationName,
      selectedPlugins,
      buildScanInputs(plugin, entrypointIds, values),
    );
  });

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <header>
        <div className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          <h1 className="text-2xl font-semibold">New investigation</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Your progress is saved as a draft. Running starts only when you press
          Run investigation.
        </p>
        {saveStatus !== "idle" ? (
          <p
            role="status"
            className="mt-2 text-xs text-muted-foreground"
          >
            {saveStatus === "saving" ? "Saving draft…" : "Draft saved"}
          </p>
        ) : null}
      </header>

      <div className="space-y-2 border-t pt-6">
        <Label htmlFor="investigation-name">Investigation name</Label>
        <Input
          id="investigation-name"
          value={investigationName}
          disabled={formLocked}
          placeholder="Untitled"
          onChange={(event) => setInvestigationName(event.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          This name is set only by you and does not change with search inputs.
        </p>
      </div>

      {plugins.length === 0 ? (
        <p className="border-t py-10 text-center text-sm text-muted-foreground">
          No enabled plugins. Open Settings to install or enable one.
        </p>
      ) : (
        <form onSubmit={(event) => void submit(event)}>
          <section className="space-y-3 border-t py-6">
            <h2 className="text-sm font-semibold">1. Source</h2>
            <Select
              value={pluginId}
              onValueChange={selectPlugin}
              disabled={formLocked}
            >
              <SelectTrigger aria-label="Plugin">
                <SelectValue placeholder="Select a plugin" />
              </SelectTrigger>
              <SelectContent>
                {plugins.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {displayName(item.name, item.id)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {plugin?.status && plugin.metricValues.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Status: {plugin.status}
              </p>
            ) : null}

            {plugin?.metricValues.length ? (
              <p className="text-xs text-muted-foreground">
                {plugin.metricValues.map((metric) => (
                  <span key={metric.name} className="mr-4">
                    {displayName(metric.title, metric.name)}:{" "}
                    {metric.value.type === "null"
                      ? "—"
                      : String(metric.value.value)}
                  </span>
                ))}
              </p>
            ) : null}
          </section>

          {plugin ? (
            <section className="border-t py-6">
              <h2 className="mb-3 text-sm font-semibold">2. Checks</h2>
              <div>
                {plugin.entrypoints.map((entrypoint) => {
                  const checked = entrypointIds.includes(entrypoint.id);
                  const entrypointName = displayName(
                    entrypoint.name,
                    entrypoint.id,
                  );
                  return (
                    <label
                      key={entrypoint.id}
                      className="flex cursor-pointer items-start gap-3 border-b py-3 first:border-t"
                    >
                      <Checkbox
                        checked={checked}
                        disabled={formLocked}
                        onCheckedChange={(value) =>
                          toggleEntrypoint(entrypoint.id, value === true)
                        }
                      />
                      <span>
                        <span className="block text-sm font-medium">
                          {entrypointName}
                        </span>
                        {entrypoint.description ? (
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {entrypoint.description}
                          </span>
                        ) : null}
                      </span>
                    </label>
                  );
                })}
              </div>
            </section>
          ) : null}

          {inputDefinitions.length > 0 ? (
            <section className="border-t py-6">
              <h2 className="mb-4 text-sm font-semibold">3. Inputs</h2>
              <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
                {inputDefinitions.map((definition) => {
                  const fieldId = `input-${definition.name}`;
                  const isBoolean = definition.type.name === "boolean";
                  const fieldName = displayName(
                    definition.title,
                    definition.name,
                  );
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
                            definition.optional ||
                            value === false ||
                            (value !== null &&
                              value !== undefined &&
                              String(value).trim() !== "") ||
                            `${fieldName} is required`,
                        }}
                        render={({ field }) => (
                          <>
                            {isBoolean ? (
                              <div className="flex min-h-9 items-center justify-between gap-4">
                                <Label htmlFor={fieldId}>
                                  {fieldName}
                                </Label>
                                <PluginField
                                  id={fieldId}
                                  type={definition.type}
                                  value={field.value}
                                  disabled={formLocked}
                                  onChange={field.onChange}
                                  onBlur={field.onBlur}
                                />
                              </div>
                            ) : (
                              <>
                                <Label htmlFor={fieldId}>
                                  {fieldName}
                                  {!definition.optional ? (
                                    <span className="ml-1 text-destructive">
                                      *
                                    </span>
                                  ) : null}
                                </Label>
                                <PluginField
                                  id={fieldId}
                                  type={definition.type}
                                  value={field.value}
                                  disabled={formLocked}
                                  placeholder={fieldName}
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
              </div>
            </section>
          ) : null}

          {error ? (
            <div role="alert" className="border-t border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          <div className="border-t pt-5">
            <Button
              type="submit"
              className="w-full gap-2"
              disabled={formLocked || !plugin || entrypointIds.length === 0}
            >
              <Play className="h-4 w-4" />
              {formLocked ? "Starting investigation…" : "Run investigation"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
