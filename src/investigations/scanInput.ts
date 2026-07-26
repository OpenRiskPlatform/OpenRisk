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

export function deriveScanPreview(
  plugin: PluginRecord,
  values: InvestigationValues,
): string {
  const preferredFields = [
    "name",
    "target",
    "search_input",
    "targetName",
    "subject",
    "query",
    "full_name",
    "person_name",
    "company_name",
    "ico",
    "org_ico",
  ];

  for (const fieldName of preferredFields) {
    const value = values[fieldName];
    if (value !== null && value !== undefined && String(value).trim()) {
      return String(value).replace(/\s+/g, " ").trim().slice(0, 120);
    }
  }

  const firstValue = Object.values(values).find(
    (value) =>
      value !== null && value !== undefined && String(value).trim().length > 0,
  );

  return firstValue === undefined
    ? plugin.name
    : String(firstValue).replace(/\s+/g, " ").trim().slice(0, 120);
}
