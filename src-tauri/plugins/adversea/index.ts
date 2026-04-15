/**
 * Adversea Plugin  ·  v0.2
 *
 * Maps Adversea API responses to OpenRisk canonical entities.
 * openrisk-types.ts is inlined below — do not edit that section here.
 */

// === BEGIN openrisk-types.ts ===
// =============================================================================
// openrisk-types.ts  ·  OpenRisk Canonical Entity Types  ·  v1
//
// Paste this block verbatim at the top of each plugin file.
// All shared identifiers use _or_ / _tv prefixes to avoid collisions.
// Propose field additions upstream; do NOT modify per-plugin.
// =============================================================================

// ---------------------------------------------------------------------------
// Wire format — must match the OpenRisk runtime DataModelEntity schema.
// ---------------------------------------------------------------------------

interface TypedValue<T = unknown> {
    $type: string;
    value: T;
}

interface _OR_KV {
    $type: "key-value";
    value: { key: TypedValue<string>; value: TypedValue };
}

interface DataModelEntity {
    $entity: string;
    $id: string;
    $sources?: Array<{ name: string; source: string }>;
    $props?: Record<string, TypedValue[]>;
    $extra?: _OR_KV[];
}

// ---------------------------------------------------------------------------
// Sub-types used inside canonical payloads
// ---------------------------------------------------------------------------

/** One public-sector or state-linked position (used in PEP data). */
interface StatePosition {
    companyName?: string;
    /** Registration number / ICO of the entity. */
    companyId?: string;
    position?: string;
    address?: string;
    effectiveFrom?: string;
    effectiveTo?: string;
}

/** A declared business activity of a registered company (RPO, ORSR, etc.). */
interface BusinessSubject {
    description: string;
    effectiveFrom?: string;
    effectiveTo?: string;
}

// ---------------------------------------------------------------------------
// Canonical payload types — what plugin authors construct
// ---------------------------------------------------------------------------

/** entity.person — a physical person. */
interface PersonPayload {
    name: string;
    aliases?: string[];
    birthDate?: string;
    birthPlace?: string;
    /** ISO alpha-2 codes or full country names. */
    nationalities?: string[];
    addresses?: string[];
    emails?: string[];
    phones?: string[];
    /** true = PEP confirmed, false = clear, undefined = not evaluated. */
    isPep?: boolean;
    pepDatasets?: string[];
    pepMunicipality?: string;
    pepState?: string;
    statePositions?: StatePosition[];
    /** true = sanctioned, false = clear, undefined = not evaluated. */
    isSanctioned?: boolean;
    sanctionDatasets?: string[];
    sanctionDescription?: string;
    /** Short bio / discovery note (e.g. from automated entity recognition). */
    notes?: string;
}

/** entity.organization — a legal entity or company. */
interface OrganizationPayload {
    name: string;
    aliases?: string[];
    previousNames?: string[];
    /** Registration number (ICO, EIN, company number, etc.). */
    registrationId?: string;
    country?: string;
    address?: string;
    status?: "active" | "inactive" | "unknown";
    involvedPersons?: string[];
    /** Legal roles or classification labels (e.g. statutory body types). */
    legalRoles?: string[];
    sourceRegister?: string;
    entryTypes?: string[];
    businessSubjects?: BusinessSubject[];
    effectiveTo?: string;
    isPep?: boolean;
    pepDatasets?: string[];
    isSanctioned?: boolean;
    sanctionDatasets?: string[];
    sanctionDescription?: string;
}

/** entity.mediaMention — one media article / URL analyzed for a target. */
interface MediaMentionPayload {
    targetName: string;
    title?: string;
    url?: string;
    /** Concise text analysis (text mode). */
    analysisText?: string;
    /** Atomic fact claims extracted from the article (claims mode). */
    claims?: string[];
    adverseActivityDetected?: boolean;
}

/** entity.riskTopic — one risk theme from an adverse-media topic report. */
interface RiskTopicPayload {
    targetName: string;
    topicId?: string;
    adverseActivityDetected?: boolean;
    summary?: string;
}

/** entity.socialProfile — one public social media profile. */
interface SocialProfilePayload {
    targetName: string;
    platform?: string;
    profileTitle?: string;
    profileUrl?: string;
    userId?: string;
}

/** entity.financialRecord — a financial obligation or debt record. */
interface FinancialRecordPayload {
    name: string;
    amountOwed?: string;
    location?: string;
    debtSource?: string;
}

