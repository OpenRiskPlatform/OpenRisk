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

    // Remove all theme classes
    root.classList.remove("light", "dark", "theme-ocean", "theme-forest", "theme-midnight");

    const theme = globalSettings.theme;

    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      root.classList.add(systemTheme);
    } else if (theme === "light" || theme === "dark") {
      root.classList.add(theme);
    } else {
      // Custom color profile — still needs a base (light) plus the profile class
      root.classList.add("light");
      root.classList.add(`theme-${theme}`);
    }
  }, [globalSettings.theme]);

  useEffect(() => {
    // Listen for system theme changes when in system mode
    if (globalSettings.theme !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = (e: MediaQueryListEvent) => {
      const root = window.document.documentElement;
      root.classList.remove("light", "dark", "theme-ocean", "theme-forest", "theme-midnight");
      root.classList.add(e.matches ? "dark" : "light");
    };

    mediaQuery.addEventListener("change", handleChange);

    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [globalSettings.theme]);
}
