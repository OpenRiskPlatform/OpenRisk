/**
 * Hook for accessing backend client
 */

import { createContext, useContext, useState, type ReactNode } from "react";
import { MockBackendClient } from "@/core/backend/MockBackendClient";
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
  const [client] = useState<BackendClient>(
    () => customClient || new MockBackendClient()
  );

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
