import React, { createContext, useContext, useState, useCallback } from "react";

export type ProviderFilter = "all" | "Poizon" | "Taobao";

interface ProviderContextType {
  selectedProvider: ProviderFilter;
  setSelectedProvider: (provider: ProviderFilter) => void;
  /** Returns the provider string to pass to OTAPI, or undefined for "all" */
  apiProvider: string | undefined;
}

const ProviderContext = createContext<ProviderContextType | undefined>(undefined);

export function ProviderProvider({ children }: { children: React.ReactNode }) {
  const [selectedProvider, setSelectedProvider] = useState<ProviderFilter>("all");

  const apiProvider = selectedProvider === "all" ? undefined : selectedProvider;

  return (
    <ProviderContext.Provider value={{ selectedProvider, setSelectedProvider, apiProvider }}>
      {children}
    </ProviderContext.Provider>
  );
}

export function useProvider() {
  const context = useContext(ProviderContext);
  if (!context) {
    throw new Error("useProvider must be used within a ProviderProvider");
  }
  return context;
}

export function useProviderSafe() {
  const context = useContext(ProviderContext);
  return context ?? { selectedProvider: "all" as ProviderFilter, setSelectedProvider: () => {}, apiProvider: undefined };
}
