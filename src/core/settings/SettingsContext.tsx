/**
 * Settings Context Provider
 * Provides access to settings throughout the application
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { InMemorySettingsStore } from "./InMemorySettingsStore";
import { TauriSettingsStore } from "./TauriSettingsStore";
import type { GlobalSettings, PluginSettings, SettingsStore } from "./types";

interface SettingsContextValue {
  store: SettingsStore;
  globalSettings: GlobalSettings;
  updateGlobalSettings: (settings: Partial<GlobalSettings>) => Promise<void>;
  getPluginSettings: (pluginId: string) => PluginSettings;
  updatePluginSettings: (
    pluginId: string,
    settings: PluginSettings
  ) => Promise<void>;
  resetSettings: () => Promise<void>;
  loading: boolean;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

interface SettingsProviderProps {
  children: ReactNode;
  store?: SettingsStore;
}

// Check if running in Tauri
const isTauri = () => {
  return typeof window !== "undefined" && "__TAURI__" in window;
};

export function SettingsProvider({
  children,
  store: customStore,
}: SettingsProviderProps) {
  const [store] = useState<SettingsStore>(() => {
    if (customStore) return customStore;
    if (isTauri()) {
      console.log("[SettingsProvider] Using TauriSettingsStore (persistent)");
      return new TauriSettingsStore();
    }
    console.log(
      "[SettingsProvider] Using InMemorySettingsStore (not in Tauri)"
    );
    return new InMemorySettingsStore();
  });

  const [loading, setLoading] = useState(true);
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings>(
    store.getGlobalSettings()
  );
  // Version counter to trigger re-renders when plugin settings change
  const [pluginSettingsVersion, setPluginSettingsVersion] = useState(0);

  // Initialize store on mount (for TauriSettingsStore)
  useEffect(() => {
    const init = async () => {
      if ("initialize" in store && typeof store.initialize === "function") {
        await (store as any).initialize();
        setGlobalSettings(store.getGlobalSettings());
      }
      setLoading(false);
    };
    init();
  }, [store]);

  const updateGlobalSettings = useCallback(
    async (settings: Partial<GlobalSettings>) => {
      // Check if it's a TauriSettingsStore with async methods
      const hasAsyncMethod =
        "setGlobalSettings" in store &&
        (store as any).setGlobalSettings &&
        (store as any).setGlobalSettings.constructor &&
        (store as any).setGlobalSettings.constructor.name === "AsyncFunction";

      if (hasAsyncMethod) {
        await (store as any).setGlobalSettings(settings);
      } else {
        store.setGlobalSettings(settings);
      }
      setGlobalSettings(store.getGlobalSettings());
    },
    [store]
  );

  const getPluginSettings = useCallback(
    (pluginId: string) => {
      return store.getPluginSettings(pluginId);
    },
    [store, pluginSettingsVersion] // Add dependency to trigger re-renders
  );

  const updatePluginSettings = useCallback(
    async (pluginId: string, settings: PluginSettings) => {
      const hasAsyncMethod =
        "setPluginSettings" in store &&
        (store as any).setPluginSettings &&
        (store as any).setPluginSettings.constructor &&
        (store as any).setPluginSettings.constructor.name === "AsyncFunction";

      if (hasAsyncMethod) {
        await (store as any).setPluginSettings(pluginId, settings);
      } else {
        store.setPluginSettings(pluginId, settings);
      }
      setPluginSettingsVersion((v) => v + 1); // Trigger re-render
    },
    [store]
  );

  const resetSettings = useCallback(async () => {
    const hasAsyncMethod =
      "resetToDefaults" in store &&
      (store as any).resetToDefaults &&
      (store as any).resetToDefaults.constructor &&
      (store as any).resetToDefaults.constructor.name === "AsyncFunction";

    if (hasAsyncMethod) {
      await (store as any).resetToDefaults();
    } else {
      store.resetToDefaults();
    }
    setGlobalSettings(store.getGlobalSettings());
  }, [store]);

  const value: SettingsContextValue = {
    store,
    globalSettings,
    updateGlobalSettings,
    getPluginSettings,
    updatePluginSettings,
    resetSettings,
    loading,
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);

  if (!context) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }

  return context;
}
