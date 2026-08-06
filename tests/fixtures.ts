import { vi } from "vitest";
import type { OpenRiskClient } from "@/backend/OpenRiskClient";
import type {
  PluginRecord,
  ProjectSettingsPayload,
  ScanDetailRecord,
  ScanSummaryRecord,
} from "@/core/backend/bindings";

export const demoPlugin: PluginRecord = {
  id: "demo",
  name: "Demo Registry",
  version: "1.0.0",
  enabled: true,
  status: "",
  manifest: {
    id: "demo",
    name: "Demo Registry",
    version: "1.0.0",
    description: "Demo plugin",
    license: "MIT",
    authors: [{ name: "OpenRisk", email: null }],
    icon: null,
    homepage: null,
    updateMetricsFn: null,
  },
  entrypoints: [
    {
      id: "person-search",
      name: "Person search",
      functionName: "personSearch",
      description: "Search for a person.",
    },
  ],
  inputDefs: [
    {
      entrypointId: "person-search",
      name: "name",
      title: "Name",
      type: { name: "string", values: null },
      optional: false,
      description: null,
      defaultValue: null,
    },
  ],
  settingDefs: [
    {
      name: "api_key",
      title: "API key",
      type: { name: "string", values: null },
      description: null,
      required: true,
      secret: true,
      defaultValue: null,
    },
  ],
  metricDefs: [],
  metricValues: [],
  settingValues: [{ name: "api_key", value: { type: "null" } }],
};

export const projectSettings: ProjectSettingsPayload = {
  project: {
    id: "project-1",
    name: "Demo Project",
    audit: null,
    directory: "/tmp/demo.orproj",
    is_preview: false,
  },
  projectSettings: {
    id: "project-settings-1",
    description: "",
    locale: "en",
    theme: "system",
    advancedMode: false,
    interruptedScanPolicy: "fail",
    isPreview: false,
  },
  plugins: [demoPlugin],
};

export const completedScan: ScanSummaryRecord = {
  id: "scan-1",
  status: "Completed",
  preview: "Ada Lovelace",
  createdAt: "2026-07-26T10:00:00Z",
  pluginName: "Demo Registry",
  resultCount: 1,
  errorResultCount: 0,
  isArchived: false,
  sortOrder: 0,
};

export const completedScanDetail: ScanDetailRecord = {
  id: completedScan.id,
  status: completedScan.status,
  preview: completedScan.preview,
  createdAt: completedScan.createdAt,
  selectedPlugins: [
    { pluginId: "demo", entrypointId: "person-search" },
  ],
  inputs: [
    {
      pluginId: "demo",
      entrypointId: "person-search",
      fieldName: "name",
      value: { type: "string", value: "Ada Lovelace" },
    },
  ],
  results: [
    {
      pluginId: "demo",
      pluginRevisionId: "revision-1",
      entrypointId: "person-search",
      output: {
        ok: true,
        dataJson: JSON.stringify([
          {
            $modelVersion: "0.0.3",
            $entity: "entity.person",
            $id: "demo:ada",
            $props: {
              name: [{ $type: "string", value: "Ada Lovelace" }],
            },
            $extra: [],
          },
        ]),
        error: null,
        logs: [],
      },
    },
  ],
};

export const draftScan: ScanSummaryRecord = {
  ...completedScan,
  id: "scan-draft-1",
  status: "Draft",
  preview: "Untitled",
  resultCount: 0,
};

export const draftScanDetail: ScanDetailRecord = {
  id: draftScan.id,
  status: draftScan.status,
  preview: draftScan.preview,
  createdAt: draftScan.createdAt,
  selectedPlugins: [
    { pluginId: "demo", entrypointId: "person-search" },
  ],
  inputs: [
    {
      pluginId: "demo",
      entrypointId: "person-search",
      fieldName: "name",
      value: { type: "string", value: "Grace Hopper" },
    },
  ],
  results: [],
};

export function createClient(
  overrides: Partial<OpenRiskClient> = {},
): OpenRiskClient {
  const client: OpenRiskClient = {
    createProject: vi.fn(async () => projectSettings.project),
    openProject: vi.fn(async () => projectSettings.project),
    closeProject: vi.fn(async () => undefined),
    loadSettings: vi.fn(async () => projectSettings),
    updateProjectSettings: vi.fn(async () => projectSettings.projectSettings),
    setPluginSetting: vi.fn(async () => demoPlugin),
    upsertProjectPluginFromDir: vi.fn(async () => demoPlugin),
    upsertProjectPluginFromZip: vi.fn(async () => demoPlugin),
    installPluginFromUrl: vi.fn(async () => demoPlugin),
    setPluginEnabled: vi.fn(async () => demoPlugin),
    refreshPluginMetrics: vi.fn(async () => demoPlugin),
    getPluginRegistry: vi.fn(async () => ({
      generatedAt: "2026-07-26T10:00:00Z",
      plugins: [],
    })),
    createScan: vi.fn(async () => draftScan),
    listScans: vi.fn(async () => [completedScan]),
    getScan: vi.fn(async () => completedScanDetail),
    exportScanPdf: vi.fn(async (_scanId, destPath) => ({
      destinationPath: destPath,
      sha256: "0".repeat(64),
      byteLength: 1024,
      pageCount: 3,
    })),
    updateScanDraft: vi.fn(async () => draftScan),
    runScan: vi.fn(async () => completedScan),
    updateScanPreview: vi.fn(async () => completedScan),
    setScanArchived: vi.fn(async () => ({
      ...completedScan,
      isArchived: true,
    })),
    reorderScans: vi.fn(async () => [completedScan]),
    createPreviewProject: vi.fn(async () => undefined),
    getProjectLockStatus: vi.fn(async () => ({
      locked: false,
      unlocked: true,
    })),
    setProjectPassword: vi.fn(async () => ({
      locked: true,
      unlocked: true,
    })),
    changeProjectPassword: vi.fn(async () => ({
      locked: true,
      unlocked: true,
    })),
    removeProjectPassword: vi.fn(async () => ({
      locked: false,
      unlocked: true,
    })),
  };

  return Object.assign(client, overrides);
}
