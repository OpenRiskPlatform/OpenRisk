import { describe, expect, it } from "vitest";
import { parsePluginData } from "@/results/resultSchema";

describe("parsePluginData", () => {
  it("validates entities without stripping unknown keys", () => {
    const raw = JSON.stringify([
      {
        $entity: "entity.unknown",
        $id: "unknown:1",
        untouched_key: { nested_key: "value" },
      },
    ]);

    const result = parsePluginData(raw);
    expect(result.kind).toBe("entities");
    if (result.kind === "entities") {
      expect(result.entities[0].untouched_key).toEqual({
        nested_key: "value",
      });
    }
  });

  it("returns raw output for malformed JSON", () => {
    const result = parsePluginData("{invalid");
    expect(result).toMatchObject({
      kind: "invalid-json",
      raw: "{invalid",
    });
  });

  it("uses raw JSON fallback for an unknown output shape", () => {
    const result = parsePluginData('{"answer":42}');
    expect(result).toMatchObject({
      kind: "json",
      raw: '{"answer":42}',
    });
  });
});