/**
 * entity.detectedEntity — a related person or organization discovered
 * via entity recognition when the exact type (person vs org) is unknown.
 */
interface DetectedEntityPayload {
    name: string;
    description?: string;
}

// ---------------------------------------------------------------------------
// Builder options
// ---------------------------------------------------------------------------

interface _OR_Opts<P> {
    id: string;
    payload: P;
    sources?: Array<{ name: string; source: string }>;
    /**
     * Overflow key-value pairs that do not map to any canonical field.
     * Use sparingly — prefer extending the payload type upstream.
     */
    extra?: Record<string, string | number | boolean | null | undefined>;
}

// ---------------------------------------------------------------------------
// Internal wire helpers
// ---------------------------------------------------------------------------

const _tv = {
    str: (v: string): TypedValue<string> => ({ $type: "string", value: v }),
    num: (v: number): TypedValue<number> => ({ $type: "number", value: v }),
    bool: (v: boolean): TypedValue<boolean> => ({ $type: "boolean", value: v }),
    url: (v: string): TypedValue<string> => ({ $type: "url", value: v }),
    addr: (v: string): TypedValue<string> => ({ $type: "address", value: v }),
    date: (v: string): TypedValue<string> => ({
        $type: /^\d{4}-\d{2}-\d{2}T/.test(v) ? "date-time-iso8601"
            : /^\d{4}-\d{2}-\d{2}$/.test(v) ? "date-iso8601"
                : /^\d{4}(-\d{2})?$/.test(v) ? "date-partial-iso8601"
                    : "string",
        value: v,
    }),
};

function _or_set(props: Record<string, TypedValue[]>, key: string, val: TypedValue | undefined): void {
    if (val !== undefined) (props[key] ??= []).push(val);
}

function _or_many(props: Record<string, TypedValue[]>, key: string, vals: TypedValue[]): void {
    if (vals.length) (props[key] ??= []).push(...vals);
}

function _or_kv(key: string, val: TypedValue): _OR_KV {
    const label = key
        .replace(/[_-]+/g, " ")
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/\b\w/g, (c) => c.toUpperCase());
    return { $type: "key-value", value: { key: _tv.str(label), value: val } };
}

function _or_extra(bag?: Record<string, string | number | boolean | null | undefined>): _OR_KV[] {
    if (!bag) return [];
    return Object.entries(bag)
        .filter(([, v]) => v !== null && v !== undefined)
        .map(([k, v]) =>
            _or_kv(k, typeof v === "boolean" ? _tv.bool(v)
                : typeof v === "number" ? _tv.num(v)
                    : _tv.str(String(v))),
        );
}

// ---------------------------------------------------------------------------
// Entity builder functions
// ---------------------------------------------------------------------------

function buildPerson(opts: _OR_Opts<PersonPayload>): DataModelEntity {
    const p = opts.payload;
    const props: Record<string, TypedValue[]> = {};

    _or_set(props, "name", _tv.str(p.name));
    _or_many(props, "aliases", (p.aliases ?? []).map(_tv.str));
    _or_set(props, "birthDate", p.birthDate ? _tv.date(p.birthDate) : undefined);
    _or_set(props, "birthPlace", p.birthPlace ? _tv.str(p.birthPlace) : undefined);
    _or_many(props, "nationalities", (p.nationalities ?? []).map(_tv.str));
    _or_many(props, "addresses", (p.addresses ?? []).map(_tv.addr));
    _or_many(props, "emails", (p.emails ?? []).map(_tv.str));
    _or_many(props, "phones", (p.phones ?? []).map(_tv.str));
    _or_set(props, "notes", p.notes ? _tv.str(p.notes) : undefined);
    _or_set(props, "pepStatus", p.isPep !== undefined ? _tv.bool(p.isPep) : undefined);
    _or_set(props, "sanctioned", p.isSanctioned !== undefined ? _tv.bool(p.isSanctioned) : undefined);

    const extra = _or_extra(opts.extra);
    for (const ds of p.pepDatasets ?? []) extra.push(_or_kv("pep_dataset", _tv.str(ds)));
    if (p.pepMunicipality) extra.push(_or_kv("pep_municipality", _tv.str(p.pepMunicipality)));
    if (p.pepState) extra.push(_or_kv("pep_state", _tv.str(p.pepState)));
    for (const ds of p.sanctionDatasets ?? []) extra.push(_or_kv("sanction_dataset", _tv.str(ds)));
    if (p.sanctionDescription) extra.push(_or_kv("sanction_description", _tv.str(p.sanctionDescription)));

    for (const [i, pos] of (p.statePositions ?? []).entries()) {
        const n = i + 1;
        if (pos.companyName) extra.push(_or_kv(`state_position_${n}_company`, _tv.str(pos.companyName)));
        if (pos.companyId) extra.push(_or_kv(`state_position_${n}_id`, _tv.str(pos.companyId)));
        if (pos.position) extra.push(_or_kv(`state_position_${n}_role`, _tv.str(pos.position)));
        if (pos.address) extra.push(_or_kv(`state_position_${n}_address`, _tv.addr(pos.address)));
        if (pos.effectiveFrom) extra.push(_or_kv(`state_position_${n}_from`, _tv.date(pos.effectiveFrom)));
        if (pos.effectiveTo) extra.push(_or_kv(`state_position_${n}_to`, _tv.date(pos.effectiveTo)));
    }

    return { $entity: "entity.person", $id: opts.id, $props: props, $extra: extra.length ? extra : undefined, $sources: opts.sources };
}

