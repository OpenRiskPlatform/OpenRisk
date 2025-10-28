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

/**
 * Abstract base class for backend communication
 * Implementations: MockBackendClient, TauriBackendClient, HttpBackendClient
 */
export abstract class BackendClient {
  /**
   * Execute a plugin with given inputs
   */
  abstract executePlugin(
    pluginId: string,
    inputs: Record<string, unknown>
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
}
