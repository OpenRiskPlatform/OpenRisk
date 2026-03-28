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

export interface ProjectLockStatus {
  locked: boolean;
  unlocked: boolean;
}

export interface ScanSummary {
  id: string;
  status: "Draft" | "Running" | "Completed" | "Failed" | "Finished";
  preview?: string | null;
}

export interface PluginEntrypointSelection {
  pluginId: string;
  entrypointId: string;
}

export interface PluginResultEnvelope {
  ok: boolean;
  data?: unknown;
  error?: string;
}

export interface ScanPluginResult {
  pluginId: string;
  entrypointId: string;
  output: PluginResultEnvelope;
}

export interface ScanDetail {
  id: string;
  status: "Draft" | "Running" | "Completed" | "Failed" | "Finished";
  preview?: string | null;
  selectedPlugins: PluginEntrypointSelection[];
  inputs: Record<string, unknown>;
  results: ScanPluginResult[];
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

  /**
   * Update project display name persisted in project database
   */
  abstract updateProjectName(
    directory: string,
    name: string
  ): Promise<ProjectSummary>;

  /**
   * Update plugin settings persisted in current project database
   */
  abstract updateProjectPluginSettings(
    directory: string,
    pluginId: string,
    settings: Record<string, unknown>
  ): Promise<PluginSettingsDescriptor>;

  /**
   * Create a draft scan in the project
   */
  abstract createScan(
    directory: string,
    preview?: string
  ): Promise<ScanSummary>;

  /**
   * Load all scans for the project
   */
  abstract listScans(directory: string): Promise<ScanSummary[]>;

  /**
   * Load full scan details including selected plugins and results
   */
  abstract getScan(directory: string, scanId: string): Promise<ScanDetail>;

  /**
   * Run a draft scan with selected plugins and plugin-specific inputs
   */
  abstract runScan(
    directory: string,
    scanId: string,
    selectedPlugins: PluginEntrypointSelection[],
    inputs: Record<string, unknown>
  ): Promise<ScanSummary>;

  /**
   * Check if a plugin is ready to run (calls plugin's validate() export)
   */
  abstract checkPluginReadiness(
    pluginId: string,
    settingsJson?: string
  ): Promise<{ ok: boolean; error?: string }>;

  /**
   * Rename scan (updates preview/title)
   */
  abstract updateScanPreview(
    directory: string,
    scanId: string,
    preview: string
  ): Promise<ScanSummary>;

  /**
   * Add a new plugin to project or replace an existing one from folder.
   */
  abstract upsertProjectPluginFromDir(
    directory: string,
    pluginDir: string,
    replacePluginId?: string
  ): Promise<PluginSettingsDescriptor>;

  abstract getProjectLockStatus(directory: string): Promise<ProjectLockStatus>;

  abstract unlockProject(
    directory: string,
    password: string
  ): Promise<ProjectLockStatus>;

  abstract setProjectPassword(
    directory: string,
    newPassword: string
  ): Promise<ProjectLockStatus>;

  abstract changeProjectPassword(
    directory: string,
    currentPassword: string,
    newPassword: string
  ): Promise<ProjectLockStatus>;

  abstract removeProjectPassword(
    directory: string,
    currentPassword: string
  ): Promise<ProjectLockStatus>;
}
