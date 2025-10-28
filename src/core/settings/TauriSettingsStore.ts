/**
 * Tauri Settings Store Implementation
 * Persists settings to disk using Tauri Store plugin
 */

import { Store } from "@tauri-apps/plugin-store";
import type { GlobalSettings, PluginSettings, SettingsStore } from "./types";

const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
  theme: "system",
  language: "en",
  autoSave: true,
  compactMode: false,
};

export class TauriSettingsStore implements SettingsStore {
  private store: Store;
  private globalSettings: GlobalSettings;
  private pluginSettings: Map<string, PluginSettings>;
  private initialized = false;

  constructor() {
    this.store = new Store("settings.json");
    this.globalSettings = { ...DEFAULT_GLOBAL_SETTINGS };
    this.pluginSettings = new Map();
  }

  /**
   * Initialize and load settings from disk
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Load global settings
      const savedGlobal = await this.store.get<GlobalSettings>("global");
      if (savedGlobal) {
        this.globalSettings = { ...DEFAULT_GLOBAL_SETTINGS, ...savedGlobal };
      }

      // Load plugin settings
      const savedPlugins =
        await this.store.get<Record<string, PluginSettings>>("plugins");
      if (savedPlugins) {
        this.pluginSettings = new Map(Object.entries(savedPlugins));
      }

      this.initialized = true;
      console.log("[TauriSettingsStore] Settings loaded from disk");
    } catch (error) {
      console.error("[TauriSettingsStore] Failed to load settings:", error);
    }
  }

  getGlobalSettings(): GlobalSettings {
    return { ...this.globalSettings };
  }

  async setGlobalSettings(settings: Partial<GlobalSettings>): Promise<void> {
    this.globalSettings = {
      ...this.globalSettings,
      ...settings,
    };

    try {
      await this.store.set("global", this.globalSettings);
      await this.store.save();

      // Also persist theme to localStorage for FOUC prevention
      if (settings.theme !== undefined) {
        try {
          localStorage.setItem("theme", settings.theme);
        } catch (e) {
          console.error("Failed to save theme to localStorage:", e);
        }
      }
    } catch (error) {
      console.error(
        "[TauriSettingsStore] Failed to save global settings:",
        error
      );
    }
  }

  getPluginSettings(pluginId: string): PluginSettings {
    return { ...(this.pluginSettings.get(pluginId) || {}) };
  }

  async setPluginSettings(
    pluginId: string,
    settings: PluginSettings
  ): Promise<void> {
    this.pluginSettings.set(pluginId, { ...settings });

    try {
      await this.store.set("plugins", Object.fromEntries(this.pluginSettings));
      await this.store.save();
    } catch (error) {
      console.error(
        "[TauriSettingsStore] Failed to save plugin settings:",
        error
      );
    }
  }

  async resetToDefaults(): Promise<void> {
    this.globalSettings = { ...DEFAULT_GLOBAL_SETTINGS };
    this.pluginSettings.clear();

    try {
      await this.store.clear();
      await this.store.save();
    } catch (error) {
      console.error("[TauriSettingsStore] Failed to reset settings:", error);
    }
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

  async importSettings(json: string): Promise<void> {
    try {
      const data = JSON.parse(json);

      if (data.global) {
        this.globalSettings = { ...DEFAULT_GLOBAL_SETTINGS, ...data.global };
        await this.store.set("global", this.globalSettings);
      }

      if (data.plugins) {
        this.pluginSettings = new Map(Object.entries(data.plugins));
        await this.store.set(
          "plugins",
          Object.fromEntries(this.pluginSettings)
        );
      }

      await this.store.save();
    } catch (error) {
      console.error("[TauriSettingsStore] Failed to import settings:", error);
      throw new Error("Invalid settings format");
    }
  }
}