function buildOrganization(opts: _OR_Opts<OrganizationPayload>): DataModelEntity {
    const p = opts.payload;
    const props: Record<string, TypedValue[]> = {};

    _or_set(props, "name", _tv.str(p.name));
    _or_many(props, "aliases", (p.aliases ?? []).map(_tv.str));
    _or_set(props, "registrationId", p.registrationId ? _tv.str(p.registrationId) : undefined);
    _or_set(props, "country", p.country ? _tv.str(p.country) : undefined);
    _or_set(props, "address", p.address ? _tv.addr(p.address) : undefined);
    _or_set(props, "status", p.status ? _tv.str(p.status) : undefined);
    _or_many(props, "involvedPersons", (p.involvedPersons ?? []).map(_tv.str));
    _or_many(props, "legalRoles", (p.legalRoles ?? []).map(_tv.str));
    _or_many(props, "previousNames", (p.previousNames ?? []).map(_tv.str));
    _or_many(props, "entryTypes", (p.entryTypes ?? []).map(_tv.str));
    _or_set(props, "sourceRegister", p.sourceRegister ? _tv.str(p.sourceRegister) : undefined);
    _or_set(props, "effectiveTo", p.effectiveTo ? _tv.date(p.effectiveTo) : undefined);
    _or_set(props, "pepStatus", p.isPep !== undefined ? _tv.bool(p.isPep) : undefined);
    _or_set(props, "sanctioned", p.isSanctioned !== undefined ? _tv.bool(p.isSanctioned) : undefined);

    const extra = _or_extra(opts.extra);
    for (const ds of p.pepDatasets ?? []) extra.push(_or_kv("pep_dataset", _tv.str(ds)));
    for (const ds of p.sanctionDatasets ?? []) extra.push(_or_kv("sanction_dataset", _tv.str(ds)));
    if (p.sanctionDescription) extra.push(_or_kv("sanction_description", _tv.str(p.sanctionDescription)));

    for (const [i, bs] of (p.businessSubjects ?? []).entries()) {
        const n = i + 1;
        extra.push(_or_kv(`business_subject_${n}`, _tv.str(bs.description)));
        if (bs.effectiveFrom) extra.push(_or_kv(`business_subject_${n}_from`, _tv.date(bs.effectiveFrom)));
        if (bs.effectiveTo) extra.push(_or_kv(`business_subject_${n}_to`, _tv.date(bs.effectiveTo)));
    }

    return { $entity: "entity.organization", $id: opts.id, $props: props, $extra: extra.length ? extra : undefined, $sources: opts.sources };
}

function buildMediaMention(opts: _OR_Opts<MediaMentionPayload>): DataModelEntity {
    const p = opts.payload;
    const props: Record<string, TypedValue[]> = {};

    _or_set(props, "name", _tv.str(p.targetName));
    _or_set(props, "title", p.title ? _tv.str(p.title) : undefined);
    _or_set(props, "url", p.url ? _tv.url(p.url) : undefined);
    _or_set(props, "analysis", p.analysisText ? _tv.str(p.analysisText) : undefined);
    _or_set(props, "adverseActivityDetected", p.adverseActivityDetected !== undefined ? _tv.bool(p.adverseActivityDetected) : undefined);

    const extra = _or_extra(opts.extra);
    for (const claim of p.claims ?? []) extra.push(_or_kv("claim", _tv.str(claim)));

    return { $entity: "entity.mediaMention", $id: opts.id, $props: props, $extra: extra.length ? extra : undefined, $sources: opts.sources };
}

