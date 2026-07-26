/**
 * Frontend projection of the OpenRisk plugin SDK data model v0.0.3.
 *
 * Semantic source of truth:
 * openrisk-plugin-sdk/model/data-model-v0.0.3.ts
 *
 * Keep unknown plugin-provided property names unchanged. This registry only
 * supplies labels and ordering for properties declared by the SDK.
 */
export const OPENRISK_DATA_MODEL_VERSION = "0.0.3";

export interface PropertyMetadata {
  label: string;
  types: readonly string[];
  multiplicity: "one" | "many";
}

export interface EntityMetadata {
  label: string;
  icon:
    | "user"
    | "building"
    | "newspaper"
    | "radar"
    | "at-sign"
    | "receipt"
    | "spark";
  properties: Record<string, PropertyMetadata>;
}

const property = (
  label: string,
  types: string | readonly string[],
  multiplicity: "one" | "many" = "one",
): PropertyMetadata => ({
  label,
  types: typeof types === "string" ? [types] : types,
  multiplicity,
});

const commonProperties = {
  name: property("Name", "string", "many"),
  aliases: property("Aliases", "string", "many"),
  notes: property("Notes", "string", "many"),
} satisfies Record<string, PropertyMetadata>;

export const ENTITY_METADATA: Record<string, EntityMetadata> = {
  "entity.person": {
    label: "Person",
    icon: "user",
    properties: {
      ...commonProperties,
      birthDate: property(
        "Birth Date",
        ["date-iso8601", "date-partial-iso8601", "date-time-iso8601"],
        "many",
      ),
      birthPlace: property("Birth Place", "string", "many"),
      nationalities: property("Nationalities", "string", "many"),
      jurisdiction: property(
        "Jurisdiction",
        "jurisdiction-iso-3166-2",
        "many",
      ),
      addresses: property("Addresses", "address", "many"),
      emails: property("Emails", "string", "many"),
      phones: property("Phones", "string", "many"),
      relativeCloseAssociates: property(
        "Relatives and Close Associates",
        "relative-close-associate",
        "many",
      ),
      pepStatus: property("PEP Status", "boolean"),
      isPepRca: property("PEP Relative / Close Associate", "boolean"),
      sanctioned: property("Sanctioned", "boolean"),
    },
  },
  "entity.organization": {
    label: "Organization",
    icon: "building",
    properties: {
      ...commonProperties,
      previousNames: property("Previous Names", "string", "many"),
      registrationId: property("Registration ID", "string"),
      country: property("Country", "string", "many"),
      jurisdiction: property(
        "Jurisdiction",
        "jurisdiction-iso-3166-2",
        "many",
      ),
      address: property("Address", "address"),
      status: property("Status", "string"),
      involvedPersons: property("Involved Persons", "string", "many"),
      legalRoles: property("Legal Roles", "string", "many"),
      sourceRegister: property("Source Register", "string"),
      entryTypes: property("Entry Types", "string", "many"),
      effectiveTo: property("Effective To", [
        "date-iso8601",
        "date-partial-iso8601",
        "date-time-iso8601",
      ]),
      pepStatus: property("PEP Status", "boolean"),
      sanctioned: property("Sanctioned", "boolean"),
    },
  },
  "entity.mediaMention": {
    label: "Media Mention",
    icon: "newspaper",
    properties: {
      name: commonProperties.name,
      title: property("Title", "string"),
      url: property("URL", "url"),
      analysis: property("Analysis", "string"),
      adverseActivityDetected: property(
        "Adverse Activity Detected",
        "boolean",
      ),
    },
  },
  "entity.riskTopic": {
    label: "Risk Topic",
    icon: "radar",
    properties: {
      name: commonProperties.name,
      topicId: property("Topic ID", "string"),
      summary: property("Summary", "string"),
      adverseActivityDetected: property(
        "Adverse Activity Detected",
        "boolean",
      ),
    },
  },
  "entity.socialProfile": {
    label: "Social Profile",
    icon: "at-sign",
    properties: {
      name: commonProperties.name,
      platform: property("Platform", "string"),
      profileTitle: property("Profile Title", "string"),
      profileUrl: property("Profile URL", "url"),
      userId: property("User ID", "string"),
    },
  },
  "entity.financialRecord": {
    label: "Financial Record",
    icon: "receipt",
    properties: {
      name: commonProperties.name,
      amountOwed: property("Amount Owed", "string"),
      location: property("Location", "address"),
      debtSource: property("Debt Source", "string"),
    },
  },
  "entity.detectedEntity": {
    label: "Detected Entity",
    icon: "spark",
    properties: {
      name: commonProperties.name,
      description: property("Description", "string"),
    },
  },
};

export function entityMetadata(entityType: string): EntityMetadata | undefined {
  return ENTITY_METADATA[entityType];
}

export function propertyMetadata(
  entityType: string,
  propertyName: string,
): PropertyMetadata | undefined {
  return ENTITY_METADATA[entityType]?.properties[propertyName];
}

export function orderedPropertyNames(
  entityType: string,
  propertyNames: string[],
): string[] {
  const knownOrder = Object.keys(
    ENTITY_METADATA[entityType]?.properties ?? {},
  );
  const present = new Set(propertyNames);
  const known = knownOrder.filter((name) => present.has(name));
  const unknown = propertyNames.filter((name) => !knownOrder.includes(name));
  return [...known, ...unknown];
}
