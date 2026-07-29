import type { Page } from "@playwright/test";

export const PROJECT_DIRECTORY = "/tmp/openrisk-evidence.orproj";
export const FIXED_TIME = "2026-06-19T10:00:00Z";

type SettingValue =
  | { type: "string"; value: string }
  | { type: "number"; value: number }
  | { type: "boolean"; value: boolean }
  | { type: "null" };

const text = (value: string) => ({ $type: "string", value });
const bool = (value: boolean) => ({ $type: "boolean", value });

const project = {
  id: "evidence-project",
  name: "OpenRisk Fix Verification",
  audit: null,
  directory: PROJECT_DIRECTORY,
  is_preview: false,
};

const projectSettings = {
  id: "evidence-settings",
  description: "Deterministic visual evidence fixture",
  locale: "en-US",
  theme: "light",
  advancedMode: false,
  isPreview: false,
};

const openSanctionsPlugin = {
  id: "opensanctions",
  name: "OpenSanctions",
  version: "0.7.0",
  enabled: true,
  status: "",
  manifest: {
    id: "opensanctions",
    name: "OpenSanctions",
    version: "0.7.0",
    description: "Screen persons and organizations against OpenSanctions data.",
    license: "MIT",
    authors: [{ name: "OpenRiskPlatform", email: null }],
    icon: null,
    homepage: "https://www.opensanctions.org/",
    updateMetricsFn: null,
  },
  entrypoints: [
    {
      id: "search",
      name: "Search",
      functionName: "search",
      description: "Search OpenSanctions",
    },
  ],
  inputDefs: [
    {
      entrypointId: "search",
      name: "target",
      title: "Target",
      type: { name: "string", values: null },
      optional: false,
      description: "Person or organization name",
      defaultValue: null,
    },
  ],
  settingDefs: [
    {
      name: "api_token",
      title: "API Token",
      type: { name: "string", values: null },
      description: "OpenSanctions API token",
      required: true,
      secret: true,
      defaultValue: null,
    },
    {
      name: "trial",
      title: "Trial",
      type: { name: "boolean", values: null },
      description: "Use the free trial allowance",
      required: false,
      secret: false,
      defaultValue: { type: "boolean", value: true },
    },
  ],
  metricDefs: [],
  metricValues: [],
  settingValues: [
    { name: "api_token", value: { type: "string", value: "evidence-token" } },
    { name: "trial", value: { type: "boolean", value: true } },
  ],
};

const adverseaCountries = [
  "US",
  "AU",
  "NZ",
  "GB",
  "DE",
  "CZ",
  "SK",
  "IT",
  "AT",
  "BE",
  "BG",
  "HR",
  "CY",
  "DK",
  "EE",
  "FI",
  "FR",
  "GR",
  "HU",
  "IE",
  "LV",
  "LT",
  "LU",
  "MT",
  "NL",
  "PL",
  "PT",
  "RO",
  "SI",
  "ES",
  "SE",
];

const adverseaEntrypoints = [
  ["pep-sanctions", "PEP & Sanctions"],
  ["unit-analysis", "Unit Analysis"],
  ["topic-report", "Topic Report"],
  ["social-media", "Social Media"],
  ["rpo", "RPO"],
  ["debtors", "Debtors"],
  ["default-entity-recognition", "Entity Recognition"],
] as const;

