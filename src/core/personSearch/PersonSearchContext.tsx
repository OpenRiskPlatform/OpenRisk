/**
 * PersonSearchContext – persists person-search state across route navigation.
 * Wrap at the root (or project) level so state survives page transitions.
 */

import { createContext, useContext, ReactNode } from "react";
import { usePersonSearch } from "@/hooks/usePersonSearch";

// Infer the shape from the hook's return type
type PersonSearchContextType = ReturnType<typeof usePersonSearch>;

const PersonSearchContext = createContext<PersonSearchContextType | null>(null);

export function PersonSearchProvider({ children }: { children: ReactNode }) {
  const value = usePersonSearch();
  return (
    <PersonSearchContext.Provider value={value}>
      {children}
    </PersonSearchContext.Provider>
  );
}

export function usePersonSearchContext(): PersonSearchContextType {
  const ctx = useContext(PersonSearchContext);
  if (!ctx) {
    throw new Error("usePersonSearchContext must be used inside PersonSearchProvider");
  }
  return ctx;
}
