/**
 * Adversea Plugin
 *
 * Covers all endpoints documented in `adversea-api.json` and maps responses
 * into OpenRisk data model entities without dropping source information.
 */

interface PluginInputs {
    target?: string;
    api_key?: string;
    output_language?: "English" | "Slovak";
    country?: string;
    media_only?: boolean;
    force_recreate?: boolean;
    mode?: "text" | "claims";
}

interface TypedValue<T = unknown> {
    $type: string;
    value: T;
}

interface KeyValueEntry {
    $type: "key-value";
    value: { key: TypedValue<string>; value: TypedValue };
}

interface DataModelEntity {
    $entity: string;
    $id: string;
    $sources?: Array<{ name: string; source: string }>;
    $props?: Record<string, TypedValue[]>;
    $extra?: KeyValueEntry[];
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

interface RpoServiceDataEntry {
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

interface RpoBusinessSubjectsDataEntry {
    description?: string;
    effective_from?: string;
    effective_to?: string;
}

interface RpoBusinessSubjectsResponse {
    business_subjects?: RpoBusinessSubjectsDataEntry[];
}

interface DebtorServiceDataEntry {
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

const BASE_URL = "https://adversea.com/api/gateway-service";

const tv = {
    string: (value: string): TypedValue<string> => ({ $type: "string", value }),
    number: (value: number): TypedValue<number> => ({ $type: "number", value }),
    bool: (value: boolean): TypedValue<boolean> => ({ $type: "boolean", value }),
    url: (value: string): TypedValue<string> => ({ $type: "url", value }),
    address: (value: string): TypedValue<string> => ({ $type: "address", value }),
    dateLike: (value: string): TypedValue<string> => ({
        $type: /^\d{4}-\d{2}-\d{2}T/.test(value)
            ? "date-time-iso8601"
            : /^\d{4}-\d{2}-\d{2}$/.test(value)
                ? "date-iso8601"
                : /^\d{4}(-\d{2})?$/.test(value)
                    ? "date-partial-iso8601"
                    : "string",
        value,
    }),
    kv: (key: string, value: TypedValue): KeyValueEntry => ({
        $type: "key-value",
        value: {
            key: { $type: "string", value: key },
            value,
        },
    }),
};

function metricSet(name: string, value: unknown): void {
    (globalThis as { openrisk?: { metrics?: { set?: (n: string, v: unknown) => void } } }).openrisk?.metrics?.set?.(name, value);
}

export function validate(settings: Record<string, unknown>): { ok: boolean; error?: string } {
    if (!settings.api_key || String(settings.api_key).trim() === "") {
        return {
            ok: false,
            error: "Adversea API key is required. Please set it in plugin settings.",
        };
    }
    return { ok: true };
}

function requireApiKey(inputs: PluginInputs): string {
    const key = inputs.api_key?.trim();
    if (!key) {
        throw new Error("Adversea API key is missing. Set it in plugin settings.");
    }
    return key;
}

function requireTarget(inputs: PluginInputs): string {
    const target = inputs.target?.trim();
    if (!target) {
        throw new Error("Input 'target' is required (name of person or organization).");
    }
    return target;
}

function slug(value: string): string {
    const normalized = value.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-_:.]+/g, "-");
    return normalized || "unknown";
}

function buildEntityId(kind: string, ...parts: Array<string | number | undefined>): string {
    const compact = parts.filter((part): part is string | number => part !== undefined && String(part).trim().length > 0);
    return `adversea:${kind}:${compact.map((part) => slug(String(part))).join(":")}`;
}

function csvToArray(value?: string): string[] {
    if (!value) {
        return [];
    }
    return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function pushProp(props: Record<string, TypedValue[]>, key: string, value: TypedValue | undefined): void {
    if (!value) {
        return;
    }
    if (!props[key]) {
        props[key] = [];
    }
    props[key].push(value);
}

function pushMany(props: Record<string, TypedValue[]>, key: string, values: TypedValue[]): void {
    if (!values.length) {
        return;
    }
    if (!props[key]) {
        props[key] = [];
    }
    props[key].push(...values);
}

function pushExtra(extra: KeyValueEntry[], key: string, value: TypedValue | undefined): void {
    if (!value) {
        return;
    }
    const label = key
        .replace(/[_-]+/g, " ")
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .trim()
        .replace(/\b\w/g, (char) => char.toUpperCase());
    extra.push(tv.kv(label, value));
}

async function adverseaGetJson<T>(
    path: string,
    params: Record<string, string | number | boolean | undefined>,
    apiKey: string,
): Promise<T> {
    const url = new URL(`${BASE_URL}${path}`);
    for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null || String(value).trim() === "") {
            continue;
        }
        url.searchParams.set(key, String(value));
    }