const adverseaPlugin = {
  id: "adversea",
  name: "Adversea",
  version: "0.6.0",
  enabled: true,
  status: "",
  manifest: {
    id: "adversea",
    name: "Adversea",
    version: "0.6.0",
    description: "Adverse media, PEP, sanctions, and entity intelligence.",
    license: "MIT",
    authors: [{ name: "OpenRiskPlatform", email: null }],
    icon: null,
    homepage: "https://adversea.com/",
    updateMetricsFn: null,
  },
  entrypoints: adverseaEntrypoints.map(([id, name]) => ({
    id,
    name,
    functionName: id.replace(/-([a-z])/g, (_, letter: string) =>
      letter.toUpperCase(),
    ),
    description: `Run ${name}`,
  })),
  inputDefs: [
    {
      entrypointId: "pep-sanctions",
      name: "target",
      title: "Target",
      type: { name: "string", values: null },
      optional: false,
      description: "Person name",
      defaultValue: null,
    },
    {
      entrypointId: "unit-analysis",
      name: "target",
      title: "Target",
      type: { name: "string", values: null },
      optional: false,
      description: "Person name",
      defaultValue: null,
    },
    {
      entrypointId: "unit-analysis",
      name: "country",
      title: "Country",
      type: {
        name: "country-code-iso-3166-1-alpha-2",
        values: adverseaCountries,
      },
      optional: false,
      description: "Country used for the source search",
      defaultValue: { type: "string", value: "US" },
    },
    ...adverseaEntrypoints
      .filter(([id]) => !["pep-sanctions", "unit-analysis"].includes(id))
      .flatMap(([entrypointId], index) =>
        Array.from({ length: 2 }, (_, fieldIndex) => ({
          entrypointId,
          name: `query_${index}_${fieldIndex}`,
          title: fieldIndex === 0 ? "Query" : "Additional context",
          type: { name: "string", values: null },
          optional: true,
          description: "Optional evidence fixture input",
          defaultValue: null,
        })),
      ),
  ],
  settingDefs: [
    {
      name: "api_token",
      title: "API Token",
      type: { name: "string", values: null },
      description: "Adversea API token",
      required: true,
      secret: true,
      defaultValue: null,
    },
  ],
  metricDefs: [],
  metricValues: [],
  settingValues: [
    { name: "api_token", value: { type: "string", value: "evidence-token" } },
  ],
};

const rcaEntity = {
  $modelVersion: "0.0.3",
  $entity: "entity.person",
  $id: "svetlana-ficova",
  $sources: [
    {
      name: "Evidence fixture",
      source: "https://example.invalid/svetlana-ficova",
    },
  ],
  $props: {
    name: [text("Svetlana Ficová")],
    aliases: [text("Svetlana Svobodová")],
    birthDate: [{ $type: "date-iso8601", value: "1964-09-06" }],
    nationalities: [text("Slovakia")],
    pepStatus: [bool(false)],
    isPepRca: [bool(true)],
    sanctioned: [bool(false)],
    relativeCloseAssociates: [
      {
        $type: "relative-close-associate",
        value: { name: "Robert Fico", relation: "spouse" },
      },
    ],
  },
};

export const adverseMediaEntity = {
  $modelVersion: "0.0.3",
  $entity: "entity.mediaMention",
  $id: "adverse-media-evidence",
  $sources: [
    {
      name: "Adversea",
      source: "https://example.invalid/adverse-media",
    },
  ],
  $props: {
    name: [text("Svetlana Ficová")],
    title: [text("Investigative article with a confirmed adverse signal")],
    url: [{ $type: "url", value: "https://example.invalid/adverse-media" }],
    analysis: [
      text(
        "The screening result contains a confirmed adverse activity signal that requires review.",
      ),
    ],
    adverseActivityDetected: [bool(true)],
  },
};

function scanSummary(
  id: string,
  preview: string,
  pluginName: string,
  sortOrder: number,
) {
  return {
    id,
    status: "Completed",
    preview,
    createdAt: FIXED_TIME,
    pluginName,
    resultCount: 1,
    errorResultCount: 0,
    isArchived: false,
    sortOrder,
  };
}

const scans = [
  scanSummary("rca-scan", "Svetlana Ficová", "Adversea", 0),
  scanSummary("media-scan", "Adverse media evidence", "Adversea", 1),
];

const scanDetails = {
  "rca-scan": {
    id: "rca-scan",
    status: "Completed",
    preview: "Svetlana Ficová",
    createdAt: FIXED_TIME,
    selectedPlugins: [
      { pluginId: "adversea", entrypointId: "pep-sanctions" },
    ],
    inputs: [
      {
        pluginId: "adversea",
        entrypointId: "pep-sanctions",
        fieldName: "target",
        value: { type: "string", value: "Svetlana Ficová" },
      },
    ],
    results: [
      {
        pluginId: "adversea",
        pluginRevisionId: null,
        entrypointId: "pep-sanctions",
        output: {
          ok: true,
          dataJson: JSON.stringify([rcaEntity]),
          error: null,
          logs: [],
        },
      },
    ],
  },
  "media-scan": {
    id: "media-scan",
    status: "Completed",
    preview: "Adverse media evidence",
    createdAt: FIXED_TIME,
    selectedPlugins: [
      { pluginId: "adversea", entrypointId: "topic-report" },
    ],
    inputs: [
      {
        pluginId: "adversea",
        entrypointId: "topic-report",
        fieldName: "query",
        value: { type: "string", value: "Svetlana Ficová" },
      },
    ],
    results: [
      {
        pluginId: "adversea",
        pluginRevisionId: null,
        entrypointId: "topic-report",
        output: {
          ok: true,
          dataJson: JSON.stringify([adverseMediaEntity]),
          error: null,
          logs: [],
        },
      },
    ],
  },
} as const;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export const fixture = {
  project,
  projectSettings,
  plugins: [openSanctionsPlugin, adverseaPlugin],
  scans,
  scanDetails,
};

