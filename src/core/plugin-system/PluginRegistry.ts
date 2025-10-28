/**
 * Plugin Registry
 * Manages installed plugins and available plugins
 */

import type { InstalledPlugin, PluginManifest } from "./types";
import { MOCK_PLUGINS } from "./mock-plugins";

export class PluginRegistry {
  private installedPlugins: Map<string, InstalledPlugin> = new Map();
  private availablePlugins: PluginManifest[] = MOCK_PLUGINS;

  /**
   * Get all available plugins (not yet installed)
   */
  getAvailablePlugins(): PluginManifest[] {
    const installedNames = new Set(
      Array.from(this.installedPlugins.values()).map((p) => p.name)
    );

    return this.availablePlugins.filter((p) => !installedNames.has(p.name));
  }

  /**
   * Get all installed plugins
   */
  getInstalledPlugins(): InstalledPlugin[] {
    return Array.from(this.installedPlugins.values());
  }

  /**
   * Get a specific installed plugin by ID
   */
  getPlugin(pluginId: string): InstalledPlugin | undefined {
    return this.installedPlugins.get(pluginId);
  }

  /**
   * Add/install a plugin
   */
  addPlugin(manifest: PluginManifest): InstalledPlugin {
    // Check if plugin is already installed
    if (this.isInstalled(manifest.name)) {
      throw new Error(`Plugin "${manifest.name}" is already installed`);
    }

    // Generate unique ID
    const id = this.generatePluginId(manifest.name);

    const installedPlugin: InstalledPlugin = {
      ...manifest,
      id,
      enabled: true,
      installedAt: new Date(),
    };

    this.installedPlugins.set(id, installedPlugin);

    return installedPlugin;
  }

  /**
   * Remove/uninstall a plugin
   */
  removePlugin(pluginId: string): boolean {
    return this.installedPlugins.delete(pluginId);
  }

  /**
   * Enable a plugin
   */
  enablePlugin(pluginId: string): void {
    const plugin = this.installedPlugins.get(pluginId);
    if (plugin) {
      plugin.enabled = true;
    }
  }

  /**
   * Disable a plugin
   */
  disablePlugin(pluginId: string): void {
    const plugin = this.installedPlugins.get(pluginId);
    if (plugin) {
      plugin.enabled = false;
    }
  }

  /**
   * Toggle plugin enabled/disabled state
   */
  togglePlugin(pluginId: string): boolean {
    const plugin = this.installedPlugins.get(pluginId);
    if (plugin) {
      plugin.enabled = !plugin.enabled;
      return plugin.enabled;
    }
    return false;
  }

  /**
   * Check if a plugin is installed
   */
  isInstalled(pluginName: string): boolean {
    return Array.from(this.installedPlugins.values()).some(
      (p) => p.name === pluginName
    );
  }

  /**
   * Generate a unique plugin ID
   */
  private generatePluginId(name: string): string {
    const baseId = name.toLowerCase().replace(/\s+/g, "-");
    let id = baseId;
    let counter = 1;

    while (this.installedPlugins.has(id)) {
      id = `${baseId}-${counter}`;
      counter++;
    }

    return id;
  }
}
