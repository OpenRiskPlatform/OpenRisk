/**
 * Plugin System Type Definitions
 */

export interface PluginAuthor {
  name: string;
  email: string;
}

export interface PluginSetting {
  name: string;
  type: "string" | "number" | "boolean";
  title: string;
  description: string;
  default: string | number | boolean | null;
}

export interface PluginInput {
  name: string;
  type: string; // 'string', 'number', 'boolean', 'list[T]', 'map[K,V]', etc.
  optional: boolean;
  title: string;
  description: string;
}

export interface PluginManifest {
  version: string;
  name: string;
  description: string;
  authors: PluginAuthor[];
  icon: string;
  license: string;
  entrypoint: string;
  settings: PluginSetting[];
  inputs: PluginInput[];
}

export interface InstalledPlugin extends PluginManifest {
  id: string; // Unique identifier for installed instance
  enabled: boolean;
  installedAt: Date;
}

export interface PluginExecutionResult {
  pluginId: string;
  success: boolean;
  data?: unknown; // Plugin output - type depends on plugin implementation
  error?: string;
  executedAt: Date;
  duration: number; // milliseconds
}