function buildRiskTopic(opts: _OR_Opts<RiskTopicPayload>): DataModelEntity {
    const p = opts.payload;
    const props: Record<string, TypedValue[]> = {};

    _or_set(props, "name", _tv.str(p.targetName));
    _or_set(props, "topicId", p.topicId ? _tv.str(p.topicId) : undefined);
    _or_set(props, "adverseActivityDetected", p.adverseActivityDetected !== undefined ? _tv.bool(p.adverseActivityDetected) : undefined);
    _or_set(props, "summary", p.summary ? _tv.str(p.summary) : undefined);

    const extra = _or_extra(opts.extra);
    return { $entity: "entity.riskTopic", $id: opts.id, $props: props, $extra: extra.length ? extra : undefined, $sources: opts.sources };
}

function buildSocialProfile(opts: _OR_Opts<SocialProfilePayload>): DataModelEntity {
    const p = opts.payload;
    const props: Record<string, TypedValue[]> = {};

    _or_set(props, "name", _tv.str(p.targetName));
    _or_set(props, "platform", p.platform ? _tv.str(p.platform) : undefined);
    _or_set(props, "profileTitle", p.profileTitle ? _tv.str(p.profileTitle) : undefined);
    _or_set(props, "profileUrl", p.profileUrl ? _tv.url(p.profileUrl) : undefined);
    _or_set(props, "userId", p.userId ? _tv.str(p.userId) : undefined);

    const extra = _or_extra(opts.extra);
    return { $entity: "entity.socialProfile", $id: opts.id, $props: props, $extra: extra.length ? extra : undefined, $sources: opts.sources };
}

function buildFinancialRecord(opts: _OR_Opts<FinancialRecordPayload>): DataModelEntity {
    const p = opts.payload;
    const props: Record<string, TypedValue[]> = {};

    _or_set(props, "name", _tv.str(p.name));
    _or_set(props, "amountOwed", p.amountOwed ? _tv.str(p.amountOwed) : undefined);
    const _loc = p.location?.replace(/[,\s]/g, "");
    _or_set(props, "location", _loc ? _tv.addr(p.location!) : undefined);
    _or_set(props, "debtSource", p.debtSource ? _tv.str(p.debtSource) : undefined);

    const extra = _or_extra(opts.extra);
    return { $entity: "entity.financialRecord", $id: opts.id, $props: props, $extra: extra.length ? extra : undefined, $sources: opts.sources };
}

function buildDetectedEntity(opts: _OR_Opts<DetectedEntityPayload>): DataModelEntity {
    const p = opts.payload;
    const props: Record<string, TypedValue[]> = {};

    _or_set(props, "name", _tv.str(p.name));
    _or_set(props, "description", p.description ? _tv.str(p.description) : undefined);

    const extra = _or_extra(opts.extra);
    return { $entity: "entity.detectedEntity", $id: opts.id, $props: props, $extra: extra.length ? extra : undefined, $sources: opts.sources };
}

/** Slugify parts and join with ':' to form a human-readable, guaranteed-unique entity ID. */
function buildId(...parts: Array<string | number | undefined>): string {
    const slug = parts
        .filter((p): p is string | number => p !== undefined && String(p).trim().length > 0)
        .map((p) => String(p).toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-_:.]+/g, "-"))
        .join(":");
    const rand = Math.random().toString(36).slice(2, 8);
    return slug ? `${slug}:${rand}` : rand;
}

// =============================================================================
// END openrisk-types.ts
// =============================================================================
// === END openrisk-types.ts ===

// =============================================================================
// Adversea Plugin  ·  v0.2
//
// Maps Adversea API responses to OpenRisk canonical entities.
// openrisk-types.ts is inlined above — do not edit that section here.
// =============================================================================

// ---------------------------------------------------------------------------
// Adversea API response types
// ---------------------------------------------------------------------------

interface PluginInputs {
    target?: string;
    api_key?: string;
    output_language?: "English" | "Slovak";
    country?: string;
    media_only?: boolean;
    force_recreate?: boolean;
    mode?: "text" | "claims";
}

