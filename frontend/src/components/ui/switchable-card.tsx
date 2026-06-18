import * as React from "react";
import { ChevronDown } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type SwitchableCardOption<TValue extends string = string> = {
  value: TValue;
  label: string;
};

type SwitchableCardProps<TValue extends string> = {
  value: TValue;
  options: SwitchableCardOption<TValue>[];
  children: React.ReactNode;
  ariaLabel: string;
  className?: string;
  contentClassName?: string;
  onChange: (value: TValue) => void;
};

export function SwitchableCard<TValue extends string>({
  value,
  options,
  children,
  ariaLabel,
  className,
  contentClassName,
  onChange,
}: SwitchableCardProps<TValue>) {
  const selected = options.find((option) => option.value === value) ?? options[0];

  return (
    <Card className={cn("flex min-h-0 flex-col overflow-hidden", className)}>
      <CardHeader>
        <CardTitle className="relative -ml-1 inline-flex min-w-0 items-center gap-1 rounded-md px-1 py-0.5 focus-within:ring-2 focus-within:ring-blue-200">
          <span className="pointer-events-none truncate">{selected?.label}</span>
          <ChevronDown className="pointer-events-none h-4 w-4 shrink-0 text-slate-500" />
          <select
            aria-label={ariaLabel}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            value={value}
            onChange={(event) => onChange(event.target.value as TValue)}
          >
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </CardTitle>
      </CardHeader>
      <CardContent className={contentClassName}>{children}</CardContent>
    </Card>
  );
}
