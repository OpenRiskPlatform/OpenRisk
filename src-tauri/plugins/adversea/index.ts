/**
 * Adversea Plugin
 * Searches the Adversea gateway API for entities (people, companies, etc.)
 * Settings are merged into inputs by the backend before this function is called.
 */

interface PluginInputs {
  // From user form
  name?: string;
  [key: string]: any;

  // From settings (merged by backend)
  open_sanctions_url?: string;
  api_key?: string;
  dry_run?: boolean;
}

export default async function (inputs: PluginInputs) {
  const logs: string[] = [];
  const log = (message: string) => {
    logs.push(`[${new Date().toISOString()}] ${message}`);
    console.log(message);
  };

  log("[Adversea Plugin] Received inputs: " + JSON.stringify(inputs, null, 2));

  const apiUrl = (inputs.open_sanctions_url || "https://adversea.com/api/gateway-service").replace(/\/$/, "");
  const apiKey = inputs.api_key;
  const isDryRun = inputs.dry_run || false;
  const searchQuery = inputs.name || "";
  const limit = parseInt(inputs.limit || "10", 10);
  const offset = parseInt(inputs.offset || "0", 10);

  log("[Adversea Plugin] API URL: " + apiUrl);
  log("[Adversea Plugin] API Key: " + (apiKey ? `${apiKey.substring(0, 10)}...` : "NOT PROVIDED"));
  log("[Adversea Plugin] Dry Run: " + isDryRun);

  if (!searchQuery) {
    throw new Error("Name is required for search.");
  }

  if (isDryRun) {
    return {
      success: true,
      message: "Dry run mode – no actual API call made",
      query: searchQuery,
      total: { value: 0, relation: "eq" },
      results: [],
      logs,
    };
  }

  if (!apiKey) {
    throw new Error("API key is required. Please configure it in the plugin settings.");
  }

  // Build match query (OpenSanctions-compatible format used by Adversea gateway)
  const properties: Record<string, any> = { name: [searchQuery] };
  if (inputs.age) properties.birthDate = [inputs.age];
  if (inputs.nationality) properties.nationality = [inputs.nationality];

  const matchQuery = {
    queries: {
      entity1: {
        schema: "Person",
        properties,
      },
    },
    limit,
    offset,
  };

  const url = `${apiUrl}/match/default`;
  log("[Adversea Plugin] POST " + url);
  log("[Adversea Plugin] Body: " + JSON.stringify(matchQuery, null, 2));

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `ApiKey ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(matchQuery),
    });

    log("[Adversea Plugin] Response status: " + response.status);

    if (!response.ok) {
      const errorText = await response.text();
      log("[Adversea Plugin] Error response: " + errorText);
      throw new Error(`API request failed (${response.status}): ${errorText}`);
    }

    const data = await response.json();

    const matchResults = data.responses?.entity1;
    const results = matchResults?.results || [];
    const total = matchResults?.total || { value: results.length, relation: "eq" };

    log("[Adversea Plugin] Success! Found " + total.value + " matches");

    return {
      success: true,
      query: searchQuery,
      total,
      results,
      timestamp: new Date().toISOString(),
      logs,
    };
  } catch (error: any) {
    log("[Adversea Plugin] Error: " + error.message);
    return {
      success: false,
      error: error.message,
      logs,
    };
  }
}