interface EntityInfo {
    name?: string;
    aliases?: string[];
    addresses?: string;
    birth_date?: string;
    countries_full?: string[];
    schema?: string;
    emails?: string;
    phones?: string;
}

interface StateCompany {
    company_name?: string;
    company_ico?: number | string;
    position?: string;
    address?: string;
    effective_from?: string;
    effective_to?: string;
}

interface Pep {
    dataset?: string[];
    municipality?: string;
    state?: string;
    state_companies?: StateCompany[];
}

interface Sanctions {
    description?: string | Record<string, string>;
    dataset?: string[];
}

interface PepServiceResponse {
    query?: string;
    entity_info?: EntityInfo;
    pep?: Pep;
    sanctions?: Sanctions;
}

interface TopicSource {
    title?: string;
    url?: string;
}

interface SingleTopicResponse {
    targetName?: string;
    topicId?: string;
    result?: string;
    adverseActivityDetected?: boolean;
    sources?: TopicSource[];
}

interface SocialMediaProfile {
    user_id?: string;
    profile_url?: string;
    title?: string;
    social_media_platform?: string;
}

interface UnitAnalysisText {
    url?: string;
    title?: string;
    analysis?: string;
    adverseActivityDetected?: boolean;
}

interface UnitAnalysisClaim {
    url?: string;
    title?: string;
    claims?: string[];
    adverseActivityDetected?: boolean;
}

interface RpoEntry {
    positions?: string[];
    given_name?: string;
    family_name?: string;
    entry_types?: string[];
    ico?: string;
    prev_org_names?: string[];
    source_register?: string;
    latest_org_name?: string;
    effective_to?: string;
    courts_links?: string[];
    involved_persons?: string[];
}

interface RpoBusinessSubject {
    description?: string;
    effective_from?: string;
    effective_to?: string;
}

interface RpoBusinessSubjectsResponse {
    business_subjects?: RpoBusinessSubject[];
}

interface DebtorEntry {
    name?: string;
    source?: string;
    amountOwed?: string;
    location?: string;
}

interface DefaultEntity {
    name?: string;
    short_description?: string;
    links?: string[];
}

interface DefaultEntityRecognitionResponse {
    entities?: DefaultEntity[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BASE_URL = "https://adversea.com/api/gateway-service";

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function metricSet(name: string, value: unknown): void {
    (globalThis as { openrisk?: { metrics?: { set?: (n: string, v: unknown) => void } } })
        .openrisk?.metrics?.set?.(name, value);
}

function csvToArray(value?: string): string[] {
    return value ? value.split(",").map((s) => s.trim()).filter(Boolean) : [];
}

// ---------------------------------------------------------------------------
// Plugin lifecycle
// ---------------------------------------------------------------------------

export function validate(settings: Record<string, unknown>): { ok: boolean; error?: string } {
    if (!settings.api_key || String(settings.api_key).trim() === "") {
        return { ok: false, error: "Adversea API key is required. Set it in plugin settings." };
    }
    return { ok: true };
}

// ---------------------------------------------------------------------------
// Input guards
// ---------------------------------------------------------------------------

function requireApiKey(inputs: PluginInputs): string {
    const key = inputs.api_key?.trim();
    if (!key) throw new Error("Adversea API key is missing. Set it in plugin settings.");
    return key;
}

function requireTarget(inputs: PluginInputs): string {
    const target = inputs.target?.trim();
    if (!target) throw new Error("Input 'target' is required.");
    return target;
}

// ---------------------------------------------------------------------------
// HTTP client
// ---------------------------------------------------------------------------

const ADVERSEA_MAX_429_RETRIES = 3;
const ADVERSEA_BASE_RETRY_DELAY_MS = 800;

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryDelayMs(attempt: number, retryAfterHeader: string | null): number {
    const retryAfterSeconds = Number(retryAfterHeader);
    if (!Number.isNaN(retryAfterSeconds) && retryAfterSeconds > 0) {
        return retryAfterSeconds * 1000;
    }
    return ADVERSEA_BASE_RETRY_DELAY_MS * Math.pow(2, attempt);
}

async function adverseaFetchWithRetry(url: URL, apiKey: string): Promise<Response> {
    let last429Body = "";
    for (let attempt = 0; attempt <= ADVERSEA_MAX_429_RETRIES; attempt++) {
        const res = await fetch(url.toString(), {
            headers: { "X-Adversea-Api-Key": apiKey, Accept: "application/json" },
        });

        if (res.status !== 429) {
            return res;
        }

        last429Body = await res.text().catch(() => res.statusText);
        if (attempt === ADVERSEA_MAX_429_RETRIES) {
            break;
        }

        const delayMs = retryDelayMs(attempt, res.headers.get("retry-after"));
        await sleep(delayMs);
    }

    throw new Error(`Adversea 429: ${last429Body}`);
}

async function adverseaGet<T>(
    path: string,
    params: Record<string, string | number | boolean | undefined>,
    apiKey: string,
): Promise<T> {
    const url = new URL(`${BASE_URL}${path}`);
    for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && String(v).trim() !== "") {
            url.searchParams.set(k, String(v));
        }
    }
    const res = await adverseaFetchWithRetry(url, apiKey);
    if (!res.ok) {
        const msg = await res.text().catch(() => res.statusText);
        throw new Error(`Adversea ${res.status}: ${msg}`);
    }
    return res.json() as Promise<T>;
}

