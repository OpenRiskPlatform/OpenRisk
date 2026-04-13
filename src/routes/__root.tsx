import { createRootRoute, Outlet } from "@tanstack/react-router";
import { SettingsProvider } from "@/core/settings/SettingsContext";
import { useTheme } from "@/hooks/useTheme";

export const Route = createRootRoute({
  component: RootComponent,
});

function ThemeWrapper() {
  useTheme(); // Apply theme based on settings
  return null;
}

function RootComponent() {
  return (
    <SettingsProvider>
      <ThemeWrapper />
      <Outlet />
    </SettingsProvider>
  );
}
