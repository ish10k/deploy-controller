import { CheckCircle2, X, AlertCircle, Info } from "lucide-react";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ToastVariant = "default" | "success" | "error" | "info";

type ToastInput = {
  title: string;
  description?: string;
  variant?: ToastVariant;
};

type ToastRecord = ToastInput & {
  id: string;
};

type ToastContextValue = {
  toast: (input: ToastInput) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);

  useEffect(() => {
    if (!toasts.length) {
      return;
    }

    const timers = toasts.map((entry) =>
      window.setTimeout(() => {
        setToasts((current) => current.filter((toast) => toast.id !== entry.id));
      }, 4500),
    );

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [toasts]);

  const value = useMemo<ToastContextValue>(
    () => ({
      toast: (input) => {
        const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
        setToasts((current) => [...current, { id, variant: "default", ...input }]);
      },
    }),
    [],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-4 right-4 z-[70] grid gap-3">
        {toasts.map((toast) => (
          <ToastCard
            key={toast.id}
            title={toast.title}
            description={toast.description}
            variant={toast.variant ?? "default"}
            onDismiss={() => setToasts((current) => current.filter((entry) => entry.id !== toast.id))}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const value = useContext(ToastContext);
  if (!value) {
    throw new Error("useToast must be used inside ToastProvider");
  }
  return value.toast;
}

function ToastCard({
  title,
  description,
  variant,
  onDismiss,
}: {
  title: string;
  description?: string;
  variant: ToastVariant;
  onDismiss: () => void;
}) {
  const styles = {
    default: "border-slate-200 bg-white text-slate-950",
    success: "border-emerald-200 bg-emerald-50 text-emerald-950",
    error: "border-red-200 bg-red-50 text-red-950",
    info: "border-blue-200 bg-blue-50 text-blue-950",
  };
  const Icon = variant === "success" ? CheckCircle2 : variant === "error" ? AlertCircle : Info;

  return (
    <div className={cn("w-[360px] rounded-lg border p-4 shadow-lg", styles[variant])}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold">{title}</div>
          {description ? <div className="mt-1 text-sm leading-5 opacity-90">{description}</div> : null}
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onDismiss} aria-label="Dismiss toast">
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