async function adverseaGetNumber(
    path: string,
    params: Record<string, string | number | boolean | undefined>,
    apiKey: string,
): Promise<number> {
    const url = new URL(`${BASE_URL}${path}`);
    for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && String(v).trim() !== "") {
            url.searchParams.set(k, String(v));
        }
    }
    const res = await adverseaFetchWithRetry(url, apiKey);
    if (!res.ok) {
        const msg = await res.text().catch(() => res.statusText);
        throw new Error(`Adversea ${res.status}: ${msg}`);
    }
    const text = await res.text();
    const n = Number(text);
    if (Number.isNaN(n)) throw new Error(`Non-numeric credit response: ${text}`);
    return n;
}

// ---------------------------------------------------------------------------
// Run finalizer — records remaining_credit metric after every entrypoint
// ---------------------------------------------------------------------------

async function finalizeRun(apiKey: string, entities: DataModelEntity[]): Promise<DataModelEntity[]> {
    try {
        const credit = await adverseaGetNumber("/admin/client/remainingCredit", {}, apiKey);
        metricSet("remaining_credit", credit.toFixed(2) + " EUR");
    } catch {
        // Credit is supplemental; a failed stat call must not fail the scan.
    }
    return entities;
}

/**
 * Optional metrics refresh hook used by OpenRisk settings page.
 * It updates declared metrics and returns no entities.
 */
export async function updateMetrics(inputs: PluginInputs): Promise<DataModelEntity[]> {
    const apiKey = requireApiKey(inputs);
    await finalizeRun(apiKey, []);
    return [];
}

// ---------------------------------------------------------------------------
// PEP / Sanctions response → canonical entity
// ---------------------------------------------------------------------------

function pepResponseToEntity(target: string, data: PepServiceResponse): DataModelEntity {
    const info = data.entity_info ?? {};
    const isPerson = info.schema !== "LegalEntity";
    const isPep = (data.pep?.dataset?.length ?? 0) > 0;
    const isSanctioned = (data.sanctions?.dataset?.length ?? 0) > 0;

    const sanctionDescription =
        typeof data.sanctions?.description === "string"
            ? data.sanctions.description
            : Object.entries(data.sanctions?.description ?? {})
                .map(([lang, text]) => `[${lang}] ${text}`)
                .join("; ") || undefined;

    const sources = [{ name: "Adversea PEP/Sanctions", source: `${BASE_URL}/screening/pepSanctions` }];

    if (isPerson) {
        return buildPerson({
            id: buildId("adversea", "pep", info.name ?? target),
            sources,
            payload: {
                name: info.name ?? target,
                aliases: info.aliases,
                birthDate: info.birth_date,
                nationalities: info.countries_full,
                addresses: csvToArray(info.addresses),
                emails: csvToArray(info.emails),
                phones: csvToArray(info.phones),
                isPep,
                pepDatasets: data.pep?.dataset,
                pepMunicipality: data.pep?.municipality,
                pepState: data.pep?.state,
                statePositions: (data.pep?.state_companies ?? []).map((sc) => ({
                    companyName: sc.company_name,
                    companyId: sc.company_ico !== undefined ? String(sc.company_ico) : undefined,
                    position: sc.position,
                    address: sc.address,
                    effectiveFrom: sc.effective_from,
                    effectiveTo: sc.effective_to,
                })),
                isSanctioned,
                sanctionDatasets: data.sanctions?.dataset,
                sanctionDescription,
            },
        });
    }

    return buildOrganization({
        id: buildId("adversea", "pep", info.name ?? target),
        sources,
        payload: {
            name: info.name ?? target,
            aliases: info.aliases,
            country: info.countries_full?.[0],
            address: csvToArray(info.addresses)[0],
            isPep,
            isSanctioned,
            pepDatasets: data.pep?.dataset,
            sanctionDatasets: data.sanctions?.dataset,
            sanctionDescription,
        },
    });
}

