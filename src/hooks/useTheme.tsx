/**
 * Theme Management Hook
 * Handles theme switching between light, dark, and system preferences
 */

import { useEffect } from "react";
import { useSettings } from "@/core/settings/SettingsContext";

export function useTheme() {
  const { globalSettings } = useSettings();

  useEffect(() => {
    const root = window.document.documentElement;

    // Remove existing theme classes
    root.classList.remove("light", "dark");

    if (globalSettings.theme === "system") {
      // Use system preference
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light";
      root.classList.add(systemTheme);
    } else {
      // Use user-selected theme
      root.classList.add(globalSettings.theme);
    }
  }, [globalSettings.theme]);

  useEffect(() => {
    // Listen for system theme changes when in system mode
    if (globalSettings.theme !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = (e: MediaQueryListEvent) => {
      const root = window.document.documentElement;
      root.classList.remove("light", "dark");
      root.classList.add(e.matches ? "dark" : "light");
    };

    mediaQuery.addEventListener("change", handleChange);

    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [globalSettings.theme]);
}