    const response = await fetch(url.toString(), {
        headers: {
            "X-Adversea-Api-Key": apiKey,
            Accept: "application/json",
        },
    });
    if (!response.ok) {
        const message = await response.text().catch(() => response.statusText);
        throw new Error(`Adversea API error ${response.status}: ${message}`);
    }

    return response.json() as Promise<T>;
}

async function adverseaGetNumber(
    path: string,
    params: Record<string, string | number | boolean | undefined>,
    apiKey: string,
): Promise<number> {
    const url = new URL(`${BASE_URL}${path}`);
    for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null || String(value).trim() === "") {
            continue;
        }
        url.searchParams.set(key, String(value));
    }

    const response = await fetch(url.toString(), {
        headers: {
            "X-Adversea-Api-Key": apiKey,
            Accept: "application/json",
        },
    });
    if (!response.ok) {
        const message = await response.text().catch(() => response.statusText);
        throw new Error(`Adversea API error ${response.status}: ${message}`);
    }

    const payload = await response.text();
    const parsed = Number(payload);
    if (!Number.isNaN(parsed)) {
        return parsed;
    }
    throw new Error(`Adversea API returned non-numeric credit value: ${payload}`);
}

async function finalizeRun(
    apiKey: string,
    entities: DataModelEntity[],
    knownRemainingCredit?: number,
): Promise<DataModelEntity[]> {
    if (typeof knownRemainingCredit === "number") {
        metricSet("remaining_credit", knownRemainingCredit.toFixed(2) + " EUR");
        return entities;
    }

    try {
        const credit = await adverseaGetNumber("/admin/client/remainingCredit", {}, apiKey);
        metricSet("remaining_credit", credit.toFixed(2) + " EUR");
    } catch {
        // Keep business result even if account stat endpoint is temporarily unavailable.
    }

    return entities;
}

function pepResponseToEntity(target: string, data: PepServiceResponse): DataModelEntity {
    const info = data.entity_info ?? {};
    const isPerson = info.schema !== "LegalEntity";
    const props: Record<string, TypedValue[]> = {};
    const extra: KeyValueEntry[] = [];

    pushProp(props, "name", info.name ? tv.string(info.name) : tv.string(target));
    pushMany(props, "country", (info.countries_full ?? []).map(tv.string));

    for (const addr of csvToArray(info.addresses)) {
        pushProp(props, isPerson ? "residenceAddress" : "address", tv.address(addr));
    }

    if (isPerson && info.birth_date) {
        pushProp(props, "birthDate", tv.dateLike(info.birth_date));
    }

    const isPep = Boolean(data.pep?.dataset?.length);
    const isSanctioned = Boolean(data.sanctions?.dataset?.length);
    pushProp(props, "pepStatus", tv.bool(isPep));
    pushProp(props, "sanctioned", tv.bool(isSanctioned));

    for (const alias of info.aliases ?? []) {
        pushExtra(extra, "alias", tv.string(alias));
    }
    for (const email of csvToArray(info.emails)) {
        pushExtra(extra, "email", tv.string(email));
    }
    for (const phone of csvToArray(info.phones)) {
        pushExtra(extra, "phone", tv.string(phone));
    }

    for (const ds of data.pep?.dataset ?? []) {
        pushExtra(extra, "pep_dataset", tv.string(ds));
    }
    pushExtra(extra, "pep_municipality", data.pep?.municipality ? tv.string(data.pep.municipality) : undefined);
    pushExtra(extra, "pep_state", data.pep?.state ? tv.string(data.pep.state) : undefined);

    for (const [idx, company] of (data.pep?.state_companies ?? []).entries()) {
        pushExtra(extra, `state_company_${idx}_name`, company.company_name ? tv.string(company.company_name) : undefined);
        pushExtra(extra, `state_company_${idx}_ico`, company.company_ico ? tv.string(String(company.company_ico)) : undefined);
        pushExtra(extra, `state_company_${idx}_position`, company.position ? tv.string(company.position) : undefined);
        pushExtra(extra, `state_company_${idx}_address`, company.address ? tv.address(company.address) : undefined);
        pushExtra(extra, `state_company_${idx}_effective_from`, company.effective_from ? tv.dateLike(company.effective_from) : undefined);
        pushExtra(extra, `state_company_${idx}_effective_to`, company.effective_to ? tv.dateLike(company.effective_to) : undefined);
    }

    for (const ds of data.sanctions?.dataset ?? []) {
        pushExtra(extra, "sanctions_dataset", tv.string(ds));
    }
    if (typeof data.sanctions?.description === "string") {
        pushExtra(extra, "sanctions_description", tv.string(data.sanctions.description));
    } else {
        for (const [lang, text] of Object.entries(data.sanctions?.description ?? {})) {
            pushExtra(extra, `sanctions_description_${lang}`, tv.string(text));
        }
    }

    return {
        $entity: isPerson ? "entity.person" : "entity.organization",
        $id: buildEntityId("pep-sanctions", info.name ?? data.query ?? target),
        $props: props,
        $extra: extra,
        $sources: [{
            name: "Adversea PEP/Sanctions",
            source: `${BASE_URL}/screening/pepSanctions`,
        }],
    };
}

