/**
 * Backend Communication Type Definitions
 */

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

export interface ProjectSummary {
  id: string;
  name: string;
  audit?: string | null;
  directory: string;
}

export interface ProjectSettingsRecord {
  id: string;
  description: string;
  locale: string;
  theme: "light" | "dark" | "system";
}

export interface PluginSettingsDescriptor {
  id: string;
  name: string;
  version: string;
  manifest: Record<string, unknown> | null;
  inputSchema: unknown;
  settingsSchema: unknown;
  settings: Record<string, unknown> | null;
}

export interface ProjectSettingsPayload {
  project: ProjectSummary;
  projectSettings: ProjectSettingsRecord;
  plugins: PluginSettingsDescriptor[];
}

/**
 * Abstract base class for backend communication
 * Implementations: MockBackendClient, TauriBackendClient, HttpBackendClient
 */
export abstract class BackendClient {
  /**
   * Execute a plugin with given inputs and settings
   */
  abstract executePlugin(
    pluginId: string,
    inputs: Record<string, unknown>,
    settings?: Record<string, unknown>
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
  ): Promise<ProjectSummary>;

  /**
   * Open an existing project
   */
  abstract openProject(directory: string): Promise<ProjectSummary>;

  /**
   * Load project/global settings and plugin configurations
   */
  abstract loadSettings(directory: string): Promise<ProjectSettingsPayload>;

  /**
   * Update project settings fields persisted in project database
   */
  abstract updateProjectSettings(
    directory: string,
    patch: { theme?: "light" | "dark" | "system" }
  ): Promise<ProjectSettingsRecord>;
}
