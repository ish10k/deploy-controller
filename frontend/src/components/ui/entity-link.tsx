import { Link, useRouterState, type LinkProps } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { ENTITY_ICONS, type EntityIconKind } from "@/lib/entity-icons";
import { cn } from "@/lib/utils";
import { workspaceIdFromPath, workspaceRoutePath } from "@/lib/workspace-routes";

type EntityLinkProps = Omit<LinkProps, "children"> & {
  kind: EntityIconKind;
  children: ReactNode;
  className?: string;
};

export function EntityLink({ kind, children, className, ...props }: EntityLinkProps) {
  const Icon = ENTITY_ICONS[kind];
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const workspaceId = workspaceIdFromPath(pathname);
  const nextProps = {
    ...props,
    to: workspaceId && typeof props.to === "string" && props.to.startsWith("/") && !props.to.startsWith("/workspaces/") ? workspaceRoutePath(props.to) : props.to,
    params:
      workspaceId && typeof props.to === "string" && props.to.startsWith("/") && !props.to.startsWith("/workspaces/")
        ? { ...(typeof props.params === "object" && props.params ? props.params : {}), workspaceId }
        : props.params,
  } as LinkProps;

  return (
    <Link
      className={cn("inline-flex items-center gap-1.5 font-semibold text-blue-700 hover:text-blue-800 hover:underline", className)}
      {...nextProps}
    >
      <Icon className="h-4 w-4 shrink-0 text-blue-700" />
      <span className="min-w-0 truncate">{children}</span>
    </Link>
  );
}
