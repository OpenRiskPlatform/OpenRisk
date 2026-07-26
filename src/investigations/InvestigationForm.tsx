import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Play, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  ScanEntrypointInput,
} from "@/core/backend/bindings";
import { PluginField } from "@/shared/fields/PluginField";
import {
  buildScanInputs,
  deriveScanPreview,
  type InvestigationValues,
} from "./scanInput";

interface InvestigationFormProps {
  plugins: PluginRecord[];
  running: boolean;
  error: string | null;
  onRun: (
    selectedPlugins: PluginEntrypointSelection[],
    inputs: ScanEntrypointInput[],
    preview: string,
  ) => Promise<void>;
}

function valueFromDefault(definition: PluginInputDef) {
  const value = definition.defaultValue;
  return !value || value.type === "null" ? null : value.value;
}

export function InvestigationForm({
  plugins,
  running,
  error,
  onRun,
}: InvestigationFormProps) {
  const [pluginId, setPluginId] = useState("");
  const [entrypointIds, setEntrypointIds] = useState<string[]>([]);
  const {
    control,
    getValues,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<InvestigationValues>({ defaultValues: {} });

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
      selectedPlugins,
      buildScanInputs(plugin, entrypointIds, values),
      deriveScanPreview(plugin, values),
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
          Nothing is saved or executed until you press Run investigation.
        </p>
      </header>

      {plugins.length === 0 ? (
        <p className="border-t py-10 text-center text-sm text-muted-foreground">
          No enabled plugins. Open Settings to install or enable one.
        </p>
      ) : (
        <form onSubmit={(event) => void submit(event)}>
          <section className="space-y-3 border-t py-6">
              <h2 className="text-sm font-semibold">1. Source</h2>
              <Select value={pluginId} onValueChange={selectPlugin} disabled={running}>
                <SelectTrigger aria-label="Plugin">
                  <SelectValue placeholder="Select a plugin" />
                </SelectTrigger>
                <SelectContent>
                  {plugins.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
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
                      {metric.title}:{" "}
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
                  return (
                    <label
                      key={entrypoint.id}
                      className="flex cursor-pointer items-start gap-3 border-b py-3 first:border-t"
                    >
                      <Checkbox
                        checked={checked}
                        disabled={running}
                        onCheckedChange={(value) =>
                          toggleEntrypoint(entrypoint.id, value === true)
                        }
                      />
                      <span>
                        <span className="block text-sm font-medium">
                          {entrypoint.name}
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
                            `${definition.title} is required`,
                        }}
                        render={({ field }) => (
                          <>
                            {isBoolean ? (
                              <div className="flex min-h-9 items-center justify-between gap-4">
                                <Label htmlFor={fieldId}>
                                  {definition.title}
                                </Label>
                                <PluginField
                                  id={fieldId}
                                  type={definition.type}
                                  value={field.value}
                                  disabled={running}
                                  onChange={field.onChange}
                                  onBlur={field.onBlur}
                                />
                              </div>
                            ) : (
                              <>
                                <Label htmlFor={fieldId}>
                                  {definition.title}
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
                                  disabled={running}
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
              disabled={running || !plugin || entrypointIds.length === 0}
            >
              <Play className="h-4 w-4" />
              {running ? "Running investigation…" : "Run investigation"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
