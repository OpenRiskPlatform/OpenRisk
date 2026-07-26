import { z } from "zod";

const entityGuard = z
  .object({
    $entity: z.string(),
    $id: z.string(),
  })
  .passthrough();

const entityArrayGuard = z.array(entityGuard);

export interface PluginEntity {
  $entity: string;
  $id: string;
  $modelVersion?: unknown;
  $sources?: unknown;
  $props?: unknown;
  $extra?: unknown;
  [key: string]: unknown;
}

export interface TypedValue {
  $type: string;
  value: unknown;
}

export interface PluginSource {
  name: string;
  source: string;
}

export type ParsedPluginData =
  | { kind: "entities"; entities: PluginEntity[]; raw: string }
  | { kind: "json"; value: unknown; raw: string }
  | { kind: "invalid-json"; error: string; raw: string };

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function isTypedValue(value: unknown): value is TypedValue {
  return (
    isRecord(value) &&
    typeof value.$type === "string" &&
    Object.prototype.hasOwnProperty.call(value, "value")
  );
}

export function typedValuePayload(value: unknown): unknown {
  return isTypedValue(value) ? value.value : value;
}

export function propertyValues(
  entity: PluginEntity,
  propertyName: string,
): unknown[] {
  if (!isRecord(entity.$props)) {
    return [];
  }
  const value = entity.$props[propertyName];
  if (value === undefined) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

export function firstPropertyValue(
  entity: PluginEntity,
  propertyName: string,
): unknown {
  return typedValuePayload(propertyValues(entity, propertyName)[0]);
}

export function pluginSources(entity: PluginEntity): PluginSource[] {
  if (!Array.isArray(entity.$sources)) {
    return [];
  }
  return entity.$sources.filter(
    (source): source is PluginSource =>
      isRecord(source) &&
      typeof source.name === "string" &&
      typeof source.source === "string",
  );
}

export function parsePluginData(dataJson: string): ParsedPluginData {
  try {
    const value: unknown = JSON.parse(dataJson);
    const guarded = entityArrayGuard.safeParse(value);

    if (guarded.success) {
      // The guard is validation only. Render the original parsed objects so no
      // plugin-provided keys are stripped or transformed.
      return {
        kind: "entities",
        entities: value as PluginEntity[],
        raw: dataJson,
      };
    }

    return { kind: "json", value, raw: dataJson };
  } catch (error) {
    return {
      kind: "invalid-json",
      error: error instanceof Error ? error.message : String(error),
      raw: dataJson,
    };
  }
}
