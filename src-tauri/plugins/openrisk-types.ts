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
    _or_set(props, "pepStatus", p.isPep !== undefined ? _tv.bool(p.isPep) : undefined);
    _or_set(props, "sanctioned", p.isSanctioned !== undefined ? _tv.bool(p.isSanctioned) : undefined);

    const extra = _or_extra(opts.extra);
    if (p.sourceRegister) extra.push(_or_kv("source_register", _tv.str(p.sourceRegister)));
    if (p.effectiveTo) extra.push(_or_kv("effective_to", _tv.date(p.effectiveTo)));
    for (const pn of p.previousNames ?? []) extra.push(_or_kv("previous_name", _tv.str(pn)));
    for (const lr of p.legalRoles ?? []) extra.push(_or_kv("legal_role", _tv.str(lr)));
    for (const et of p.entryTypes ?? []) extra.push(_or_kv("entry_type", _tv.str(et)));
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

/** Slugify parts and join with ':' to form a stable, URL-safe entity ID. */
function buildId(...parts: Array<string | number | undefined>): string {
    return parts
        .filter((p): p is string | number => p !== undefined && String(p).trim().length > 0)
        .map((p) => String(p).toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-_:.]+/g, "-"))
        .join(":");
}

// =============================================================================
// END openrisk-types.ts
// =============================================================================
