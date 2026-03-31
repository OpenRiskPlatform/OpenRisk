/**
 * OpenSanctions Plugin
 * Fetches person matches from OpenSanctions and normalizes them into the
 * OpenRisk entity model.
 */

const OPENSANCTIONS_API_URL = "https://api.opensanctions.org";
const OPENSANCTIONS_ENTITY_URL = "https://www.opensanctions.org/entities";

interface PluginInputs {
  search_input?: string;
  token?: string;
}

interface OpenSanctionsEntity {
  id: string;
  caption?: string;
  schema: string;
  properties?: Record<string, string[] | undefined>;
  datasets?: string[];
  referents?: string[];
  first_seen?: string;
  last_seen?: string;
  last_change?: string;
  target?: boolean;
  score?: number;
  match?: boolean;
  explanations?: Record<string, unknown>;
}

interface MatchResponse {
  responses?: {
    entity1?: {
      results?: OpenSanctionsEntity[];
    };
  };
}

interface TypedValue<T = unknown> {
  $type: string;
  value: T;
}

interface KeyValueEntry {
  $type: "key-value";
  value: {
    key: TypedValue<string>;
    value: TypedValue;
  };
}

interface PersonEntity {
  $entity: "entity.person";
  $id: string;
  $sources: Array<{
    name: string;
    source: string;
  }>;
  $props: Record<string, TypedValue[]>;
  $extra: KeyValueEntry[];
}

const PERSON_ID_PROPERTY_KEYS = [
  "personId",
  "nationalId",
  "nationalIdentificationNumber",
  "personalNumber",
  "personalCode",
  "ssn",
  "socialSecurityNumber",
  "taxNumber",
  "tin",
  "inn",
  "innCode",
  "cpf",
  "curp",
  "dni",
];

const DOCUMENT_ID_PROPERTY_KEYS = [
  "documentNumber",
  "documentId",
  "idNumber",
  "identificationNumber",
  "passportNumber",
  "passportNo",
  "passport",
  "identityCardNumber",
];

const PHOTO_PROPERTY_KEYS = [
  "imageUrl",
  "image",
  "photo",
  "photoUrl",
  "picture",
  "portrait",
];

const EXTRA_PROPERTY_KEYS = [
  "classification",
  "alias",
  "weakAlias",
  "firstName",
  "middleName",
  "fatherName",
  "gender",
  "title",
  "birthPlace",
  "birthCountry",
  "citizenship",
  "topics",
  "notes",
  "programId",
  "sourceUrl",
  "description",
  "wikidataId",
  "website",
  "political",
  "education",
  "religion",
  "ethnicity",
  "addressEntity",
  "createdAt",
  "modifiedAt",
  "uniqueEntityId",
];

function uniqueStrings(values: Array<string | undefined | null>): string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const value of values) {
    const normalized = value?.trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    output.push(normalized);
  }

  return output;
}

function getPropertyValues(
  properties: Record<string, string[] | undefined>,
  keys: string[]
): string[] {
  return uniqueStrings(
    keys.flatMap((key) => properties[key] ?? [])
  );
}

function stringValue(value: string): TypedValue<string> {
  return { $type: "string", value };
}

function numberValue(value: number): TypedValue<number> {
  return { $type: "number", value };
}

function booleanValue(value: boolean): TypedValue<boolean> {
  return { $type: "boolean", value };
}

function urlValue(value: string): TypedValue<string> {
  return { $type: "url", value };
}

function addressValue(value: string): TypedValue<string> {
  return { $type: "address", value };
}

function imageUrlValue(value: string): TypedValue<string> {
  return { $type: "image-url", value };
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isPartialIsoDate(value: string): boolean {
  return /^\d{4}(-\d{2})?$/.test(value);
}

function isIsoDateTime(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value);
}

function dateLikeValue(value: string): TypedValue<string> {
  if (isIsoDateTime(value)) {
    return { $type: "date-time-iso8601", value };
  }

  if (isIsoDate(value)) {
    return { $type: "date-iso8601", value };
  }

  if (isPartialIsoDate(value)) {
    return { $type: "date-partial-iso8601", value };
  }

  return stringValue(value);
}

function propertyValue(key: string, value: string): TypedValue<string> {
  const normalizedKey = key.toLowerCase();

  if (
    normalizedKey.includes("url") ||
    normalizedKey === "website" ||
    /^https?:\/\//i.test(value)
  ) {
    return urlValue(value);
  }

  if (
    normalizedKey.includes("photo") ||
    normalizedKey.includes("image") ||
    normalizedKey.includes("picture") ||
    normalizedKey.includes("portrait")
  ) {
    return imageUrlValue(value);
  }

  if (normalizedKey.includes("address")) {
    return addressValue(value);
  }

  if (
    normalizedKey.includes("date") ||
    normalizedKey.endsWith("at") ||
    normalizedKey.endsWith("_at") ||
    normalizedKey.includes("seen") ||
    normalizedKey.includes("change")
  ) {
    return dateLikeValue(value);
  }

  return stringValue(value);
}

function addProp(
  props: Record<string, TypedValue[]>,
  key: string,
  values: TypedValue[]
): void {
  if (values.length > 0) {
    props[key] = values;
  }
}

function addExtra(extra: KeyValueEntry[], key: string, value: TypedValue): void {
  extra.push({
    $type: "key-value",
    value: {
      key: stringValue(key),
      value,
    },
  });
}

