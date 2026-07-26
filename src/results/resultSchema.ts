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

export type ParsedPluginData =
  | { kind: "entities"; entities: PluginEntity[]; raw: string }
  | { kind: "json"; value: unknown; raw: string }
  | { kind: "invalid-json"; error: string; raw: string };

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
