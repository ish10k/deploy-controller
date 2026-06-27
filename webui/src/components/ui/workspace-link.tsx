import { Link, useRouterState, type LinkProps } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { workspaceIdFromPath, workspaceRoutePath } from "@/lib/workspace-routes";

type WorkspaceLinkProps = {
  to: string;
  params?: Record<string, unknown>;
  children?: ReactNode;
  [key: string]: unknown;
};

export function WorkspaceLink({ to, params, children, ...props }: WorkspaceLinkProps) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const workspaceId = workspaceIdFromPath(pathname);
  const nextTo =
    workspaceId && typeof to === "string" && to.startsWith("/") && !to.startsWith("/workspaces/")
      ? workspaceRoutePath(to)
      : to;
  const nextParams =
    workspaceId && typeof to === "string" && to.startsWith("/") && !to.startsWith("/workspaces/")
      ? { ...(typeof params === "object" && params ? params : {}), workspaceId }
      : params;

  return <Link {...({ ...props, to: nextTo, params: nextParams } as LinkProps)}>{children}</Link>;
}

