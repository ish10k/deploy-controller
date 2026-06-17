import * as React from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

export function Select({
  className,
  children,
  variant = "dark",
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { variant?: "dark" | "light" }) {
  return (
    <div className={cn("relative", className)}>
      <select
        className={cn(
          "h-10 w-full appearance-none rounded-lg px-3 py-1 pr-9 text-sm outline-none transition focus:ring-2 focus:ring-blue-200",
          variant === "dark"
            ? "border border-white/10 bg-slate-950/20 text-white ring-1 ring-white/10 focus:ring-blue-400"
            : "border border-input bg-white text-slate-950 shadow-sm",
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className={cn(
          "pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2",
          variant === "dark" ? "text-slate-300" : "text-slate-500",
        )}
      />
    </div>
  );
}
