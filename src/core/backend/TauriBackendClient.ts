/**
 * Tauri Backend Client
 * Uses Tauri IPC for communication with Rust backend
 */

import { invoke } from "@tauri-apps/api/core";
import { BackendClient } from "./types";
import type {
  BackendEvent,
  PluginExecutionResponse,
  PluginStatusResponse,
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
}