// ---------------------------------------------------------------------------
// Entrypoints
// ---------------------------------------------------------------------------

export async function pepSanctionsCheck(inputs: PluginInputs): Promise<DataModelEntity[]> {
    const target = requireTarget(inputs);
    const apiKey = requireApiKey(inputs);
    const data = await adverseaGet<PepServiceResponse>(
        "/screening/pepSanctions",
        { targetName: target, forceRecreate: inputs.force_recreate },
        apiKey,
    );
    return finalizeRun(apiKey, [pepResponseToEntity(target, data)]);
}

export async function topicReport(inputs: PluginInputs): Promise<DataModelEntity[]> {
    const target = requireTarget(inputs);
    const apiKey = requireApiKey(inputs);
    const topics = await adverseaGet<SingleTopicResponse[]>(
        "/screening/topic-report",
        {
            targetName: target,
            country: inputs.country,
            outputLanguage: inputs.output_language ?? "English",
            forceRecreate: inputs.force_recreate,
        },
        apiKey,
    );

    const entities = topics.map((topic, idx) =>
        buildRiskTopic({
            id: buildId("adversea", "topic", topic.topicId ?? String(idx), target),
            sources: (topic.sources ?? [])
                .filter((s) => !!s.url)
                .map((s) => ({ name: s.title || topic.topicId || "source", source: String(s.url) })),
            payload: {
                targetName: topic.targetName || target,
                topicId: topic.topicId,
                adverseActivityDetected: topic.adverseActivityDetected,
                summary: topic.result,
            },
        }),
    );
    return finalizeRun(apiKey, entities);
}

export async function socialMediaCheck(inputs: PluginInputs): Promise<DataModelEntity[]> {
    const target = requireTarget(inputs);
    const apiKey = requireApiKey(inputs);
    const profiles = await adverseaGet<SocialMediaProfile[]>(
        "/screening/socialMedia",
        { targetName: target, forceRecreate: inputs.force_recreate },
        apiKey,
    );

    const entities = profiles.map((profile, idx) =>
        buildSocialProfile({
            id: buildId("adversea", "social", target, profile.social_media_platform ?? String(idx), profile.user_id ?? ""),
            sources: profile.profile_url
                ? [{ name: profile.title || profile.social_media_platform || "social-profile", source: profile.profile_url }]
                : undefined,
            payload: {
                targetName: target,
                platform: profile.social_media_platform,
                profileTitle: profile.title,
                profileUrl: profile.profile_url,
                userId: profile.user_id,
            },
        }),
    );
    return finalizeRun(apiKey, entities);
}

export async function unitAnalysis(inputs: PluginInputs): Promise<DataModelEntity[]> {
    const target = requireTarget(inputs);
    const apiKey = requireApiKey(inputs);
    const mode = inputs.mode ?? "text";

    if (mode === "claims") {
        const rows = await adverseaGet<UnitAnalysisClaim[]>(
            "/screening/unit-analysis/claims",
            {
                targetName: target,
                country: inputs.country,
                outputLanguage: inputs.output_language ?? "English",
                mediaOnly: inputs.media_only,
                forceRecreate: inputs.force_recreate,
            },
            apiKey,
        );
        const entities = rows.map((row, idx) =>
            buildMediaMention({
                id: buildId("adversea", "unit-analysis-claims", target, row.url ?? String(idx)),
                sources: row.url ? [{ name: row.title || "claims-source", source: row.url }] : undefined,
                payload: {
                    targetName: target,
                    title: row.title,
                    url: row.url,
                    claims: row.claims,
                    adverseActivityDetected: row.adverseActivityDetected,
                },
            }),
        );
        return finalizeRun(apiKey, entities);
    }

    // mode === "text" (default)
    const rows = await adverseaGet<UnitAnalysisText[]>(
        "/screening/unit-analysis/text",
        {
            targetName: target,
            country: inputs.country,
            outputLanguage: inputs.output_language ?? "English",
            mediaOnly: inputs.media_only,
            forceRecreate: inputs.force_recreate,
        },
        apiKey,
    );
    const entities = rows.map((row, idx) =>
        buildMediaMention({
            id: buildId("adversea", "unit-analysis-text", target, row.url ?? String(idx)),
            sources: row.url ? [{ name: row.title || "analysis-source", source: row.url }] : undefined,
            payload: {
                targetName: target,
                title: row.title,
                url: row.url,
                analysisText: row.analysis,
                adverseActivityDetected: row.adverseActivityDetected,
            },
        }),
    );
    return finalizeRun(apiKey, entities);
}

