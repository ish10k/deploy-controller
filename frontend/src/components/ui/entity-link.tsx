import { Link, type LinkProps } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { ENTITY_ICONS, type EntityIconKind } from "@/lib/entity-icons";
import { cn } from "@/lib/utils";

type EntityLinkProps = Omit<LinkProps, "children"> & {
  kind: EntityIconKind;
  children: ReactNode;
  className?: string;
};

export function EntityLink({ kind, children, className, ...props }: EntityLinkProps) {
  const Icon = ENTITY_ICONS[kind];

  return (
    <Link
      className={cn("inline-flex items-center gap-1.5 font-semibold text-blue-700 hover:text-blue-800", className)}
      {...props}
    >
      <Icon className="h-4 w-4 shrink-0 text-blue-700" />
      <span className="min-w-0 truncate">{children}</span>
    </Link>
  );
}