export async function pepSanctionsCheck(inputs: PluginInputs): Promise<DataModelEntity[]> {
    const target = requireTarget(inputs);
    const apiKey = requireApiKey(inputs);

    const data = await adverseaGetJson<PepServiceResponse>(
        "/screening/pepSanctions",
        {
            targetName: target,
            forceRecreate: inputs.force_recreate,
        },
        apiKey,
    );

    return finalizeRun(apiKey, [pepResponseToEntity(target, data)]);
}

export async function topicReport(inputs: PluginInputs): Promise<DataModelEntity[]> {
    const target = requireTarget(inputs);
    const apiKey = requireApiKey(inputs);

    const topics = await adverseaGetJson<SingleTopicResponse[]>(
        "/screening/topic-report",
        {
            targetName: target,
            country: inputs.country,
            outputLanguage: inputs.output_language ?? "English",
            forceRecreate: inputs.force_recreate,
        },
        apiKey,
    );

    const entities = topics.map((topic, idx): DataModelEntity => {
        const props: Record<string, TypedValue[]> = {};
        const extra: KeyValueEntry[] = [];

        pushProp(props, "name", tv.string(topic.targetName || target));
        pushProp(props, "topicId", topic.topicId ? tv.string(topic.topicId) : undefined);
        pushProp(props, "adverseActivityDetected", tv.bool(Boolean(topic.adverseActivityDetected)));
        pushProp(props, "summary", topic.result ? tv.string(topic.result) : undefined);

        pushExtra(extra, "output_language", tv.string(inputs.output_language ?? "English"));
        pushExtra(extra, "country", inputs.country ? tv.string(inputs.country) : undefined);

        return {
            $entity: "entity.riskTopic",
            $id: buildEntityId("topic", topic.topicId ?? String(idx), target),
            $props: props,
            $extra: extra,
            $sources: (topic.sources ?? [])
                .filter((source) => !!source.url)
                .map((source) => ({
                    name: source.title || topic.topicId || "source",
                    source: String(source.url),
                })),
        };
    });

    return finalizeRun(apiKey, entities);
}

export async function socialMediaCheck(inputs: PluginInputs): Promise<DataModelEntity[]> {
    const target = requireTarget(inputs);
    const apiKey = requireApiKey(inputs);

    const profiles = await adverseaGetJson<SocialMediaProfile[]>(
        "/screening/socialMedia",
        {
            targetName: target,
            forceRecreate: inputs.force_recreate,
        },
        apiKey,
    );

    const entities = profiles.map((profile, idx): DataModelEntity => {
        const props: Record<string, TypedValue[]> = {};
        const extra: KeyValueEntry[] = [];

        pushProp(props, "name", tv.string(target));
        pushProp(props, "platform", profile.social_media_platform ? tv.string(profile.social_media_platform) : undefined);
        pushProp(props, "profileTitle", profile.title ? tv.string(profile.title) : undefined);
        pushProp(props, "profileUrl", profile.profile_url ? tv.url(profile.profile_url) : undefined);
        pushProp(props, "userId", profile.user_id ? tv.string(profile.user_id) : undefined);

        pushExtra(extra, "raw_social_platform", profile.social_media_platform ? tv.string(profile.social_media_platform) : undefined);

        return {
            $entity: "entity.socialProfile",
            $id: buildEntityId("social", target, profile.social_media_platform ?? String(idx), profile.user_id ?? ""),
            $props: props,
            $extra: extra,
            $sources: profile.profile_url
                ? [{ name: profile.title || profile.social_media_platform || "social-profile", source: profile.profile_url }]
                : undefined,
        };
    });

    return finalizeRun(apiKey, entities);
}

