/**
 * Adversea plugin rewritten entirely in TypeScript.
 * Exposes a reusable `rpoSearch` endpoint and a default plugin entrypoint.
 *
 * Behavior:
 *  - Uses inputs.adversea_url and inputs.api_key (merged by backend) to call the RPO endpoint.
 *  - If dry_run is true, the plugin will not perform network requests and will return a simulated response.
 *  - Returns { results, logs } (results: array, logs: array of strings).
 */

interface PluginInputs {
    // From user form
    name?: string;
    [key: string]: any;

    // From settings (merged by backend)
    adversea_url?: string; // e.g. "https://rpo.example.com/api"
    api_key?: string;
    dry_run?: boolean;
    timeout_ms?: number;
}

interface RpoResult {
    id?: string;
    name?: string;
    [key: string]: any;
}

const nowStamp = () => new Date().toISOString();

async function timeout<T>(p: Promise<T>, ms: number) {
    let id: NodeJS.Timeout;
    const t = new Promise<T>((_, rej) => {
        id = setTimeout(() => rej(new Error("timeout")), ms);
    });
    return Promise.race([p.then((v) => { clearTimeout(id!); return v; }), t]);
}

/**
 * Call the RPO endpoint and return normalized results.
 * Exported so callers can directly invoke the endpoint programmatically.
 */
export async function rpoSearch(inputs: PluginInputs): Promise<{ results: RpoResult[]; logs: string[] }> {
    const logs: string[] = [];
    const log = (m: string) => logs.push(`[${nowStamp()}] ${m}`);

    const { adversea_url, api_key, name, dry_run, timeout_ms = 15_000, ...rest } = inputs || {};

    if (!adversea_url) {
        log("Missing adversea_url in inputs");
        return { results: [], logs };
    }

    if (!name) {
        log("Missing name to search");
        return { results: [], logs };
    }

    log(`RPO search started for "${name}" against ${adversea_url}`);

    if (dry_run) {
        log("Dry run enabled — skipping network request");
        // Provide a deterministic fake response for UI/testing
        const fake: RpoResult[] = [{ id: "dryrun-1", name, source: "adversea.dryrun" }];
        return { results: fake, logs };
    }

    try {
        const url = new URL(adversea_url);
        // prefer query path /rpo/search or fallback to root + /search
        if (!url.pathname || url.pathname === "/") url.pathname = "/rpo/search";
        url.searchParams.set("targetName", name);
        // add additional query params
        Object.entries(rest).forEach(([k, v]) => {
            if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
        });

        const headers: Record<string, string> = { Accept: "application/json" };
        if (api_key) headers["X-Adversea-Api-Key"] = `${api_key}`;

        log(`Request: ${url.toString()}`);
        const fetchPromise = fetch(url.toString(), { headers, method: "GET" });
        const res = await timeout(fetchPromise, timeout_ms);

        if (!res.ok) {
            const txt = await res.text().catch(() => "");
            log(`RPO responded with HTTP ${res.status}: ${txt}`);
            return { results: [], logs };
        }

        const payload = await res.json().catch(() => null);
        if (!payload) {
            log("RPO returned invalid JSON");
            return { results: [], logs };
        }

        // Try common shapes: { results: [...] } or array root
        let items: any[] = [];
        if (Array.isArray(payload)) items = payload;
        else if (Array.isArray(payload.results)) items = payload.results;
        else if (Array.isArray(payload.items)) items = payload.items;
        else if (payload.data && Array.isArray(payload.data)) items = payload.data;
        else {
            // fallback: attempt to coerce single object into array
            items = [payload];
        }

        const results: RpoResult[] = items.map((it: any) => ({
            id: it.id ?? it.uid ?? it.reference,
            name: it.name ?? it.title ?? it.full_name,
            ...it,
        }));

        log(`RPO returned ${results.length} result(s)`);
        return { results, logs };
    } catch (err: any) {
        log(`RPO request failed: ${err?.message ?? String(err)}`);
        return { results: [], logs };
    }
}

/**
 * Main plugin function - kept as default export to match host expectations.
 * Invokes rpoSearch and returns a consolidated response.
 */
export default async function (inputs: PluginInputs) {
    const { results, logs } = await rpoSearch(inputs);
    return { success: true, results, logs };
}
