import type {
  PluginRecord,
  ScanEntrypointInput,
  SettingValue,
} from "@/core/backend/bindings";

export type InvestigationValues = Record<
  string,
  string | number | boolean | null | undefined
>;

export function toSettingValue(value: unknown): SettingValue {
  if (value === null || value === undefined || value === "") {
    return { type: "null" };
  }
  if (typeof value === "boolean") {
    return { type: "boolean", value };
  }
  if (typeof value === "number") {
    return { type: "number", value };
  }
  return { type: "string", value: String(value) };
}

export function buildScanInputs(
  plugin: PluginRecord,
  entrypointIds: string[],
  values: InvestigationValues,
): ScanEntrypointInput[] {
  const selectedIds = new Set(entrypointIds);

  return plugin.inputDefs
    .filter((definition) => selectedIds.has(definition.entrypointId))
    .map((definition) => ({
      pluginId: plugin.id,
      entrypointId: definition.entrypointId,
      fieldName: definition.name,
      value: toSettingValue(
        values[definition.name] ??
          (definition.defaultValue?.type === "null"
            ? null
            : definition.defaultValue?.value),
      ),
    }));
}
