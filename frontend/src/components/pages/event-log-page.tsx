import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Filter, RefreshCcw } from "lucide-react";

import { ApiErrorPanel, EmptyPanel, LoadingPanel, PageHeader } from "@/components/common/api-state";
import { JsonDetail } from "@/components/common/json-detail";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SideDrawer } from "@/components/ui/side-drawer";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listEvents, queryKeys, type ApiEventLogEntry, type EventLogFilters } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";

type EventLogFilterDraft = Required<Pick<EventLogFilters, "actorPrincipalId" | "resourceType" | "resourceId" | "category" | "action" | "origin" | "from" | "to">>;

const EMPTY_FILTERS: EventLogFilterDraft = {
  actorPrincipalId: "",
  resourceType: "",
  resourceId: "",
  category: "",
  action: "",
  origin: "",
  from: "",
  to: "",
};

export function EventLogPage() {
  const [draft, setDraft] = useState<EventLogFilterDraft>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<EventLogFilterDraft>(EMPTY_FILTERS);
  const [selected, setSelected] = useState<ApiEventLogEntry | null>(null);
  const filters = useMemo<EventLogFilters>(() => ({ ...applied, limit: 100 }), [applied]);
  const query = useQuery({
    queryKey: queryKeys.events(filters),
    queryFn: () => listEvents(filters),
  });

  if (query.isLoading) {
    return <LoadingPanel label="Loading event log..." />;
  }
  if (query.error) {
    return <ApiErrorPanel error={query.error} onRetry={() => query.refetch()} />;
  }

  const events = query.data?.events ?? [];

  return (
    <>
      <PageHeader
        title="Audit"
        subtitle="Durable user, service, and system events."
        action={
          <Button type="button" variant="outline" onClick={() => query.refetch()}>
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </Button>
        }
      />

      <Card className="mb-4">
        <CardContent className="p-3">
          <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-8">
            <FilterInput label="Actor" value={draft.actorPrincipalId} onChange={(value) => setDraft((current) => ({ ...current, actorPrincipalId: value }))} />
            <FilterInput label="Resource type" value={draft.resourceType} onChange={(value) => setDraft((current) => ({ ...current, resourceType: value }))} />
            <FilterInput label="Resource ID" value={draft.resourceId} onChange={(value) => setDraft((current) => ({ ...current, resourceId: value }))} />
            <FilterInput label="Category" value={draft.category} onChange={(value) => setDraft((current) => ({ ...current, category: value }))} />
            <FilterInput label="Action" value={draft.action} onChange={(value) => setDraft((current) => ({ ...current, action: value }))} />
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Origin</label>
              <Select variant="light" value={draft.origin} onChange={(event) => setDraft((current) => ({ ...current, origin: event.target.value }))}>
                <option value="">Any</option>
                <option value="user">User</option>
                <option value="service">Service</option>
                <option value="system">System</option>
              </Select>
            </div>
            <FilterInput label="From" type="datetime-local" value={draft.from} onChange={(value) => setDraft((current) => ({ ...current, from: value }))} />
            <FilterInput label="To" type="datetime-local" value={draft.to} onChange={(value) => setDraft((current) => ({ ...current, to: value }))} />
          </div>
          <div className="mt-3 flex items-center gap-2">
            <Button type="button" onClick={() => setApplied(draft)}>
              <Filter className="h-4 w-4" />
              Apply filters
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDraft(EMPTY_FILTERS);
                setApplied(EMPTY_FILTERS);
              }}
            >
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      {events.length ? (
        <Card>
          <CardContent className="p-3">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Resource</TableHead>
                  <TableHead>Summary</TableHead>
                  <TableHead>Severity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((event) => (
                  <TableRow key={event.eventId} className="cursor-pointer hover:bg-slate-50" onClick={() => setSelected(event)}>
                    <TableCell>{formatDateTime(event.occurredAt)}</TableCell>
                    <TableCell className="font-mono text-[11px]">{event.actorPrincipalId}</TableCell>
                    <TableCell>
                      <div className="font-mono text-[11px] font-semibold text-slate-900">{event.action}</div>
                      <div className="text-[11px] text-slate-500">{event.category}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-semibold text-slate-900">{event.resourceType}</div>
                      <div className="font-mono text-[11px] text-slate-500">{event.resourceId}</div>
                    </TableCell>
                    <TableCell className="max-w-[420px] whitespace-normal text-sm">{event.summary}</TableCell>
                    <TableCell>
                      <SeverityBadge severity={event.severity} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <EmptyPanel label="No events match the current filters." />
      )}

      <EventDrawer event={selected} onClose={() => setSelected(null)} />
    </>
  );
}

function FilterInput({ label, type = "text", value, onChange }: { label: string; type?: string; value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</label>
      <Input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function SeverityBadge({ severity }: { severity: ApiEventLogEntry["severity"] }) {
  const variant = severity === "error" ? "red" : severity === "warning" ? "orange" : "blue";
  return <Badge variant={variant}>{severity}</Badge>;
}

function EventDrawer({ event, onClose }: { event: ApiEventLogEntry | null; onClose: () => void }) {
  return (
    <SideDrawer
      open={Boolean(event)}
      title={event?.action ?? "Event"}
      description={event ? `${formatDateTime(event.occurredAt)} by ${event.actorPrincipalId}` : undefined}
      maxWidth="max-w-[900px]"
      onClose={onClose}
    >
      {event ? (
        <div className="grid gap-4">
          <Card>
            <CardContent className="grid gap-3 p-4 text-sm">
              <div className="grid gap-3 md:grid-cols-2">
                <Detail label="Event ID" value={event.eventId} />
                <Detail label="Origin" value={event.origin} />
                <Detail label="Actor type" value={event.actorType} />
                <Detail label="Resource" value={`${event.resourceType}:${event.resourceId}`} />
                <Detail label="Correlation ID" value={event.correlationId ?? "-"} />
                <Detail label="Request ID" value={event.requestId ?? "-"} />
              </div>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Summary</div>
                <div className="mt-1 text-slate-900">{event.summary}</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3">
              {event.changes.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Field</TableHead>
                      <TableHead>Before</TableHead>
                      <TableHead>After</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {event.changes.map((change) => (
                      <TableRow key={change.field}>
                        <TableCell className="font-mono text-[11px]">{change.field}</TableCell>
                        <TableCell className="max-w-[320px] whitespace-normal font-mono text-[11px]">{formatValue(change.before)}</TableCell>
                        <TableCell className="max-w-[320px] whitespace-normal font-mono text-[11px]">{formatValue(change.after)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="px-3 py-8 text-center text-sm text-slate-500">No field-level changes recorded.</div>
              )}
            </CardContent>
          </Card>

          <JsonDetail title="Metadata" value={{ metadata: event.metadata, relatedResources: event.relatedResources }} />
        </div>
      ) : null}
    </SideDrawer>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 break-all font-mono text-xs text-slate-900">{value}</div>
    </div>
  );
}

function formatValue(value: unknown) {
  if (value === null || value === undefined) {
    return "-";
  }
  if (typeof value === "string") {
    return value;
  }
  return JSON.stringify(value);
}
