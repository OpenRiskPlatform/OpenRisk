/**
 * OpenCorporates Plugin
 *
 * Uses OpenCorporates search endpoints that map cleanly to the current OpenRisk
 * data model:
 *   - companies/search -> entity.organization[]
 *   - officers/search  -> entity.person[]
 */

const OPENCORPORATES_API_URL = "https://api.opencorporates.com/v0.4";

interface PluginInputs {
  search_input?: string;
  token?: string;
  jurisdiction_code?: string;
  limit?: number;
  inactive?: boolean;
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

interface DataModelEntity {
  $entity: string;
  $id: string;
  $sources?: Array<{
    name: string;
    source: string;
  }>;
  $props?: Record<string, TypedValue[]>;
  $extra?: KeyValueEntry[];
}

function metricSet(name: string, value: unknown): void {
  (globalThis as any).openrisk?.metrics?.set?.(name, value);
}

function metricInc(name: string, delta = 1): void {
  (globalThis as any).openrisk?.metrics?.inc?.(name, delta);
}

interface OpenCorporatesAddress {
  street_address?: string | null;
  locality?: string | null;
  region?: string | null;
  postal_code?: string | null;
  country?: string | null;
}

interface OpenCorporatesPreviousName {
  company_name?: string | null;
  start_date?: string | null;
  end_date?: string | null;
}

interface OpenCorporatesAlternativeNameObject {
  company_name?: string | null;
  name?: string | null;
}

interface OpenCorporatesIndustryCodeItem {
  industry_code?: {
    code?: string | null;
    description?: string | null;
    code_scheme_id?: string | null;
    code_scheme_name?: string | null;
    uid?: string | null;
  } | null;
}

interface OpenCorporatesSource {
  publisher?: string | null;
  url?: string | null;
  terms?: string | null;
  retrieved_at?: string | null;
}

interface OpenCorporatesCompany {
  name?: string | null;
  company_number?: string | null;
  native_company_number?: string | null;
  jurisdiction_code?: string | null;
  incorporation_date?: string | null;
  dissolution_date?: string | null;
  company_type?: string | null;
  registry_url?: string | null;
  branch?: boolean | null;
  branch_status?: string | null;
  inactive?: boolean | null;
  current_status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  retrieved_at?: string | null;
  opencorporates_url?: string | null;
  previous_names?: OpenCorporatesPreviousName[] | null;
  alternative_names?:
  | Array<string | OpenCorporatesAlternativeNameObject>
  | null;
  source?: OpenCorporatesSource | null;
  registered_address?: OpenCorporatesAddress | null;
  registered_address_in_full?: string | null;
  industry_codes?: OpenCorporatesIndustryCodeItem[] | null;
}

interface OpenCorporatesOfficerCompanyRef {
  name?: string | null;
  jurisdiction_code?: string | null;
  company_number?: string | null;
  opencorporates_url?: string | null;
}

interface OpenCorporatesOfficer {
  id?: number | null;
  uid?: string | null;
  name?: string | null;
  jurisdiction_code?: string | null;
  position?: string | null;
  retrieved_at?: string | null;
  opencorporates_url?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  occupation?: string | null;
  current_status?: string | null;
  inactive?: boolean | null;
  address?: string | null;
  nationality?: string | null;
  date_of_birth?: string | null;
  company?: OpenCorporatesOfficerCompanyRef | null;
}

interface CompanySearchResponse {
  results?: {
    companies?: Array<{
      company?: OpenCorporatesCompany;
    }>;
  };
}

interface OfficerSearchResponse {
  results?: {
    officers?: Array<{
      officer?: OpenCorporatesOfficer;
    }>;
  };
}

export function validate(
  settings: Record<string, unknown>
): { ok: boolean; error?: string } {
  if (!settings.token || String(settings.token).trim() === "") {
    return {
      ok: false,
      error: "OpenCorporates API token is required. Please set it in plugin settings.",
    };
  }

  return { ok: true };
}

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

function stringValue(value: string): TypedValue<string> {
  return { $type: "string", value };
}

function booleanValue(value: boolean): TypedValue<boolean> {
  return { $type: "boolean", value };
}

function addressValue(value: string): TypedValue<string> {
  return { $type: "address", value };
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

function requireSearchInput(inputs: PluginInputs): string {
  const searchInput = inputs.search_input?.trim();
  if (!searchInput) {
    throw new Error("search_input is required");
  }
  return searchInput;
}

function requireToken(inputs: PluginInputs): string {
  const token = inputs.token?.trim();
  if (!token) {
    throw new Error("token is required");
  }
  return token;
}

function resolveLimit(limit: unknown): number {
  if (typeof limit === "number" && Number.isFinite(limit)) {
    return Math.max(1, Math.min(25, Math.floor(limit)));
  }
  return 5;
}

function buildSearchUrl(
  path: string,
  inputs: PluginInputs,
  token: string
): URL {
  const url = new URL(path, `${OPENCORPORATES_API_URL}/`);
  url.searchParams.set("q", requireSearchInput(inputs));
  url.searchParams.set("per_page", String(resolveLimit(inputs.limit)));
  url.searchParams.set("order", "score");
  url.searchParams.set("api_token", token);

  const jurisdictionCode = inputs.jurisdiction_code?.trim();
  if (jurisdictionCode) {
    url.searchParams.set("jurisdiction_code", jurisdictionCode);
  }

  if (typeof inputs.inactive === "boolean") {
    url.searchParams.set("inactive", String(inputs.inactive));
  }

  return url;
}

async function fetchJson<T>(url: URL): Promise<T> {
  metricInc("api_requests", 1);
  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    metricSet("last_status_code", response.status);
    const errorText = await response.text().catch(() => response.statusText);
    throw new Error(
      `OpenCorporates request failed (${response.status}): ${errorText}`
    );
  }

  metricSet("last_status_code", response.status);

  return response.json() as Promise<T>;
}

function compactAddress(address?: OpenCorporatesAddress | null): string | undefined {
  if (!address) {
    return undefined;
  }

  const parts = uniqueStrings([
    address.street_address ?? undefined,
    address.locality ?? undefined,
    address.region ?? undefined,
    address.postal_code ?? undefined,
    address.country ?? undefined,
  ]);

  return parts.length > 0 ? parts.join(", ") : undefined;
}

function companySearchSource(url: URL): string {
  const source = new URL(url.toString());
  source.searchParams.delete("api_token");
  return source.toString();
}

function officerDisplayPosition(officer: OpenCorporatesOfficer): string | undefined {
  const position = officer.position?.trim();
  const companyName = officer.company?.name?.trim();

  if (position && companyName) {
    return `${position} @ ${companyName}`;
  }

  return position || companyName || undefined;
}

function normalizeCompanyEntity(
  company: OpenCorporatesCompany,
  queryUrl: URL
): DataModelEntity {
  const companyName = company.name?.trim() || "Unknown company";
  const jurisdictionCode = company.jurisdiction_code?.trim();
  const companyNumber = company.company_number?.trim();
  const nativeCompanyNumber = company.native_company_number?.trim();
  const registeredAddress =
    company.registered_address_in_full?.trim() ||
    compactAddress(company.registered_address);
  const aliases = uniqueStrings([
    ...(company.previous_names ?? []).map((item) => item.company_name ?? undefined),
    ...(company.alternative_names ?? []).map((item) =>
      typeof item === "string" ? item : item.company_name ?? item.name ?? undefined
    ),
  ]);
  const industryCodes = uniqueStrings(
    (company.industry_codes ?? []).map((item) => {
      const industry = item.industry_code;
      if (!industry?.code && !industry?.description) {
        return undefined;
      }

      return [industry.code, industry.description].filter(Boolean).join(" - ");
    })
  );

  const props: Record<string, TypedValue[]> = {};
  addProp(props, "name", [stringValue(companyName)]);
  addProp(
    props,
    "registrationNumber",
    uniqueStrings([companyNumber, nativeCompanyNumber]).map(stringValue)
  );
  addProp(
    props,
    "jurisdiction",
    jurisdictionCode ? [stringValue(jurisdictionCode)] : []
  );
  addProp(
    props,
    "incorporationDate",
    company.incorporation_date ? [dateLikeValue(company.incorporation_date)] : []
  );
  addProp(
    props,
    "dissolutionDate",
    company.dissolution_date ? [dateLikeValue(company.dissolution_date)] : []
  );
  addProp(
    props,
    "companyType",
    company.company_type ? [stringValue(company.company_type)] : []
  );
  addProp(
    props,
    "status",
    company.current_status ? [stringValue(company.current_status)] : []
  );
  addProp(
    props,
    "address",
    registeredAddress ? [addressValue(registeredAddress)] : []
  );
  addProp(
    props,
    "country",
    company.registered_address?.country
      ? [stringValue(company.registered_address.country)]
      : []
  );
  addProp(props, "alias", aliases.map(stringValue));
  addProp(props, "industryCode", industryCodes.map(stringValue));

  const extra: KeyValueEntry[] = [];

  if (typeof company.branch === "boolean") {
    addExtra(extra, "branch", booleanValue(company.branch));
  }

  if (company.branch_status) {
    addExtra(extra, "branch_status", stringValue(company.branch_status));
  }

  if (typeof company.inactive === "boolean") {
    addExtra(extra, "inactive", booleanValue(company.inactive));
  }

  for (const previousName of company.previous_names ?? []) {
    if (previousName.company_name) {
      addExtra(extra, "previous_name", stringValue(previousName.company_name));
    }
    if (previousName.start_date) {
      addExtra(
        extra,
        "previous_name_start_date",
        dateLikeValue(previousName.start_date)
      );
    }
    if (previousName.end_date) {
      addExtra(
        extra,
        "previous_name_end_date",
        dateLikeValue(previousName.end_date)
      );
    }
  }

  if (company.created_at) {
    addExtra(extra, "created_at", dateLikeValue(company.created_at));
  }

  if (company.updated_at) {
    addExtra(extra, "updated_at", dateLikeValue(company.updated_at));
  }

  if (company.retrieved_at) {
    addExtra(extra, "retrieved_at", dateLikeValue(company.retrieved_at));
  }

  if (company.source?.publisher) {
    addExtra(extra, "source_publisher", stringValue(company.source.publisher));
  }

  if (company.source?.terms) {
    addExtra(extra, "source_terms", stringValue(company.source.terms));
  }

  if (company.source?.retrieved_at) {
    addExtra(
      extra,
      "source_retrieved_at",
      dateLikeValue(company.source.retrieved_at)
    );
  }

  return {
    $entity: "entity.organization",
    $id: `opencorporates:company:${jurisdictionCode ?? "unknown"}:${companyNumber ?? nativeCompanyNumber ?? companyName.toLowerCase().replace(/\s+/g, "-")}`,
    $sources: [
      {
        name: "OpenCorporates company search",
        source: companySearchSource(queryUrl),
      },
      ...(company.opencorporates_url
        ? [{ name: "OpenCorporates company", source: company.opencorporates_url }]
        : []),
      ...(company.registry_url
        ? [{ name: "Company registry", source: company.registry_url }]
        : []),
      ...(company.source?.url
        ? [{ name: "Source feed", source: company.source.url }]
        : []),
    ],
    $props: props,
    $extra: extra,
  };
}

function normalizeOfficerEntity(
  officer: OpenCorporatesOfficer,
  queryUrl: URL
): DataModelEntity {
  const props: Record<string, TypedValue[]> = {};
  const extra: KeyValueEntry[] = [];
  const displayPosition = officerDisplayPosition(officer);

  addProp(
    props,
    "name",
    officer.name?.trim() ? [stringValue(officer.name.trim())] : []
  );
  addProp(props, "position", displayPosition ? [stringValue(displayPosition)] : []);
  addProp(
    props,
    "birthDate",
    officer.date_of_birth ? [dateLikeValue(officer.date_of_birth)] : []
  );
  addProp(
    props,
    "personId",
    uniqueStrings([
      officer.id !== undefined && officer.id !== null ? String(officer.id) : undefined,
      officer.uid ?? undefined,
    ]).map(stringValue)
  );
  addProp(
    props,
    "nationality",
    officer.nationality ? [stringValue(officer.nationality)] : []
  );
  addProp(
    props,
    "occupation",
    officer.occupation ? [stringValue(officer.occupation)] : []
  );
  addProp(
    props,
    "residenceAddress",
    officer.address ? [addressValue(officer.address)] : []
  );

  if (officer.position) {
    addExtra(extra, "position_raw", stringValue(officer.position));
  }

  if (officer.start_date) {
    addExtra(extra, "start_date", dateLikeValue(officer.start_date));
  }

  if (officer.end_date) {
    addExtra(extra, "end_date", dateLikeValue(officer.end_date));
  }

  if (officer.current_status) {
    addExtra(extra, "current_status", stringValue(officer.current_status));
  }

  if (typeof officer.inactive === "boolean") {
    addExtra(extra, "inactive", booleanValue(officer.inactive));
  }

  if (officer.retrieved_at) {
    addExtra(extra, "retrieved_at", dateLikeValue(officer.retrieved_at));
  }

  if (officer.jurisdiction_code) {
    addExtra(extra, "jurisdiction_code", stringValue(officer.jurisdiction_code));
  }

  if (officer.company?.name) {
    addExtra(extra, "company_name", stringValue(officer.company.name));
  }

  if (officer.company?.jurisdiction_code) {
    addExtra(
      extra,
      "company_jurisdiction_code",
      stringValue(officer.company.jurisdiction_code)
    );
  }

  if (officer.company?.company_number) {
    addExtra(
      extra,
      "company_number",
      stringValue(officer.company.company_number)
    );
  }

  return {
    $entity: "entity.person",
    $id: `opencorporates:officer:${officer.id ?? officer.uid ?? (officer.name?.toLowerCase().replace(/\s+/g, "-") ?? "unknown")}`,
    $sources: [
      {
        name: "OpenCorporates officer search",
        source: companySearchSource(queryUrl),
      },
      ...(officer.opencorporates_url
        ? [{ name: "OpenCorporates officer", source: officer.opencorporates_url }]
        : []),
      ...(officer.company?.opencorporates_url
        ? [{ name: "Officer company", source: officer.company.opencorporates_url }]
        : []),
    ],
    $props: props,
    $extra: extra,
  };
}

export async function searchCompanies(
  inputs: PluginInputs
): Promise<DataModelEntity[]> {
  const token = requireToken(inputs);
  const url = buildSearchUrl("companies/search", inputs, token);
  const data = await fetchJson<CompanySearchResponse>(url);
  const companies = data.results?.companies ?? [];

  const entities = companies
    .map((item) => item.company)
    .filter((company): company is OpenCorporatesCompany => Boolean(company))
    .map((company) => normalizeCompanyEntity(company, url));
  metricSet("result_count", entities.length);
  return entities;
}

export async function searchOfficers(
  inputs: PluginInputs
): Promise<DataModelEntity[]> {
  const token = requireToken(inputs);
  const url = buildSearchUrl("officers/search", inputs, token);
  const data = await fetchJson<OfficerSearchResponse>(url);
  const officers = data.results?.officers ?? [];

  const entities = officers
    .map((item) => item.officer)
    .filter((officer): officer is OpenCorporatesOfficer => Boolean(officer))
    .map((officer) => normalizeOfficerEntity(officer, url));
  metricSet("result_count", entities.length);
  return entities;
}

