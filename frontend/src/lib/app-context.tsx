import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { listEnvironments, queryKeys, setActiveWorkspaceId, type ApiEnvironment } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";

type WorkspaceSummary = {
  workspaceId: string;
  organizationId: string;
  displayName: string;
  roles: string[];
};

type AppContextValue = {
  environmentId: string;
  environments: ApiEnvironment[];
  environmentsLoading: boolean;
  setEnvironmentId: (environmentId: string) => void;
  workspaceId: string;
  workspace: WorkspaceSummary | null;
  workspaces: WorkspaceSummary[];
  setWorkspaceId: (workspaceId: string) => void;
};

const AppContext = createContext<AppContextValue | null>(null);
const selectedWorkspaceStorageKey = "settle.selectedWorkspaceId";

function readSelectedWorkspaceId() {
  if (typeof window === "undefined") {
    return "";
  }
  return window.localStorage.getItem(selectedWorkspaceStorageKey) ?? "";
}

function writeSelectedWorkspaceId(workspaceId: string) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(selectedWorkspaceStorageKey, workspaceId);
}

function clearSelectedWorkspaceId() {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(selectedWorkspaceStorageKey);
}

export function AppProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const [environmentId, setEnvironmentId] = useState("");
  const [workspaceId, setWorkspaceIdState] = useState(readSelectedWorkspaceId);
  const workspaces = useMemo<WorkspaceSummary[]>(() => {
    if (auth.user?.workspaces?.length) {
      return auth.user.workspaces.map((workspace) => ({ ...workspace, roles: workspace.roles ?? [] }));
    }
    return [];
  }, [auth.user]);
  const workspace = workspaces.find((candidate) => candidate.workspaceId === workspaceId) ?? workspaces[0] ?? null;
  setActiveWorkspaceId(workspace?.workspaceId ?? null);
  const environmentsQuery = useQuery({
    queryKey: [...queryKeys.environments, workspace?.workspaceId ?? "none"] as const,
    queryFn: listEnvironments,
    enabled: auth.status === "authenticated" && Boolean(workspace),
  });
  const environments = environmentsQuery.data ?? [];

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

  useEffect(() => {
    if (!workspaces.length) {
      if (workspaceId) {
        setWorkspaceIdState("");
        clearSelectedWorkspaceId();
      }
      return;
    }

    if (!workspaceId || !workspaces.some((candidate) => candidate.workspaceId === workspaceId)) {
      const nextWorkspaceId = workspaces[0].workspaceId;
      setWorkspaceIdState(nextWorkspaceId);
      writeSelectedWorkspaceId(nextWorkspaceId);
    }
  }, [workspaceId, workspaces]);

  const setWorkspaceId = useCallback(
    (nextWorkspaceId: string) => {
      setActiveWorkspaceId(nextWorkspaceId);
      setWorkspaceIdState(nextWorkspaceId);
      setEnvironmentId("");
      writeSelectedWorkspaceId(nextWorkspaceId);
      queryClient.removeQueries({ queryKey: ["workspace"] });
    },
    [queryClient],
  );

  const value = useMemo(
    () => ({
      environmentId,
      environments,
      environmentsLoading: environmentsQuery.isLoading,
      setEnvironmentId,
      workspaceId: workspace?.workspaceId ?? workspaceId,
      workspace,
      workspaces,
      setWorkspaceId,
    }),
    [environmentId, environments, environmentsQuery.isLoading, setWorkspaceId, workspace, workspaceId, workspaces],
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