export async function rpoSearch(inputs: PluginInputs): Promise<DataModelEntity[]> {
    const target = requireTarget(inputs);
    const apiKey = requireApiKey(inputs);
    const rows = await adverseaGet<RpoEntry[]>(
        "/screening/rpo",
        { targetName: target, forceRecreate: inputs.force_recreate },
        apiKey,
    );

    const entities = await Promise.all(rows.map(async (row, idx) => {
        let businessSubjects: BusinessSubject[] | undefined;
        if (row.ico) {
            try {
                const biz = await adverseaGet<RpoBusinessSubjectsResponse>(
                    "/screening/rpo/business-data/business-subjects",
                    { ico: String(row.ico) },
                    apiKey,
                );
                businessSubjects = (biz.business_subjects ?? [])
                    .filter((bs) => bs.description)
                    .map((bs) => ({
                        description: bs.description!,
                        effectiveFrom: bs.effective_from,
                        effectiveTo: bs.effective_to,
                    }));
            } catch {
                // Supplemental — skip silently.
            }
        }

        return buildOrganization({
            id: buildId("adversea", "rpo", row.ico ?? target, idx),
            sources: (row.courts_links ?? []).map((link, i) => ({ name: `Court Link ${i + 1}`, source: link })),
            payload: {
                name: row.latest_org_name ?? target,
                registrationId: row.ico,
                country: "Slovakia",
                involvedPersons: row.involved_persons,
                previousNames: row.prev_org_names,
                legalRoles: row.positions,
                entryTypes: row.entry_types,
                sourceRegister: row.source_register,
                effectiveTo: row.effective_to,
                businessSubjects,
            },
        });
    }));
    return finalizeRun(apiKey, entities);
}

export async function debtorCheck(inputs: PluginInputs): Promise<DataModelEntity[]> {
    const target = requireTarget(inputs);
    const apiKey = requireApiKey(inputs);
    const rows = await adverseaGet<DebtorEntry[]>(
        "/screening/debtors",
        { targetName: target, forceRecreate: inputs.force_recreate },
        apiKey,
    );

    const entities = rows.map((row, idx) =>
        buildFinancialRecord({
            id: buildId("adversea", "debtor", row.name ?? target, row.source ?? String(idx)),
            sources: [{ name: "Adversea Debtors", source: `${BASE_URL}/screening/debtors` }],
            payload: {
                name: row.name ?? target,
                amountOwed: row.amountOwed,
                location: row.location,
                debtSource: row.source,
            },
        }),
    );
    return finalizeRun(apiKey, entities);
}

export async function defaultEntityRecognition(inputs: PluginInputs): Promise<DataModelEntity[]> {
    const target = requireTarget(inputs);
    const apiKey = requireApiKey(inputs);
    const payload = await adverseaGet<DefaultEntityRecognitionResponse>(
        "/entity/default-entity-recognition",
        {
            targetName: target,
            country: inputs.country,
            outputLanguage: inputs.output_language ?? "English",
            forceRecreate: inputs.force_recreate,
        },
        apiKey,
    );

    const entities = (payload.entities ?? []).map((entity, idx) =>
        buildPerson({
            id: buildId("adversea", "detected", entity.name ?? target, idx),
            sources: (entity.links ?? []).map((link, i) => ({ name: `Link ${i + 1}`, source: link })),
            payload: {
                name: entity.name ?? target,
                notes: entity.short_description,
            },
        }),
    );
    return finalizeRun(apiKey, entities);
}
