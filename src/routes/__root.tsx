import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/router-devtools";
import { SettingsProvider } from "@/core/settings/SettingsContext";
import { BackendClientProvider } from "@/hooks/useBackendClient";
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
      <BackendClientProvider>
        <Outlet />
        {import.meta.env.DEV && <TanStackRouterDevtools />}
      </BackendClientProvider>
    </SettingsProvider>
  );
}
