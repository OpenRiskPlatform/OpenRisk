import { describe, expect, it } from "vitest";
import {
  buildScanInputs,
  toSettingValue,
} from "@/investigations/scanInput";
import { demoPlugin } from "./fixtures";

describe("scan input mapping", () => {
  it("preserves manifest field names", () => {
    const inputs = buildScanInputs(
      demoPlugin,
      ["person-search"],
      { name: "Ada Lovelace" },
    );

    expect(inputs).toEqual([
      {
        pluginId: "demo",
        entrypointId: "person-search",
        fieldName: "name",
        value: { type: "string", value: "Ada Lovelace" },
      },
    ]);
  });

  it("maps empty values to the backend null variant", () => {
    expect(toSettingValue("")).toEqual({ type: "null" });
  });
});
