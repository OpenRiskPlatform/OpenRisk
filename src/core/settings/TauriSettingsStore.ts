/**
 * Tauri Settings Store Implementation
 * Persists settings to disk using Tauri Store plugin
 */

import { Store } from "@tauri-apps/plugin-store";
import type { GlobalSettings, PluginSettings, SettingsStore } from "./types";

const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
  theme: "system",
};

export class TauriSettingsStore implements SettingsStore {
  private store: Store | null;
  private globalSettings: GlobalSettings;
  private pluginSettings: Map<string, PluginSettings>;
  private initialized = false;

  constructor() {
    this.store = null;
    this.globalSettings = { ...DEFAULT_GLOBAL_SETTINGS };
    this.pluginSettings = new Map();
  }

  private async getStore(): Promise<Store> {
    if (this.store) {
      return this.store;
    }
    this.store = await Store.load("settings.json");
    return this.store;
  }

  /**
   * Initialize and load settings from disk
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const store = await this.getStore();
      // Load global settings
      const savedGlobal = await store.get<GlobalSettings>("global");
      if (savedGlobal) {
        this.globalSettings = { ...DEFAULT_GLOBAL_SETTINGS, ...savedGlobal };
      }

      // Load plugin settings
      const savedPlugins =
        await store.get<Record<string, PluginSettings>>("plugins");
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
      const store = await this.getStore();
      await store.set("global", this.globalSettings);
      await store.save();

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
      const store = await this.getStore();
      await store.set("plugins", Object.fromEntries(this.pluginSettings));
      await store.save();
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
      const store = await this.getStore();
      await store.clear();
      await store.save();
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
        const store = await this.getStore();
        await store.set("global", this.globalSettings);
      }

      if (data.plugins) {
        this.pluginSettings = new Map(Object.entries(data.plugins));
        const store = await this.getStore();
        await store.set(
          "plugins",
          Object.fromEntries(this.pluginSettings)
        );
      }

      const store = await this.getStore();
      await store.save();
    } catch (error) {
      console.error("[TauriSettingsStore] Failed to import settings:", error);
      throw new Error("Invalid settings format");
    }
  }
}
