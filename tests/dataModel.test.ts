import { describe, expect, it } from "vitest";
import {
  ENTITY_METADATA,
  OPENRISK_DATA_MODEL_VERSION,
  orderedPropertyNames,
  propertyMetadata,
} from "@/results/dataModel";

describe("SDK data model registry", () => {
  it("tracks model 0.0.3 and all canonical entity types", () => {
    expect(OPENRISK_DATA_MODEL_VERSION).toBe("0.0.3");
    expect(Object.keys(ENTITY_METADATA)).toEqual([
      "entity.person",
      "entity.organization",
      "entity.mediaMention",
      "entity.riskTopic",
      "entity.socialProfile",
      "entity.financialRecord",
      "entity.detectedEntity",
    ]);
  });

  it("includes the PEP associate status and RCA typed property", () => {
    expect(propertyMetadata("entity.person", "isPepRca")).toMatchObject({
      label: "PEP Relative / Close Associate",
      types: ["boolean"],
    });
    expect(
      propertyMetadata("entity.person", "relativeCloseAssociates"),
    ).toMatchObject({
      label: "Relatives and Close Associates",
      types: ["relative-close-associate"],
    });
  });

  it("orders declared properties but preserves unknown plugin keys", () => {
    expect(
      orderedPropertyNames("entity.person", [
        "custom_field",
        "sanctioned",
        "birthDate",
      ]),
    ).toEqual(["birthDate", "sanctioned", "custom_field"]);
    expect(propertyMetadata("entity.person", "custom_field")).toBeUndefined();
  });
});
