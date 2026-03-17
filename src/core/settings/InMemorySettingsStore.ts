/**
 * In-Memory Settings Store Implementation
 * Stores settings in memory (lost on refresh)
 */

import type { GlobalSettings, PluginSettings, SettingsStore } from "./types";

const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
  theme: "system",
};

export class InMemorySettingsStore implements SettingsStore {
  private globalSettings: GlobalSettings;
  private pluginSettings: Map<string, PluginSettings>;

  constructor() {
    // Try to load theme from localStorage
    let theme: "light" | "dark" | "system" = DEFAULT_GLOBAL_SETTINGS.theme;
    try {
      const savedTheme = localStorage.getItem("theme");
      if (
        savedTheme === "light" ||
        savedTheme === "dark" ||
        savedTheme === "system"
      ) {
        theme = savedTheme;
      }
    } catch (e) {
      console.error("Failed to load theme from localStorage:", e);
    }

    this.globalSettings = { ...DEFAULT_GLOBAL_SETTINGS, theme };
    this.pluginSettings = new Map();
  }

  getGlobalSettings(): GlobalSettings {
    return { ...this.globalSettings };
  }

  setGlobalSettings(settings: Partial<GlobalSettings>): void {
    this.globalSettings = {
      ...this.globalSettings,
      ...settings,
    };

    // Persist theme to localStorage for FOUC prevention
    if (settings.theme !== undefined) {
      try {
        localStorage.setItem("theme", settings.theme);
      } catch (e) {
        console.error("Failed to save theme to localStorage:", e);
      }
    }
  }

  getPluginSettings(pluginId: string): PluginSettings {
    return { ...(this.pluginSettings.get(pluginId) || {}) };
  }

  setPluginSettings(pluginId: string, settings: PluginSettings): void {
    this.pluginSettings.set(pluginId, { ...settings });
  }

  resetToDefaults(): void {
    this.globalSettings = { ...DEFAULT_GLOBAL_SETTINGS };
    this.pluginSettings.clear();
  }

  exportSettings(): string {
    return JSON.stringify(
      {
        global: this.globalSettings,
        plugins: Object.fromEntries(this.pluginSettings),
      },
      null,
      2
    );
  }

  importSettings(json: string): void {
    try {
      const data = JSON.parse(json);

      if (data.global) {
        this.globalSettings = { ...DEFAULT_GLOBAL_SETTINGS, ...data.global };
      }

      if (data.plugins) {
        this.pluginSettings = new Map(Object.entries(data.plugins));
      }
    } catch (error) {
      console.error("Failed to import settings:", error);
      throw new Error("Invalid settings format");
    }
  }
}
