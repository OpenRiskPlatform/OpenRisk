/**
 * Backend Communication Type Definitions
 */

import { InstalledPlugin, PluginId, PluginInputs, PluginSettings } from "@/bindings/Plugin";
import { Project } from "@/bindings/Project";
import { ProjectSettings } from "src-tauri/bindings/ProjectSettings";

export type BackendEventType =
  | "plugin.execution.started"
  | "plugin.execution.progress"
  | "plugin.execution.completed"
  | "plugin.execution.failed"
  | "plugin.installed"
  | "plugin.removed"
  | "settings.updated";

export interface BackendEvent {
  type: BackendEventType;
  timestamp: Date;
  payload: unknown;
}

export interface PluginExecutionRequest {
  pluginId: string;
  inputs: Record<string, unknown>;
}

export interface PluginExecutionResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}

export const PluginStatus = {
  Idle: "idle",
  Running: "running",
  Completed: "completed",
  Failed: "failed",
} as const;

export type PluginStatus = (typeof PluginStatus)[keyof typeof PluginStatus];

export interface PluginStatusResponse {
  pluginId: string;
  status: PluginStatus;
  lastExecuted?: Date;
  lastResult?: PluginExecutionResponse;
}

/**
 * Abstract base class for backend communication
 * Implementations: MockBackendClient, TauriBackendClient, HttpBackendClient
 */
export abstract class BackendClient {
  
  abstract listPlugins(): Promise<Array<InstalledPlugin>>;

  abstract getPlugin(pluginId: PluginId): Promise<InstalledPlugin>;

  abstract configurePlugin(pluginId: PluginId, settings: PluginSettings): any;

  /**
   * Execute a plugin with given inputs and settings
   */
  abstract executePlugin(
    plugin_id: PluginId,
    inputs: PluginInputs,
  ): Promise<PluginExecutionResponse>;

  /**
   * Subscribe to backend events
   */
  abstract subscribeToEvents(callback: (event: BackendEvent) => void): void;

  /**
   * Get current status of a plugin
   */
  abstract getPluginStatus(pluginId: string): Promise<PluginStatusResponse>;

  /**
   * Unsubscribe from events and cleanup
   */
  abstract unsubscribe(): void;

  /**
   * Create a new project at the given directory
   */
  abstract createProject(
    name: string,
    directory: string
  ): Promise<Project>;

  /**
   * Open an existing project
   */
  abstract openProject(directory: string): Promise<Project>;

  /**
   * Return current active project
   */
  abstract getActiveProject(): Promise<Project>;
}
