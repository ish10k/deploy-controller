import { useNavigate, useRouterState } from "@tanstack/react-router";

import { workspaceIdFromPath, workspaceRoutePath } from "@/lib/workspace-routes";

export function useWorkspaceNavigate() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const workspaceId = workspaceIdFromPath(pathname);

  return (options: {
    to?: string;
    params?: Record<string, unknown>;
    [key: string]: unknown;
  }) => {
    const nextTo =
      workspaceId &&
      typeof options.to === "string" &&
      options.to.startsWith("/") &&
      !options.to.startsWith("/workspaces/")
        ? workspaceRoutePath(options.to)
        : options.to;
    const nextParams =
      workspaceId &&
      typeof options.to === "string" &&
      options.to.startsWith("/") &&
      !options.to.startsWith("/workspaces/")
      ? { ...(typeof options.params === "object" && options.params ? options.params : {}), workspaceId }
      : options.params;

    return navigate({ ...options, to: nextTo, params: nextParams } as Parameters<typeof navigate>[0]);
  };
}

