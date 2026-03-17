/**
 * Settings System Type Definitions
 */

export interface GlobalSettings {
  theme: "light" | "dark" | "system";
}

export type PluginSettings = Record<string, string | number | boolean | null>;

/**
 * Abstract interface for settings storage
 * Implementations: InMemorySettingsStore, LocalStorageSettingsStore, etc.
 */
export interface SettingsStore {
  /**
   * Get global application settings
   */
  getGlobalSettings(): GlobalSettings;

  /**
   * Update global application settings
   */
  setGlobalSettings(settings: Partial<GlobalSettings>): void;

  /**
   * Get settings for a specific plugin
   */
  getPluginSettings(pluginId: string): PluginSettings;

  /**
   * Update settings for a specific plugin
   */
  setPluginSettings(pluginId: string, settings: PluginSettings): void;

  /**
   * Reset all settings to defaults
   */
  resetToDefaults(): void;

  /**
   * Export all settings as JSON
   */
  exportSettings(): string;

  /**
   * Import settings from JSON
   */
  importSettings(json: string): void;
}
