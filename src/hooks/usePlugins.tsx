/**
 * Hook for accessing and managing plugins
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { PluginRegistry } from "@/core/plugin-system/PluginRegistry";
import type {
  PluginManifest,
  InstalledPlugin,
} from "@/core/plugin-system/types";

interface PluginContextValue {
  registry: PluginRegistry;
  installedPlugins: InstalledPlugin[];
  availablePlugins: PluginManifest[];
  addPlugin: (manifest: PluginManifest) => InstalledPlugin;
  removePlugin: (pluginId: string) => void;
  togglePlugin: (pluginId: string) => void;
  refreshPlugins: () => void;
}

const PluginContext = createContext<PluginContextValue | null>(null);

interface PluginProviderProps {
  children: ReactNode;
}

export function PluginProvider({ children }: PluginProviderProps) {
  const [registry] = useState(() => new PluginRegistry());
  const [installedPlugins, setInstalledPlugins] = useState<InstalledPlugin[]>(
    []
  );
  const [availablePlugins, setAvailablePlugins] = useState<PluginManifest[]>(
    registry.getAvailablePlugins()
  );

  const refreshPlugins = useCallback(() => {
    setInstalledPlugins(registry.getInstalledPlugins());
    setAvailablePlugins(registry.getAvailablePlugins());
  }, [registry]);

  const addPlugin = useCallback(
    (manifest: PluginManifest) => {
      const plugin = registry.addPlugin(manifest);
      refreshPlugins();
      return plugin;
    },
    [registry, refreshPlugins]
  );

  const removePlugin = useCallback(
    (pluginId: string) => {
      registry.removePlugin(pluginId);
      refreshPlugins();
    },
    [registry, refreshPlugins]
  );

  const togglePlugin = useCallback(
    (pluginId: string) => {
      registry.togglePlugin(pluginId);
      refreshPlugins();
    },
    [registry, refreshPlugins]
  );

  const value: PluginContextValue = {
    registry,
    installedPlugins,
    availablePlugins,
    addPlugin,
    removePlugin,
    togglePlugin,
    refreshPlugins,
  };

  return (
    <PluginContext.Provider value={value}>{children}</PluginContext.Provider>
  );
}

export function usePlugins() {
  const context = useContext(PluginContext);

  if (!context) {
    throw new Error("usePlugins must be used within a PluginProvider");
  }

  return context;
}
