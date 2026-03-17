/**
 * Mock Backend Client Implementation
 * Simulates backend communication for development/testing
 */

import { BackendClient, PluginStatus } from "./types";
import type {
  BackendEvent,
  PluginExecutionResponse,
  ScanDetail,
  ScanSummary,
  PluginStatusResponse,
  ProjectSettingsPayload,
  ProjectSettingsRecord,
  PluginSettingsDescriptor,
  ProjectSummary,
} from "./types";

export class MockBackendClient extends BackendClient {
  private eventCallbacks: Array<(event: BackendEvent) => void> = [];
  private pluginStatuses: Map<string, PluginStatus> = new Map();
  private scans: ScanSummary[] = [];

  executePlugin(
    pluginId: string,
    inputs: Record<string, unknown>,
    settings?: Record<string, unknown>
  ): Promise<PluginExecutionResponse> {
    // Simulate async execution
    return new Promise((resolve) => {
      this.pluginStatuses.set(pluginId, PluginStatus.Running);

      // Emit started event
      this.emitEvent({
        type: "plugin.execution.started",
        timestamp: new Date(),
        payload: { pluginId, inputs, settings },
      });

      // Simulate processing delay
      setTimeout(() => {
        // Mock success response with sample data
        const mockData = {
          pluginId,
          results: [
            {
              name: `${inputs.name || "Unknown"}`,
              riskScore: Math.floor(Math.random() * 100),
              matches: Math.floor(Math.random() * 5),
              timestamp: new Date().toISOString(),
            },
          ],
        };

        this.pluginStatuses.set(pluginId, PluginStatus.Completed);

        // Emit completed event
        this.emitEvent({
          type: "plugin.execution.completed",
          timestamp: new Date(),
          payload: { pluginId, data: mockData },
        });

        resolve({
          success: true,
          data: mockData,
        });
      }, 1500); // 1.5 second delay
    });
  }

  subscribeToEvents(callback: (event: BackendEvent) => void): void {
    this.eventCallbacks.push(callback);
  }

  async getPluginStatus(pluginId: string): Promise<PluginStatusResponse> {
    const status = this.pluginStatuses.get(pluginId) || PluginStatus.Idle;

    return {
      pluginId,
      status,
      lastExecuted: status !== PluginStatus.Idle ? new Date() : undefined,
    };
  }

  unsubscribe(): void {
    this.eventCallbacks = [];
    this.pluginStatuses.clear();
  }

  async createProject(name: string, directory: string): Promise<ProjectSummary> {
    const normalizedBase = directory.replace(/[\\/]+$/, "");
    const projectDirectory = `${normalizedBase}/${name}`;
    return {
      id: `mock-${Date.now()}`,
      name,
      audit: null,
      directory: projectDirectory,
    };
  }

  async openProject(directory: string): Promise<ProjectSummary> {
    return {
      id: `mock-${Math.floor(Math.random() * 1000)}`,
      name: directory.split(/[\\/]/).pop() || "Mock Project",
      audit: null,
      directory,
    };
  }

  async loadSettings(directory: string): Promise<ProjectSettingsPayload> {
    const project = await this.openProject(directory);
    return {
      project,
      projectSettings: {
        id: "mock-settings",
        description: "Mock settings",
        locale: "en-US",
        theme: "system",
      },
      plugins: [
        {
          id: "mock-plugin",
          name: "Mock Plugin",
          version: "0.1.0",
          manifest: {},
          inputSchema: null,
          settingsSchema: [],
          settings: {},
        },
      ],
    };
  }

  async updateProjectSettings(
    _directory: string,
    patch: { theme?: "light" | "dark" | "system" }
  ): Promise<ProjectSettingsRecord> {
    return {
      id: "mock-settings",
      description: "Mock settings",
      locale: "en-US",
      theme: patch.theme ?? "system",
    };
  }

  async updateProjectPluginSettings(
    _directory: string,
    pluginId: string,
    settings: Record<string, unknown>
  ): Promise<PluginSettingsDescriptor> {
    return {
      id: pluginId,
      name: "Mock Plugin",
      version: "0.1.0",
      manifest: {},
      inputSchema: null,
      settingsSchema: [],
      settings,
    };
  }

  async createScan(_directory: string, preview?: string): Promise<ScanSummary> {
    const scan: ScanSummary = {
      id: `mock-scan-${Date.now()}`,
      status: "Draft",
      preview: preview ?? null,
    };
    this.scans.unshift(scan);
    return scan;
  }

  async listScans(_directory: string): Promise<ScanSummary[]> {
    return [...this.scans];
  }

  async getScan(_directory: string, scanId: string): Promise<ScanDetail> {
    const item = this.scans.find((scan) => scan.id === scanId);
    return {
      id: scanId,
      status: item?.status ?? "Draft",
      preview: item?.preview ?? null,
      selectedPlugins: [],
      inputs: {},
      results: [],
    };
  }

  async runScan(
    _directory: string,
    scanId: string,
    _selectedPlugins: string[],
    _inputs: Record<string, unknown>
  ): Promise<ScanSummary> {
    this.scans = this.scans.map((scan) =>
      scan.id === scanId ? { ...scan, status: "Completed" } : scan
    );
    return this.scans.find((scan) => scan.id === scanId) ?? {
      id: scanId,
      status: "Completed",
      preview: null,
    };
  }

  async upsertProjectPluginFromDir(
    _directory: string,
    pluginDir: string,
    replacePluginId?: string
  ): Promise<PluginSettingsDescriptor> {
    const id = replacePluginId || pluginDir.split(/[\\/]/).pop() || "plugin";
    return {
      id,
      name: id,
      version: "0.1.0",
      manifest: {},
      inputSchema: [],
      settingsSchema: [],
      settings: {},
    };
  }

  private emitEvent(event: BackendEvent): void {
    this.eventCallbacks.forEach((callback) => {
      try {
        callback(event);
      } catch (error) {
        console.error("Error in event callback:", error);
      }
    });
  }
}
