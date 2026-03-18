/**
 * Hook for accessing backend client
 */

import { createContext, useContext, useState, type ReactNode } from "react";
import { TauriBackendClient } from "@/core/backend/TauriBackendClient";
import type { BackendClient } from "@/core/backend/types";

interface BackendClientContextValue {
  client: BackendClient;
}

const BackendClientContext = createContext<BackendClientContextValue | null>(
  null
);

interface BackendClientProviderProps {
  children: ReactNode;
  client?: BackendClient;
}

export function BackendClientProvider({
  children,
  client: customClient,
}: BackendClientProviderProps) {
  const [client] = useState<BackendClient>(() => {
    if (customClient) {
      return customClient;
    }

    // Always use TauriBackendClient - it will fail if invoke doesn't work
    // This ensures we're always testing the real backend integration
    console.log("Using TauriBackendClient");
    return new TauriBackendClient();
  });

  return (
    <BackendClientContext.Provider value={{ client }}>
      {children}
    </BackendClientContext.Provider>
  );
}

export function useBackendClient() {
  const context = useContext(BackendClientContext);

  if (!context) {
    throw new Error(
      "useBackendClient must be used within a BackendClientProvider"
    );
  }

  return context.client;
}
