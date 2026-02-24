/**
 * OpenSanctions Plugin
 * Searches OpenSanctions API for entities (people, companies, vessels, etc.)
 */

interface PluginInputs {
  // From user form
  name?: string;
  age?: number;
  [key: string]: any;

  // From settings (merged by backend)
  open_sanctions_url?: string;
  api_key?: string;
  dry_run?: boolean;
}

interface OpenSanctionsEntity {
  id: string;
  schema: string;
  properties: {
    name?: string[];
    alias?: string[];
    birthDate?: string[];
    nationality?: string[];
    country?: string[];
    topics?: string[];
    [key: string]: any;
  };
  datasets?: string[];
  referents?: string[];
  first_seen?: string;
  last_seen?: string;
  caption?: string;
  target?: boolean;
}

interface SearchResponse {
  total: {
    value: number;
    relation: string;
  };
  results: OpenSanctionsEntity[];
  facets?: {
    countries?: Record<string, number>;
    topics?: Record<string, number>;
    datasets?: Record<string, number>;
  };
}

/**
 * Main plugin function - must be default export
 */
export default async function (inputs: PluginInputs) {
  const logs: string[] = [];
  const log = (message: string) => {
    logs.push(`[${new Date().toISOString()}] ${message}`);
    console.log(message);
  };

  log(
    "[OpenSanctions Plugin] Received inputs: " + JSON.stringify(inputs, null, 2)
  );

  const apiUrl = inputs.open_sanctions_url || "https://api.opensanctions.org";
  const apiKey = inputs.api_key;
  const isDryRun = inputs.dry_run || false;

  log("[OpenSanctions Plugin] API URL: " + apiUrl);
  log(
    "[OpenSanctions Plugin] API Key: " +
      (apiKey ? `${apiKey.substring(0, 10)}...` : "NOT PROVIDED")
  );
  log("[OpenSanctions Plugin] Dry Run: " + isDryRun);

  // Build search query from inputs
  const searchQuery = inputs.name || "";

  if (!searchQuery) {
    throw new Error("Name is required for search");
  }

  if (isDryRun) {
    return {
      message: "Dry run mode - no actual API call made",
      query: searchQuery,
      inputs: inputs,
      logs: logs,
    };
  }

  if (!apiKey) {
    throw new Error("API key is required. Please configure it in settings.");
  }

  // Make API request to /match endpoint for entity matching
  // This API is better for compliance checks as it returns match scores
  const url = new URL(`${apiUrl}/match/default`);
  url.searchParams.set("schema", "Person"); // or "Company", "Vessel", etc.

  // Build query object for POST request
  const matchQuery = {
    queries: {
      entity1: {
        schema: "Person",
        properties: {
          name: [searchQuery],
          ...(inputs.age ? { birthDate: [`${inputs.age}`] } : {}),
        },
      },
    },
  };

  log("[OpenSanctions Plugin] Request URL: " + url.toString());
  log(
    "[OpenSanctions Plugin] Match query: " + JSON.stringify(matchQuery, null, 2)
  );

  const headers: Record<string, string> = {
    Authorization: `ApiKey ${apiKey}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  try {
    const response = await fetch(url.toString(), {
      method: "POST",
      headers: headers,
      body: JSON.stringify(matchQuery),
    });

    log("[OpenSanctions Plugin] Response status: " + response.status);

    if (!response.ok) {
      const errorText = await response.text();
      log("[OpenSanctions Plugin] Error response: " + errorText);
      throw new Error(`API request failed (${response.status}): ${errorText}`);
    }

    const data = await response.json();

    // Match API returns { responses: { entity1: { results: [...], total: {...} } } }
    const matchResults = data.responses?.entity1;
    const results = matchResults?.results || [];
    const total = matchResults?.total || { value: 0, relation: "eq" };

    log("[OpenSanctions Plugin] Success! Found " + total.value + " matches");

    // Return formatted response with match scores
    return {
      success: true,
      query: searchQuery,
      total: total,
      results: results,
      timestamp: new Date().toISOString(),
      logs: logs,
    };
  } catch (error: any) {
    log("[OpenSanctions Plugin] Error: " + error.message);
    return {
      success: false,
      error: error.message,
      logs: logs,
    };
  }
}