export async function unitAnalysis(inputs: PluginInputs): Promise<DataModelEntity[]> {
    const target = requireTarget(inputs);
    const apiKey = requireApiKey(inputs);
    const mode = inputs.mode ?? "text";

    if (mode === "claims") {
        const rows = await adverseaGetJson<UnitAnalysisClaim[]>(
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

        const entities = rows.map((row, idx): DataModelEntity => {
            const props: Record<string, TypedValue[]> = {};
            const extra: KeyValueEntry[] = [];

            pushProp(props, "name", tv.string(target));
            pushProp(props, "title", row.title ? tv.string(row.title) : undefined);
            pushProp(props, "url", row.url ? tv.url(row.url) : undefined);
            pushProp(props, "adverseActivityDetected", tv.bool(Boolean(row.adverseActivityDetected)));

            for (const claim of row.claims ?? []) {
                pushExtra(extra, "claim", tv.string(claim));
            }

            pushExtra(extra, "output_language", tv.string(inputs.output_language ?? "English"));
            pushExtra(extra, "country", inputs.country ? tv.string(inputs.country) : undefined);
            pushExtra(extra, "media_only", tv.bool(Boolean(inputs.media_only)));

            return {
                $entity: "entity.mediaMention",
                $id: buildEntityId("unit-analysis-claims", target, row.url ?? String(idx)),
                $props: props,
                $extra: extra,
                $sources: row.url ? [{ name: row.title || "claims-source", source: row.url }] : undefined,
            };
        });

        return finalizeRun(apiKey, entities);
    }

    // mode === "text" (default)
    const rows = await adverseaGetJson<UnitAnalysisText[]>(
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

    const entities = rows.map((row, idx): DataModelEntity => {
        const props: Record<string, TypedValue[]> = {};
        const extra: KeyValueEntry[] = [];

        pushProp(props, "name", tv.string(target));
        pushProp(props, "title", row.title ? tv.string(row.title) : undefined);
        pushProp(props, "url", row.url ? tv.url(row.url) : undefined);
        pushProp(props, "analysis", row.analysis ? tv.string(row.analysis) : undefined);
        pushProp(props, "adverseActivityDetected", tv.bool(Boolean(row.adverseActivityDetected)));

        pushExtra(extra, "output_language", tv.string(inputs.output_language ?? "English"));
        pushExtra(extra, "country", inputs.country ? tv.string(inputs.country) : undefined);
        pushExtra(extra, "media_only", tv.bool(Boolean(inputs.media_only)));

        return {
            $entity: "entity.mediaMention",
            $id: buildEntityId("unit-analysis-text", target, row.url ?? String(idx)),
            $props: props,
            $extra: extra,
            $sources: row.url ? [{ name: row.title || "analysis-source", source: row.url }] : undefined,
        };
    });

    return finalizeRun(apiKey, entities);
}

export async function rpoSearch(inputs: PluginInputs): Promise<DataModelEntity[]> {
    const target = requireTarget(inputs);
    const apiKey = requireApiKey(inputs);

    const rows = await adverseaGetJson<RpoServiceDataEntry[]>(
        "/screening/rpo",
        {
            targetName: target,
            forceRecreate: inputs.force_recreate,
        },
        apiKey,
    );

    const entities = await Promise.all(rows.map(async (row, idx): Promise<DataModelEntity> => {
        const props: Record<string, TypedValue[]> = {};
        const extra: KeyValueEntry[] = [];

        pushProp(props, "name", row.latest_org_name ? tv.string(row.latest_org_name) : tv.string(target));
        pushProp(props, "organizationId", row.ico ? tv.string(row.ico) : undefined);
        pushProp(props, "country", tv.string("Slovakia"));

        for (const prevName of row.prev_org_names ?? []) {
            pushExtra(extra, "previous_name", tv.string(prevName));
        }
        for (const position of row.positions ?? []) {
            pushExtra(extra, "position", tv.string(position));
        }
        for (const entryType of row.entry_types ?? []) {
            pushExtra(extra, "entry_type", tv.string(entryType));
        }
        for (const person of row.involved_persons ?? []) {
            pushExtra(extra, "involved_person", tv.string(person));
        }

        pushExtra(extra, "given_name", row.given_name ? tv.string(row.given_name) : undefined);
        pushExtra(extra, "family_name", row.family_name ? tv.string(row.family_name) : undefined);
        pushExtra(extra, "source_register", row.source_register ? tv.string(row.source_register) : undefined);
        pushExtra(extra, "effective_to", row.effective_to ? tv.dateLike(row.effective_to) : undefined);

        if (row.ico) {
            try {
                const bizPayload = await adverseaGetJson<RpoBusinessSubjectsResponse>(
                    "/screening/rpo/business-data/business-subjects",
                    { ico: String(row.ico) },
                    apiKey,
                );
                for (const [bIdx, subject] of (bizPayload.business_subjects ?? []).entries()) {
                    pushExtra(extra, `business_subject_${bIdx}_description`, subject.description ? tv.string(subject.description) : undefined);
                    pushExtra(extra, `business_subject_${bIdx}_effective_from`, subject.effective_from ? tv.dateLike(subject.effective_from) : undefined);
                    pushExtra(extra, `business_subject_${bIdx}_effective_to`, subject.effective_to ? tv.dateLike(subject.effective_to) : undefined);
                }
            } catch {
                // Business subjects are supplemental; skip silently if unavailable.
            }
        }

        return {
            $entity: "entity.organization",
            $id: buildEntityId("rpo", row.ico ?? target, idx),
            $props: props,
            $extra: extra,
            $sources: (row.courts_links ?? []).map((link, sourceIdx) => ({
                name: `court-link-${sourceIdx + 1}`,
                source: link,
            })),
        };
    }));

    return finalizeRun(apiKey, entities);
}

export async function debtorCheck(inputs: PluginInputs): Promise<DataModelEntity[]> {
    const target = requireTarget(inputs);
    const apiKey = requireApiKey(inputs);

    const rows = await adverseaGetJson<DebtorServiceDataEntry[]>(
        "/screening/debtors",
        {
            targetName: target,
            forceRecreate: inputs.force_recreate,
        },
        apiKey,
    );

    const entities = rows.map((row, idx): DataModelEntity => {
        const props: Record<string, TypedValue[]> = {};

        pushProp(props, "name", row.name ? tv.string(row.name) : tv.string(target));
        pushProp(props, "amountOwed", row.amountOwed ? tv.string(row.amountOwed) : undefined);
        pushProp(props, "location", row.location ? tv.address(row.location) : undefined);
        pushProp(props, "debtSource", row.source ? tv.string(row.source) : undefined);

        return {
            $entity: "entity.financialRecord",
            $id: buildEntityId("debtor", row.name ?? target, row.source ?? String(idx)),
            $props: props,
            $extra: [],
            $sources: [{
                name: "Adversea Debtors",
                source: `${BASE_URL}/screening/debtors`,
            }],
        };
    });

    return finalizeRun(apiKey, entities);
}

export async function defaultEntityRecognition(inputs: PluginInputs): Promise<DataModelEntity[]> {
    const target = requireTarget(inputs);
    const apiKey = requireApiKey(inputs);

    const payload = await adverseaGetJson<DefaultEntityRecognitionResponse>(
        "/entity/default-entity-recognition",
        {
            targetName: target,
            country: inputs.country,
            outputLanguage: inputs.output_language ?? "English",
            forceRecreate: inputs.force_recreate,
        },
        apiKey,
    );

    const entities = (payload.entities ?? []).map((entity, idx): DataModelEntity => {
        const props: Record<string, TypedValue[]> = {};

        pushProp(props, "name", entity.name ? tv.string(entity.name) : tv.string(target));
        pushProp(props, "description", entity.short_description ? tv.string(entity.short_description) : undefined);

        return {
            $entity: "entity.detectedEntity",
            $id: buildEntityId("default-entity", entity.name ?? target, idx),
            $props: props,
            $extra: [
                tv.kv("Output Language", tv.string(inputs.output_language ?? "English")),
                ...(inputs.country ? [tv.kv("Country", tv.string(inputs.country))] : []),
            ],
            $sources: (entity.links ?? []).map((link, sourceIdx) => ({
                name: `entity-link-${sourceIdx + 1}`,
                source: link,
            })),
        };
    });

    return finalizeRun(apiKey, entities);
}


