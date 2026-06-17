import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

import { listEnvironments, queryKeys, type ApiEnvironment } from "@/lib/api-client";

type AppContextValue = {
  environmentId: string;
  environments: ApiEnvironment[];
  environmentsLoading: boolean;
  setEnvironmentId: (environmentId: string) => void;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const environmentsQuery = useQuery({
    queryKey: queryKeys.environments,
    queryFn: listEnvironments,
  });
  const environments = environmentsQuery.data ?? [];
  const [environmentId, setEnvironmentId] = useState("");

  useEffect(() => {
    if (!environments.length) {
      if (environmentId) {
        setEnvironmentId("");
      }
      return;
    }

    if (!environmentId || !environments.some((environment) => environment.environmentId === environmentId)) {
      setEnvironmentId(environments[0].environmentId);
    }
  }, [environmentId, environments]);

  const value = useMemo(
    () => ({
      environmentId,
      environments,
      environmentsLoading: environmentsQuery.isLoading,
      setEnvironmentId,
    }),
    [environmentId, environments, environmentsQuery.isLoading],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const value = useContext(AppContext);
  if (!value) {
    throw new Error("useAppContext must be used inside AppProvider");
  }
  return value;
}
