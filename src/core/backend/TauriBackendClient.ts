/**
 * Tauri Backend Client
 * Uses Tauri IPC for communication with Rust backend
 */

import { invoke } from "@tauri-apps/api/core";
import { BackendClient } from "./types";
import type {
  BackendEvent,
  PluginExecutionResponse,
  ScanDetail,
  ScanSummary,
  PluginStatusResponse,
  PluginSettingsDescriptor,
  ProjectSettingsRecord,
  ProjectSummary,
  ProjectSettingsPayload,
} from "./types";

export class TauriBackendClient extends BackendClient {
  private eventCallbacks: Array<(event: BackendEvent) => void> = [];

  async executePlugin(
    pluginId: string,
    inputs: Record<string, unknown>,
    settings?: Record<string, unknown>
  ): Promise<PluginExecutionResponse> {
    try {
      console.log("[TauriBackendClient] Executing plugin:", pluginId);
      console.log("[TauriBackendClient] Inputs:", inputs);
      console.log("[TauriBackendClient] Settings:", settings);

      const inputsJson = JSON.stringify(inputs);
      const settingsJson = JSON.stringify(settings || {});

      console.log("[TauriBackendClient] Invoking Tauri command...");

      const result = await invoke<string>("execute_plugin", {
        pluginId,
        inputsJson,
        settingsJson,
      });

      console.log("[TauriBackendClient] Raw result from Rust:", result);

      // Parse the result
      const data = JSON.parse(result);

      console.log("[TauriBackendClient] Parsed result:", data);

      return {
        success: true,
        data,
      };
    } catch (error: any) {
      console.error("[TauriBackendClient] Error:", error);
      return {
        success: false,
        error: error.toString(),
      };
    }
  }

  subscribeToEvents(callback: (event: BackendEvent) => void): void {
    this.eventCallbacks.push(callback);
    // TODO: Set up Tauri event listeners when needed
  }

  async getPluginStatus(pluginId: string): Promise<PluginStatusResponse> {
    // TODO: Implement plugin status tracking
    return {
      pluginId,
      status: "idle",
    };
  }

  unsubscribe(): void {
    this.eventCallbacks = [];
  }

  async createProject(name: string, directory: string): Promise<ProjectSummary> {
    try {
      const result = await invoke<string>("create_project", {
        name,
        dirPath: directory,
      });
      return JSON.parse(result) as ProjectSummary;
    } catch (error: any) {
      console.error("[TauriBackendClient] createProject error:", error);
      throw new Error(error?.message ?? error?.toString() ?? "Failed to create project");
    }
  }

  async openProject(directory: string): Promise<ProjectSummary> {
    try {
      const result = await invoke<string>("open_project", {
        dirPath: directory,
      });
      return JSON.parse(result) as ProjectSummary;
    } catch (error: any) {
      console.error("[TauriBackendClient] openProject error:", error);
      throw new Error(error?.message ?? error?.toString() ?? "Failed to open project");
    }
  }

  async loadSettings(directory: string): Promise<ProjectSettingsPayload> {
    try {
      const result = await invoke<string>("load_settings", {
        dirPath: directory,
      });
      return JSON.parse(result) as ProjectSettingsPayload;
    } catch (error: any) {
      console.error("[TauriBackendClient] loadSettings error:", error);
      throw new Error(error?.message ?? error?.toString() ?? "Failed to load settings");
    }
  }

  async updateProjectSettings(
    directory: string,
    patch: { theme?: "light" | "dark" | "system" }
  ): Promise<ProjectSettingsRecord> {
    try {
      const result = await invoke<string>("update_project_settings", {
        dirPath: directory,
        theme: patch.theme,
      });
      return JSON.parse(result) as ProjectSettingsRecord;
    } catch (error: any) {
      console.error("[TauriBackendClient] updateProjectSettings error:", error);
      throw new Error(
        error?.message ?? error?.toString() ?? "Failed to update project settings"
      );
    }
  }

  async updateProjectPluginSettings(
    directory: string,
    pluginId: string,
    settings: Record<string, unknown>
  ): Promise<PluginSettingsDescriptor> {
    try {
      const result = await invoke<string>("update_project_plugin_settings", {
        dirPath: directory,
        pluginId,
        settingsJson: JSON.stringify(settings),
      });
      return JSON.parse(result) as PluginSettingsDescriptor;
    } catch (error: any) {
      console.error("[TauriBackendClient] updateProjectPluginSettings error:", error);
      throw new Error(
        error?.message ?? error?.toString() ?? "Failed to update plugin settings"
      );
    }
  }

  async createScan(directory: string, preview?: string): Promise<ScanSummary> {
    try {
      const result = await invoke<string>("create_scan", {
        dirPath: directory,
        preview,
      });
      return JSON.parse(result) as ScanSummary;
    } catch (error: any) {
      console.error("[TauriBackendClient] createScan error:", error);
      throw new Error(error?.message ?? error?.toString() ?? "Failed to create scan");
    }
  }

  async listScans(directory: string): Promise<ScanSummary[]> {
    try {
      const result = await invoke<string>("list_scans", {
        dirPath: directory,
      });
      return JSON.parse(result) as ScanSummary[];
    } catch (error: any) {
      console.error("[TauriBackendClient] listScans error:", error);
      throw new Error(error?.message ?? error?.toString() ?? "Failed to list scans");
    }
  }

  async getScan(directory: string, scanId: string): Promise<ScanDetail> {
    try {
      const result = await invoke<string>("get_scan", {
        dirPath: directory,
        scanId,
      });
      return JSON.parse(result) as ScanDetail;
    } catch (error: any) {
      console.error("[TauriBackendClient] getScan error:", error);
      throw new Error(error?.message ?? error?.toString() ?? "Failed to get scan");
    }
  }

  async runScan(
    directory: string,
    scanId: string,
    selectedPlugins: string[],
    inputs: Record<string, unknown>
  ): Promise<ScanSummary> {
    try {
      const result = await invoke<string>("run_scan", {
        dirPath: directory,
        scanId,
        selectedPluginsJson: JSON.stringify(selectedPlugins),
        inputsJson: JSON.stringify(inputs),
      });
      return JSON.parse(result) as ScanSummary;
    } catch (error: any) {
      console.error("[TauriBackendClient] runScan error:", error);
      throw new Error(error?.message ?? error?.toString() ?? "Failed to run scan");
    }
  }

  async upsertProjectPluginFromDir(
    directory: string,
    pluginDir: string,
    replacePluginId?: string
  ): Promise<PluginSettingsDescriptor> {
    try {
      const result = await invoke<string>("upsert_project_plugin_from_dir", {
        dirPath: directory,
        pluginDir,
        replacePluginId,
      });
      return JSON.parse(result) as PluginSettingsDescriptor;
    } catch (error: any) {
      console.error("[TauriBackendClient] upsertProjectPluginFromDir error:", error);
      throw new Error(
        error?.message ?? error?.toString() ?? "Failed to load plugin from folder"
      );
    }
  }
}
