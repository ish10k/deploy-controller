import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex h-5 items-center gap-1 rounded px-1.5 text-[11px] font-bold leading-none ring-1 ring-inset",
  {
    variants: {
      variant: {
        blue: "bg-blue-50 text-blue-700 ring-blue-200",
        green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
        red: "bg-red-50 text-red-700 ring-red-200",
        orange: "bg-orange-50 text-orange-700 ring-orange-200",
        slate: "bg-slate-100 text-slate-700 ring-slate-200",
      },
    },
    defaultVariants: {
      variant: "slate",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, className }))} {...props} />;
}
