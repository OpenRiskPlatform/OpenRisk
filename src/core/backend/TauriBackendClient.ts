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
} from "./types";
import { Project } from "src-tauri/bindings/Project";
import { ProjectSettings } from "src-tauri/bindings/ProjectSettings";

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

  async createProject(name: string, directory: string): Promise<Project> {
    try {
      const result = await invoke<Project>("create_project", {
        name: name,
        path: directory,
      });
      return result;
    } catch (error: any) {
      console.error("[TauriBackendClient] createProject error:", error);
      throw new Error(error?.message ?? error?.toString() ?? "Failed to create project");
    }
  }

  async openProject(directory: string): Promise<Project> {
    try {
      const result = await invoke<Project>("load_project", {
        path: directory,
      });
      return result;
    } catch (error: any) {
      console.error("[TauriBackendClient] openProject error:", error);
      throw new Error(error?.message ?? error?.toString() ?? "Failed to open project");
    }
  }

  async getActiveProject(): Promise<Project> {
    try {
      const result = await invoke<Project>("get_active_project");
      return result;
    } catch (error: any) {
      console.error("[TauriBackendClient] loadSettings error:", error);
      throw new Error(error?.message ?? error?.toString() ?? "Failed to load settings");
    }
  }
}
