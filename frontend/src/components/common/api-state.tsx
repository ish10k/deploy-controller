import { AlertCircle, RefreshCcw, Server } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ApiRequestError } from "@/lib/api-client";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-[28px] font-bold tracking-normal text-slate-950">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm font-medium text-slate-600">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function LoadingPanel({ label = "Loading API data..." }: { label?: string }) {
  return (
    <Card>
      <CardContent className="flex h-44 items-center justify-center text-sm font-semibold text-slate-600">
        <LoadingSpinner label={label} />
      </CardContent>
    </Card>
  );
}

export function LoadingOverlay({
  label = "Loading...",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div className={cn("fixed bottom-0 right-0 top-[60px] left-[235px] z-20 flex items-center justify-center bg-slate-50", className)}>
      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 shadow-sm">
        <LoadingSpinner label={label} />
      </div>
    </div>
  );
}

export function useMinimumVisible(active: boolean, minimumMs = 350) {
  const startedAt = useRef(0);
  const timeoutRef = useRef<number | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (active) {
      startedAt.current = Date.now();
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setVisible(true);
      return;
    }

    if (!visible) {
      return;
    }

    const remaining = Math.max(0, minimumMs - (Date.now() - startedAt.current));
    timeoutRef.current = window.setTimeout(() => {
      setVisible(false);
      timeoutRef.current = null;
    }, remaining);
  }, [active, minimumMs, visible]);

  return visible;
}

export function useRefreshAction(
  active: boolean,
  refreshers: Array<() => Promise<unknown> | unknown>,
) {
  const refreshing = useMinimumVisible(active);
  const refresh = useCallback(async () => {
    await Promise.all(refreshers.map((refetch) => Promise.resolve(refetch())));
  }, [refreshers]);

  return { refresh, refreshing };
}

export function EmptyPanel({ label = "No records returned by the API." }: { label?: string }) {
  return (
    <div className="flex h-36 items-center justify-center rounded-lg px-4 text-sm font-semibold text-slate-500">{label}</div>
  );
}

export function ApiErrorPanel({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : "Unable to reach the ReleaseSet API.";
  const status = error instanceof ApiRequestError ? error.status : null;
  const isConnectionError = status === null;
  const title = status === 404 ? "Record not found" : status ? "API request failed" : "API connection needed";
  const panelClass = status === 404 ? "border-slate-200 bg-slate-50" : "border-orange-200 bg-orange-50";
  const iconClass = status === 404 ? "text-slate-600 ring-slate-200" : "text-orange-600 ring-orange-200";
  const textClass = status === 404 ? "text-slate-900" : "text-orange-900";

  return (
    <Card className={panelClass}>
      <CardContent className="grid gap-4 p-5">
        <div className="flex items-start gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white ring-1 ${iconClass}`}>
            <Server className="h-5 w-5" />
          </div>
          <div>
            <div className={`flex items-center gap-2 text-sm font-bold ${textClass}`}>
              <AlertCircle className="h-4 w-4" />
              {title}
            </div>
            <p className={`mt-1 text-sm ${textClass}`}>{message}</p>
            {isConnectionError ? (
              <p className="mt-3 text-sm text-orange-950">
                Start the backend with{" "}
                <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs">cd api; DEPLOYSET_BACKEND=memory uvicorn src.interfaces.fastapi.app:app --reload</code>{" "}
                or set <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs">VITE_API_TARGET</code> to a working API.
              </p>
            ) : null}
          </div>
        </div>
        {onRetry ? (
          <Button type="button" variant="outline" className="w-fit bg-white" onClick={onRetry}>
            <RefreshCcw className="h-4 w-4" />
            Retry
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function UnsupportedPage({ title }: { title: string }) {
  return (
    <>
      <PageHeader title={title} subtitle="This console area is visible for navigation, but the current API does not expose it yet." />
      <Card>
        <CardContent className="p-5 text-sm text-slate-700">
          No backend endpoint exists for this section in the current FastAPI surface. The UI is intentionally honest here instead
          of showing synthetic data.
        </CardContent>
      </Card>
    </>
  );
}

function LoadingSpinner({ label }: { label: string }) {
  return (
    <>
      <RefreshCcw className="h-4 w-4 animate-spin text-blue-600" />
      {label}
    </>
  );
}

