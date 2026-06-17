import { AlertCircle, RefreshCcw, Server } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

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
        <RefreshCcw className="mr-2 h-4 w-4 animate-spin text-blue-600" />
        {label}
      </CardContent>
    </Card>
  );
}

export function EmptyPanel({ label = "No records returned by the API." }: { label?: string }) {
  return (
    <Card>
      <CardContent className="flex h-36 items-center justify-center text-sm font-semibold text-slate-500">{label}</CardContent>
    </Card>
  );
}

export function ApiErrorPanel({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : "Unable to reach the DeploySet API.";

  return (
    <Card className="border-orange-200 bg-orange-50">
      <CardContent className="grid gap-4 p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-orange-600 ring-1 ring-orange-200">
            <Server className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 text-sm font-bold text-orange-900">
              <AlertCircle className="h-4 w-4" />
              API connection needed
            </div>
            <p className="mt-1 text-sm text-orange-900">{message}</p>
            <p className="mt-3 text-sm text-orange-950">
              Start the backend with{" "}
              <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs">cd api; DEPLOYSET_BACKEND=memory uvicorn src.interfaces.fastapi.app:app --reload</code>{" "}
              or set <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs">VITE_API_TARGET</code> to a working API.
            </p>
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