export async function installTauriMock(page: Page): Promise<void> {
  await page.addInitScript(
    ({ fixtureData, fixedTime }) => {
      type Callback = (...args: unknown[]) => unknown;
      type InvokeState = {
        calls: Array<{ command: string; args: Record<string, unknown> }>;
        callbackId: number;
        callbacks: Record<number, Callback>;
        dynamicScan: Record<string, unknown> | null;
        dynamicSummary: Record<string, unknown> | null;
      };

      const state: InvokeState = {
        calls: [],
        callbackId: 0,
        callbacks: {},
        dynamicScan: null,
        dynamicSummary: null,
      };

      const fixtureValue = fixtureData as typeof fixture;
      const copy = <T>(value: T): T =>
        JSON.parse(JSON.stringify(value)) as T;

      const settingsPayload = () => ({
        project: copy(fixtureValue.project),
        projectSettings: copy(fixtureValue.projectSettings),
        plugins: copy(fixtureValue.plugins),
      });

      const settingValue = (value: unknown): SettingValue => {
        if (value === null || value === undefined) return { type: "null" };
        if (typeof value === "boolean") {
          return { type: "boolean", value };
        }
        if (typeof value === "number") return { type: "number", value };
        return { type: "string", value: String(value) };
      };

      const successfulOutput = (name: string) => ({
        ok: true,
        dataJson: JSON.stringify([
          {
            $modelVersion: "0.0.3",
            $entity: "entity.person",
            $id: name.toLowerCase().replace(/\s+/g, "-"),
            $props: {
              name: [{ $type: "string", value: name }],
              pepStatus: [{ $type: "boolean", value: false }],
              sanctioned: [{ $type: "boolean", value: false }],
            },
          },
        ]),
        error: null,
        logs: [],
      });

      const invoke = async (
        command: string,
        args: Record<string, unknown> = {},
      ): Promise<unknown> => {
        state.calls.push({ command, args: copy(args) });

        if (command.startsWith("plugin:window|")) return null;
        if (command.startsWith("plugin:event|")) return 1;
        if (command.startsWith("plugin:store|")) return null;
        if (command.startsWith("plugin:dialog|")) return null;
        if (command.startsWith("plugin:fs|")) return null;
        if (command.startsWith("plugin:opener|")) return null;

        switch (command) {
          case "open_project":
            return copy(fixtureValue.project);
          case "close_project":
            return null;
          case "load_settings": {
            const payload = settingsPayload();
            if (state.dynamicScan) {
              const plugin = payload.plugins.find(
                (item) => item.id === "opensanctions",
              );
              if (plugin) {
                plugin.status = "0.10 EUR used";
              }
            }
            return payload;
          }
          case "set_plugin_setting": {
            const payload = settingsPayload();
            const plugin = payload.plugins.find(
              (item) => item.id === args.pluginId,
            );
            if (plugin) {
              const nextValue = args.value as SettingValue;
              const existing = plugin.settingValues.find(
                (item) => item.name === args.name,
              );
              if (existing) existing.value = nextValue;
              else {
                plugin.settingValues.push({
                  name: String(args.name),
                  value: nextValue,
                });
              }
            }
            return plugin;
          }
          case "list_scans":
            return state.dynamicSummary
              ? [copy(state.dynamicSummary), ...copy(fixtureValue.scans)]
              : copy(fixtureValue.scans);
          case "create_scan": {
            state.dynamicSummary = {
              id: "dynamic-scan",
              status: "Draft",
              preview: null,
              createdAt: fixedTime,
              pluginName: null,
              resultCount: 0,
              errorResultCount: 0,
              isArchived: false,
              sortOrder: -1,
            };
            state.dynamicScan = {
              id: "dynamic-scan",
              status: "Draft",
              preview: null,
              createdAt: fixedTime,
              selectedPlugins: [],
              inputs: [],
              results: [],
            };
            return copy(state.dynamicSummary);
          }
          case "update_scan_preview": {
            if (state.dynamicSummary) {
              state.dynamicSummary.preview = String(args.preview);
            }
            if (state.dynamicScan) {
              state.dynamicScan.preview = String(args.preview);
            }
            return copy(state.dynamicSummary);
          }
          case "run_scan": {
            const selectedPlugins = copy(
              (args.selectedPlugins ?? []) as Array<{
                pluginId: string;
                entrypointId: string;
              }>,
            );
            const inputs = copy(
              (args.inputs ?? []) as Array<{
                pluginId: string;
                entrypointId: string;
                fieldName: string;
                value: SettingValue;
              }>,
            );
            const targetFor = (entrypointId: string) =>
              inputs.find(
                (item) =>
                  item.entrypointId === entrypointId &&
                  item.fieldName === "target" &&
                  item.value.type === "string" &&
                  item.value.value.trim() !== "",
              );

            const results = selectedPlugins.map((selection) => {
              const missingSharedTarget =
                selection.pluginId === "adversea" &&
                ["pep-sanctions", "unit-analysis"].includes(
                  selection.entrypointId,
                ) &&
                !targetFor(selection.entrypointId);
              return {
                pluginId: selection.pluginId,
                pluginRevisionId: null,
                entrypointId: selection.entrypointId,
                output: missingSharedTarget
                  ? {
                      ok: false,
                      dataJson: null,
                      error: "Input 'target' is required.",
                      logs: [],
                    }
                  : successfulOutput(
                      targetFor(selection.entrypointId)?.value.value ??
                        "Evidence Result",
                    ),
              };
            });

            state.dynamicScan = {
              id: "dynamic-scan",
              status: "Completed",
              preview: "Evidence scan",
              createdAt: fixedTime,
              selectedPlugins,
              inputs,
              results,
            };
            state.dynamicSummary = {
              id: "dynamic-scan",
              status: "Completed",
              preview: "Evidence scan",
              createdAt: fixedTime,
              pluginName:
                selectedPlugins[0]?.pluginId === "adversea"
                  ? "Adversea"
                  : "OpenSanctions",
              resultCount: results.filter((result) => result.output.ok).length,
              errorResultCount: results.filter((result) => !result.output.ok)
                .length,
              isArchived: false,
              sortOrder: -1,
            };
            return copy(state.dynamicSummary);
          }
          case "get_scan": {
            if (args.scanId === "dynamic-scan") {
              return copy(state.dynamicScan);
            }
            return copy(
              fixtureValue.scanDetails[
                args.scanId as keyof typeof fixtureValue.scanDetails
              ],
            );
          }
          case "update_scan_preview":
          case "set_scan_archived":
            return copy(state.dynamicSummary);
          case "reorder_scans":
            return copy(fixtureValue.scans);
          default:
            return null;
        }
      };

      const tauriInternals = {
        invoke,
        metadata: {
          currentWindow: { label: "main" },
          currentWebview: { label: "main", windowLabel: "main" },
        },
        transformCallback(callback: Callback, once = false) {
          const id = ++state.callbackId;
          state.callbacks[id] = (...args: unknown[]) => {
            const result = callback(...args);
            if (once) delete state.callbacks[id];
            return result;
          };
          return id;
        },
        unregisterCallback(id: number) {
          delete state.callbacks[id];
        },
        convertFileSrc(path: string) {
          return path;
        },
      };

      Object.defineProperty(window, "__TAURI_INTERNALS__", {
        configurable: true,
        value: tauriInternals,
      });
      Object.defineProperty(window, "__OPENRISK_EVIDENCE__", {
        configurable: true,
        value: state,
      });
    },
    { fixtureData: clone(fixture), fixedTime: FIXED_TIME },
  );
}

export async function invokedCalls(page: Page) {
  return page.evaluate(() => {
    const state = (
      window as typeof window & {
        __OPENRISK_EVIDENCE__: {
          calls: Array<{ command: string; args: Record<string, unknown> }>;
        };
      }
    ).__OPENRISK_EVIDENCE__;
    return state.calls;
  });
}
