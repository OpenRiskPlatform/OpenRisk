/**
 * Settings Context Provider
 * Provides access to settings throughout the application
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { InMemorySettingsStore } from "./InMemorySettingsStore";
import type { GlobalSettings, PluginSettings, SettingsStore } from "./types";

interface SettingsContextValue {
  store: SettingsStore;
  globalSettings: GlobalSettings;
  updateGlobalSettings: (settings: Partial<GlobalSettings>) => void;
  getPluginSettings: (pluginId: string) => PluginSettings;
  updatePluginSettings: (pluginId: string, settings: PluginSettings) => void;
  resetSettings: () => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

interface SettingsProviderProps {
  children: ReactNode;
  store?: SettingsStore;
}

export function SettingsProvider({
  children,
  store: customStore,
}: SettingsProviderProps) {
  const [store] = useState(() => customStore || new InMemorySettingsStore());
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings>(
    store.getGlobalSettings()
  );
  // Version counter to trigger re-renders when plugin settings change
  const [pluginSettingsVersion, setPluginSettingsVersion] = useState(0);

  const updateGlobalSettings = useCallback(
    (settings: Partial<GlobalSettings>) => {
      store.setGlobalSettings(settings);
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
    (pluginId: string, settings: PluginSettings) => {
      store.setPluginSettings(pluginId, settings);
      setPluginSettingsVersion((v) => v + 1); // Trigger re-render
    },
    [store]
  );

  const resetSettings = useCallback(() => {
    store.resetToDefaults();
    setGlobalSettings(store.getGlobalSettings());
  }, [store]);

  const value: SettingsContextValue = {
    store,
    globalSettings,
    updateGlobalSettings,
    getPluginSettings,
    updatePluginSettings,
    resetSettings,
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
