import { createRootRoute, Outlet } from "@tanstack/react-router";
import { SettingsProvider } from "@/core/settings/SettingsContext";
import { useTheme } from "@/hooks/useTheme";
import { Toaster } from "sonner";

export const Route = createRootRoute({
  component: RootComponent,
});

function ThemeWrapper() {
  useTheme();
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
