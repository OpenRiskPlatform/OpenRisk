/**
 * Adversea Plugin
 *
 * Screens individuals and legal entities against PEP lists, sanctions datasets,
 * topic-based adverse media, and social media — using the Adversea REST API.
 *
 * Entrypoints:
 *   pepSanctionsCheck  — PEP & sanctions screening (/screening/pepSanctions)
 *   topicReport        — Topic-based adverse media (/screening/topic-report)
 *   socialMediaCheck   — Social media profile search (/screening/socialMedia)
 */

// ---------------------------------------------------------------------------
// Types mirroring the Adversea OpenAPI spec
// ---------------------------------------------------------------------------

interface PluginInputs {
    target?: string;
    api_key?: string;
}

interface EntityInfo {
    name?: string;
    aliases?: string[];
    addresses?: string;
    birth_date?: string;
    countries_full?: string[];
    schema?: string; // "Person" | "LegalEntity"
    emails?: string;
    phones?: string;
}

interface StateCompany {
    company_name?: string;
    company_ico?: string;
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
    description?: string;
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

// ---------------------------------------------------------------------------
// Validation — called by the host to check if the plugin can run
// ---------------------------------------------------------------------------

export function validate(settings: Record<string, unknown>): { ok: boolean; error?: string } {
    if (!settings.api_key || String(settings.api_key).trim() === "") {
        return { ok: false, error: "Adversea API key is required. Please set it in plugin settings." };
    }
    return { ok: true };
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const BASE_URL = "https://adversea.com/api/gateway-service";

function requireTarget(inputs: PluginInputs): string {
    const name = inputs.target?.trim();
    if (!name) throw new Error("Input 'target' is required (name of the person or organization).");
    return name;
}

function requireApiKey(inputs: PluginInputs): string {
    const key = inputs.api_key?.trim();
    if (!key) throw new Error("Adversea API key is missing. Set it in plugin settings.");
    return key;
}

async function adverseaGet<T>(
    path: string,
    params: Record<string, string>,
    apiKey: string
): Promise<T> {
    const url = new URL(`${BASE_URL}${path}`);
    for (const [k, v] of Object.entries(params)) {
        url.searchParams.set(k, v);
    }
    const response = await fetch(url.toString(), {
        headers: { "X-Adversea-Api-Key": apiKey },
    });
    if (!response.ok) {
        const text = await response.text().catch(() => response.statusText);
        throw new Error(`Adversea API error ${response.status}: ${text}`);
    }
    return response.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Data-model conversion helpers
// ---------------------------------------------------------------------------

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

const tv = {
    string: (v: string): TypedValue<string> => ({ $type: "string", value: v }),
    date: (v: string): TypedValue<string> => ({ $type: "date-iso8601", value: v }),
    url: (v: string): TypedValue<string> => ({ $type: "url", value: v }),
    bool: (v: boolean): TypedValue<boolean> => ({ $type: "boolean", value: v }),
    kv: (key: string, value: TypedValue): KeyValueEntry => ({
        $type: "key-value",
        value: { key: tv.string(key), value },
    }),
};

function pushProp(
    props: Record<string, TypedValue[]>,
    key: string,
    value: TypedValue | undefined
): void {
    if (value === undefined) return;
    if (!props[key]) props[key] = [];
    props[key].push(value);
}

function csvToArray(csv: string | undefined): string[] {
    if (!csv) return [];
    return csv
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
}

/**
 * Convert a PepServiceResponse into a DataModel entity.
 * Uses entity.person for schema="Person" and entity.organization otherwise.
 */
function pepResponseToEntity(data: PepServiceResponse): DataModelEntity {
    const info = data.entity_info ?? {};
    const isPerson = info.schema !== "LegalEntity";
    const entityType = isPerson ? "entity.person" : "entity.organization";

    const id = `adversea:${(info.name ?? data.query ?? "unknown").toLowerCase().replace(/\s+/g, "-")}`;

    const props: Record<string, TypedValue[]> = {};
    const extra: KeyValueEntry[] = [];

    // --- Common fields ---
    if (info.name) pushProp(props, "name", tv.string(info.name));

    for (const alias of info.aliases ?? []) {
        pushProp(props, "alias", tv.string(alias));
    }

    if (info.addresses) {
        for (const addr of csvToArray(info.addresses)) {
            pushProp(props, isPerson ? "residenceAddress" : "address", { $type: "address", value: addr });
        }
    }

    for (const country of info.countries_full ?? []) {
        pushProp(props, "country", tv.string(country));
    }

    for (const email of csvToArray(info.emails)) {
        pushProp(props, "email", tv.string(email));
    }

    for (const phone of csvToArray(info.phones)) {
        pushProp(props, "phone", tv.string(phone));
    }

    // --- Person-specific ---
    if (isPerson && info.birth_date) {
        pushProp(props, "birthDate", tv.date(info.birth_date));
    }

    // --- PEP status ---
    const isPep = !!(data.pep?.dataset ?? []).length;
    pushProp(props, "pepStatus", tv.bool(isPep));

    if (isPep) {
        for (const ds of data.pep!.dataset ?? []) {
            extra.push(tv.kv("pep_dataset", tv.string(ds)));
        }
        if (data.pep!.municipality) {
            extra.push(tv.kv("pep_municipality", tv.string(data.pep!.municipality)));
        }
        for (const sc of data.pep!.state_companies ?? []) {
            if (sc.company_name) {
                extra.push(
                    tv.kv(
                        "state_company",
                        tv.string(
                            [sc.company_name, sc.position, sc.effective_from]
                                .filter(Boolean)
                                .join(" | ")
                        )
                    )
                );
            }
        }
    }

    // --- Sanctions ---
    const isSanctioned = !!(data.sanctions?.dataset ?? []).length;
    pushProp(props, "sanctioned", tv.bool(isSanctioned));

    if (isSanctioned) {
        for (const ds of data.sanctions!.dataset ?? []) {
            extra.push(tv.kv("sanctions_dataset", tv.string(ds)));
        }
        if (data.sanctions!.description) {
            extra.push(tv.kv("sanctions_description", tv.string(data.sanctions!.description)));
        }
    }

    return {
        $entity: entityType,
        $id: id,
        $props: props,
        $extra: extra,
    };
}

// ---------------------------------------------------------------------------
// Entrypoint 1: PEP & Sanctions Check
// ---------------------------------------------------------------------------

export async function pepSanctionsCheck(inputs: PluginInputs): Promise<DataModelEntity[]> {
    const target = requireTarget(inputs);
    const apiKey = requireApiKey(inputs);

    const data = await adverseaGet<PepServiceResponse>(
        "/screening/pepSanctions",
        { targetName: target },
        apiKey
    );

    return [pepResponseToEntity(data)];
}

// ---------------------------------------------------------------------------
// Entrypoint 2: Topic Report
// ---------------------------------------------------------------------------

export async function topicReport(inputs: PluginInputs): Promise<DataModelEntity[]> {
    const target = requireTarget(inputs);
    const apiKey = requireApiKey(inputs);

    const topics = await adverseaGet<SingleTopicResponse[]>(
        "/screening/topic-report",
        { targetName: target },
        apiKey
    );

    const id = `adversea:topic:${target.toLowerCase().replace(/\s+/g, "-")}`;
    const props: Record<string, TypedValue[]> = {};
    const extra: KeyValueEntry[] = [];

    pushProp(props, "name", tv.string(target));

    for (const topic of topics) {
        if (!topic.topicId) continue;
        const detected = topic.adverseActivityDetected ?? false;
        extra.push(tv.kv(`topic_${topic.topicId}`, tv.bool(detected)));
        for (const src of topic.sources ?? []) {
            if (src.url) {
                extra.push(tv.kv(`topic_${topic.topicId}_source`, tv.url(src.url)));
            }
        }
    }

    const entity: DataModelEntity = {
        $entity: "entity.person",
        $id: id,
        $props: props,
        $extra: extra,
    };

    return [entity];
}

// ---------------------------------------------------------------------------
// Entrypoint 3: Social Media Check
// ---------------------------------------------------------------------------

export async function socialMediaCheck(inputs: PluginInputs): Promise<DataModelEntity[]> {
    const target = requireTarget(inputs);
    const apiKey = requireApiKey(inputs);

    const profiles = await adverseaGet<SocialMediaProfile[]>(
        "/screening/socialMedia",
        { targetName: target },
        apiKey
    );

    if (!profiles.length) return [];

    const id = `adversea:social:${target.toLowerCase().replace(/\s+/g, "-")}`;
    const props: Record<string, TypedValue[]> = {};
    const extra: KeyValueEntry[] = [];

    pushProp(props, "name", tv.string(target));

    for (const profile of profiles) {
        const platform = profile.social_media_platform ?? "unknown";
        if (profile.profile_url) {
            extra.push(tv.kv(`social_${platform}`, tv.url(profile.profile_url)));
        } else if (profile.title) {
            extra.push(tv.kv(`social_${platform}`, tv.string(profile.title)));
        }
    }

    const entity: DataModelEntity = {
        $entity: "entity.person",
        $id: id,
        $props: props,
        $extra: extra,
    };

    return [entity];
}