function computeAge(birthDate: string): number | null {
  if (!isIsoDate(birthDate)) {
    return null;
  }

  const birth = new Date(`${birthDate}T00:00:00Z`);
  if (Number.isNaN(birth.getTime())) {
    return null;
  }

  const now = new Date();
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const hasBirthdayPassed =
    now.getUTCMonth() > birth.getUTCMonth() ||
    (now.getUTCMonth() === birth.getUTCMonth() &&
      now.getUTCDate() >= birth.getUTCDate());

  if (!hasBirthdayPassed) {
    age -= 1;
  }

  return age >= 0 ? age : null;
}

function buildProps(entity: OpenSanctionsEntity): Record<string, TypedValue[]> {
  const properties = entity.properties ?? {};
  const props: Record<string, TypedValue[]> = {};

  const displayName =
    entity.caption?.trim() || getPropertyValues(properties, ["name"])[0];
  const surnames = getPropertyValues(properties, ["lastName"]);
  const positions = getPropertyValues(properties, ["position"]);
  const countries = getPropertyValues(properties, ["country"]);
  const countryValues =
    countries.length > 0
      ? countries
      : getPropertyValues(properties, ["birthCountry"]);
  const birthDates = getPropertyValues(properties, ["birthDate"]);
  const photos = getPropertyValues(properties, PHOTO_PROPERTY_KEYS);
  const personIds = getPropertyValues(properties, PERSON_ID_PROPERTY_KEYS);
  const nationalities = getPropertyValues(properties, [
    "nationality",
    "citizenship",
  ]);
  const residenceAddresses = getPropertyValues(properties, ["address"]);
  const documentIds = getPropertyValues(properties, DOCUMENT_ID_PROPERTY_KEYS);

  if (displayName) {
    addProp(props, "name", [stringValue(displayName)]);
  }

  addProp(props, "surname", surnames.map(stringValue));
  addProp(props, "position", positions.map(stringValue));
  addProp(props, "country", countryValues.map(stringValue));
  addProp(props, "birthDate", birthDates.map(dateLikeValue));
  addProp(props, "photo", photos.map(imageUrlValue));
  addProp(props, "personId", personIds.map(stringValue));
  addProp(props, "nationality", nationalities.map(stringValue));
  addProp(props, "residenceAddress", residenceAddresses.map(addressValue));
  addProp(props, "documentId", documentIds.map(stringValue));

  const age = birthDates.length > 0 ? computeAge(birthDates[0]) : null;
  if (age !== null) {
    addProp(props, "age", [numberValue(age)]);
  }

  return props;
}

function buildExtra(entity: OpenSanctionsEntity): KeyValueEntry[] {
  const properties = entity.properties ?? {};
  const extra: KeyValueEntry[] = [];

  addExtra(extra, "schema", stringValue(entity.schema));

  if (typeof entity.score === "number") {
    addExtra(extra, "score", numberValue(entity.score));
  }

  if (typeof entity.match === "boolean") {
    addExtra(extra, "match", booleanValue(entity.match));
  }

  if (typeof entity.target === "boolean") {
    addExtra(extra, "target", booleanValue(entity.target));
  }

  if (entity.first_seen) {
    addExtra(extra, "first_seen", dateLikeValue(entity.first_seen));
  }

  if (entity.last_seen) {
    addExtra(extra, "last_seen", dateLikeValue(entity.last_seen));
  }

  if (entity.last_change) {
    addExtra(extra, "last_change", dateLikeValue(entity.last_change));
  }

  for (const dataset of uniqueStrings(entity.datasets ?? [])) {
    addExtra(extra, "dataset", stringValue(dataset));
  }

  for (const referent of uniqueStrings(entity.referents ?? [])) {
    addExtra(extra, "referent", stringValue(referent));
  }

  if (entity.explanations) {
    addExtra(
      extra,
      "explanations_json",
      stringValue(JSON.stringify(entity.explanations))
    );
  }

  for (const key of EXTRA_PROPERTY_KEYS) {
    for (const value of uniqueStrings(properties[key] ?? [])) {
      addExtra(extra, key, propertyValue(key, value));
    }
  }

  return extra;
}

function normalizePersonEntity(entity: OpenSanctionsEntity): PersonEntity {
  return {
    $entity: "entity.person",
    $id: `opensanctions:${entity.id}`,
    $sources: [
      {
        name: "OpenSanctions API",
        source: `${OPENSANCTIONS_API_URL}/match/default?schema=Person`,
      },
      {
        name: "OpenSanctions entity",
        source: `${OPENSANCTIONS_ENTITY_URL}/${encodeURIComponent(entity.id)}/`,
      },
    ],
    $props: buildProps(entity),
    $extra: buildExtra(entity),
  };
}

/**
 * Matches a person name against OpenSanctions.
 */
export async function matchPersons(inputs: PluginInputs): Promise<PersonEntity[]> {
  const searchInput = inputs.search_input?.trim();
  const token = inputs.token?.trim();

  if (!searchInput) {
    throw new Error("search_input is required");
  }

  if (!token) {
    throw new Error("token is required");
  }

  const url = new URL("/match/default", OPENSANCTIONS_API_URL);
  url.searchParams.set("schema", "Person");

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: {
      Authorization: `ApiKey ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      queries: {
        entity1: {
          schema: "Person",
          properties: {
            name: [searchInput],
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenSanctions request failed (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as MatchResponse;
  const results = data.responses?.entity1?.results ?? [];

  return results
    .filter((entity) => entity.schema === "Person")
    .map(normalizePersonEntity);
}
