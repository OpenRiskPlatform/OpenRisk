import { describe, expect, it } from "vitest";
import {
  displayName,
  humanizeIdentifier,
} from "@/shared/humanizeIdentifier";

describe("humanizeIdentifier", () => {
  it.each([
    ["some-name", "Some Name"],
    ["some_name", "Some Name"],
    ["someName", "Some Name"],
    ["HTTPServer", "HTTP Server"],
  ])("turns %s into a readable label", (identifier, expected) => {
    expect(humanizeIdentifier(identifier)).toBe(expected);
  });

  it("uses explicit metadata and falls back for an empty name", () => {
    expect(displayName("Custom label", "some-name")).toBe("Custom label");
    expect(displayName(" ", "some-name")).toBe("Some Name");
  });
});
