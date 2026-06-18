import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Filter,
  Globe2,
  Hourglass,
  MoreHorizontal,
  Plus,
  RefreshCcw,
  Rocket,
  Server,
  SlidersHorizontal,
} from "lucide-react";

import { ApiErrorPanel, EmptyPanel, LoadingPanel, PageHeader } from "@/components/common/api-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EntityLink } from "@/components/ui/entity-link";
import { type EntityIconKind } from "@/lib/entity-icons";
import { Input } from "@/components/ui/input";
import { RequiredMark } from "@/components/ui/required-mark";
import { ScrollFade } from "@/components/ui/scroll-fade";
import { Select } from "@/components/ui/select";
import { SideDrawer } from "@/components/ui/side-drawer";
import { TagsCard, createTagDraft, tagsToRecord, validateTagDrafts, type TagDraft } from "@/components/ui/tags-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  fetchEnvironmentCenterData,
  putEnvironment,
  queryKeys,
  type ApiComponentSet,
  type ApiDeploySet,
  type ApiDeploymentExecution,
  type ApiEnvironment,
  type ApiEnvironmentState,
} from "@/lib/api-client";
import { formatDateTime, tagSummary } from "@/lib/format";
import { cn } from "@/lib/utils";

type EnvironmentStatusKind = "healthy" | "failed" | "pending" | "idle";

type EnvironmentRow = {
  environment: ApiEnvironment;
  state?: ApiEnvironmentState;
  currentDeploySet?: ApiDeploySet;
  currentComponentSet?: ApiComponentSet;
  latestExecution?: ApiDeploymentExecution;
  recentExecutions: ApiDeploymentExecution[];
  pendingExecutions: ApiDeploymentExecution[];
  status: EnvironmentStatusKind;
  updatedAt?: string | null;
};

export function EnvironmentsPage({ routeEnvironmentId }: { routeEnvironmentId?: string }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | EnvironmentStatusKind>("all");
  const [open, setOpen] = useState(false);
  const query = useQuery({
    queryKey: queryKeys.environmentCenter,
    queryFn: fetchEnvironmentCenterData,
    retry: 1,
  });
  const mutation = useMutation({
    mutationFn: (environment: ApiEnvironment) => putEnvironment(environment.environmentId, environment),
    onSuccess: async (environment) => {
      setOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.environments }),
        queryClient.invalidateQueries({ queryKey: queryKeys.environmentCenter }),
      ]);
    },
  });

  const rows = useMemo(() => {
    if (!query.data) {
      return [];
    }
    return buildEnvironmentRows(query.data);
  }, [query.data]);

  const filteredRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter((row) => {
      const searchable = [
        row.environment.environmentId,
        row.currentDeploySet?.deploySetId,
        row.currentComponentSet?.componentSetId,
        row.latestExecution?.claimedBy,
        tagSummary(row.environment.tags),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const matchesSearch = !needle || searchable.includes(needle);
      const matchesStatus = statusFilter === "all" || row.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [rows, search, statusFilter]);

  const metrics = useMemo(() => {
    return {
      total: rows.length,
      healthy: rows.filter((row) => row.status === "healthy").length,
      failed: rows.filter((row) => row.status === "failed").length,
      pending: rows.filter((row) => row.status === "pending").length,
    };
  }, [rows]);

  if (query.isLoading) return <LoadingPanel label="Loading environments..." />;
  if (query.error) return <ApiErrorPanel error={query.error} onRetry={() => query.refetch()} />;
  if (!query.data) return <EmptyPanel />;

  if (routeEnvironmentId) {
    const routeRow = rows.find((row) => row.environment.environmentId === routeEnvironmentId);
    return routeRow ? <FocusedEnvironmentDetails row={routeRow} /> : <EnvironmentNotFound environmentId={routeEnvironmentId} />;
  }

  return (
    <>
      <PageHeader
        title="Environments"
        subtitle="Manage runtime targets and current desired state across environments."
        action={
          <Button className="h-10 px-4" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" />
            Create environment
          </Button>
        }
      />

      {/* <div className="grid grid-cols-4 gap-4">
        <MetricCard icon={Globe2} tone="blue" label="Total Environments" value={metrics.total}/>
        <MetricCard icon={CheckCircle2} tone="green" label="Healthy" value={metrics.healthy} />
        <MetricCard icon={AlertTriangle} tone="red" label="Failed" value={metrics.failed} />
        <MetricCard icon={Hourglass} tone="orange" label="Pending" value={metrics.pending} />
      </div> */}

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="flex flex-1 items-center gap-3">
          <div className="flex h-10 w-[290px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 shadow-sm">
            <Filter className="h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search environments..."
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
            />
          </div>
          <Select variant="light" className="w-[150px]" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}>
            <option value="all">Status: All</option>
            <option value="healthy">Healthy</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
            <option value="idle">Idle</option>
          </Select>
          <Button variant="outline">
            <Filter className="h-4 w-4" />
            More filters
          </Button>
        </div>
        <Button variant="outline" onClick={() => query.refetch()}>
          <RefreshCcw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {filteredRows.length ? (
        <div className="mt-5 grid grid-cols-3 gap-5">
          {filteredRows.map((row) => (
            <EnvironmentCard key={row.environment.environmentId} row={row} />
          ))}
        </div>
      ) : (
        <div className="mt-4">
          <EmptyPanel label="No environments match the current filters." />
        </div>
      )}
      <div className="mt-3 text-xs font-medium text-slate-500">
        Showing {filteredRows.length} of {rows.length} environments
      </div>
      <EnvironmentDrawer open={open} onClose={() => setOpen(false)} onSubmit={(value) => mutation.mutate(value)} pending={mutation.isPending} />
    </>
  );
}

function FocusedEnvironmentDetails({ row }: { row: EnvironmentRow }) {
  const latest = row.latestExecution;
  const activities = buildActivities(row);
  const driftCount = latest?.items.filter((item) => item.driftDetected).length ?? 0;

  return (
    <div className="flex h-[calc(100vh-108px)] min-h-0 flex-col overflow-hidden">
      <PageHeader
        title={row.environment.environmentId}
        subtitle="Environment details, current desired state, and recent activity."
        action={
          <div className="flex gap-2">
            <Link to="/environments">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4" />
                Back to environments
              </Button>
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-4 gap-4">
        <EnvironmentFactCard icon={Globe2} label="Status" value={<EnvironmentStatusBadge status={row.status} />} sublabel={row.environment.active ? "Active target" : "Inactive target"} />
        {row.currentDeploySet ? (
          <Link
            to="/deploysets/$deploySetId"
            params={{ deploySetId: row.currentDeploySet.deploySetId }}
            className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <EnvironmentFactCard
              icon={Server}
              label="Current DeploySet"
              value={row.currentDeploySet.deploySetId}
              sublabel={`Version ${row.currentDeploySet.schemaVersion}`}
              interactive
            />
          </Link>
        ) : (
          <EnvironmentFactCard icon={Server} label="Current DeploySet" value="None" sublabel="No environment state" />
        )}
        <EnvironmentFactCard icon={Hourglass} label="Pending Executions" value={String(row.pendingExecutions.length)} sublabel="Awaiting runner work" />
        <EnvironmentFactCard icon={AlertTriangle} label="Drift Signals" value={String(driftCount)} sublabel="From latest execution" />
      </div>

      <EnvironmentDetailsPanel row={row} focused />

      <div className="mt-4 grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_420px] gap-4">
        <Card className="flex min-h-0 flex-col overflow-hidden">
          <CardHeader>
            <CardTitle>Recent deployments</CardTitle>
            <Link to="/executions" className="text-sm font-bold text-blue-600">
              View deployments
            </Link>
          </CardHeader>
          <CardContent className="min-h-0 flex-1 overflow-hidden p-0">
            {row.recentExecutions.length ? (
              <ScrollFade className="h-full" contentClassName="px-4 pb-4">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-white">
                    <TableRow>
                      <TableHead>Execution</TableHead>
                      <TableHead>DeploySet</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Started</TableHead>
                      <TableHead>Items</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {row.recentExecutions.slice(0, 8).map((execution) => (
                      <TableRow key={execution.deploymentExecutionId}>
                        <TableCell className="font-semibold">
                          <EntityLink
                            kind="deployment"
                            to="/deployments/$deploymentExecutionId"
                            params={{ deploymentExecutionId: execution.deploymentExecutionId }}
                          >
                            {execution.deploymentExecutionId}
                          </EntityLink>
                        </TableCell>
                        <TableCell>
                          <EntityLink kind="deployset" to="/deploysets/$deploySetId" params={{ deploySetId: execution.deploySetId }}>
                            {execution.deploySetId}
                          </EntityLink>
                        </TableCell>
                        <TableCell>
                          <Badge variant={execution.status === "failed" ? "red" : execution.status === "succeeded" ? "green" : "slate"}>{execution.status}</Badge>
                        </TableCell>
                        <TableCell>{formatDateTime(execution.startedAt)}</TableCell>
                        <TableCell>{execution.items.length}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollFade>
            ) : (
              <div className="p-4">
                <EmptyPanel label="No recent deployments found for this environment." />
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="flex min-h-0 flex-col overflow-hidden">
          <CardHeader>
            <CardTitle>Event log</CardTitle>
            <Link to="/executions" className="text-sm font-bold text-blue-600">
              View events
            </Link>
          </CardHeader>
          <CardContent className="min-h-0 flex-1 overflow-hidden p-0">
            {activities.length ? (
              <ScrollFade className="h-full" contentClassName="px-4 pb-4">
              <div className="divide-y divide-slate-200">
                {activities.map((activity) => (
                  <div key={activity.id} className="flex items-center gap-3 py-2 text-sm">
                    <activity.icon className={cn("h-4 w-4 shrink-0", activity.tone)} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold text-slate-800">{activity.title}</div>
                      <div className="truncate text-xs text-slate-500">{activity.subtitle}</div>
                    </div>
                    <div className="shrink-0 text-xs text-slate-500">{formatDateTime(activity.time)}</div>
                  </div>
                ))}
              </div>
              </ScrollFade>
            ) : (
              <div className="p-4">
                <EmptyPanel label="No environment events found." />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function EnvironmentNotFound({ environmentId }: { environmentId: string }) {
  return (
    <>
      <PageHeader
        title="Environment not found"
        subtitle={`No environment was returned by the API for ${environmentId}.`}
        action={
          <Link to="/environments">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4" />
              Back to environments
            </Button>
          </Link>
        }
      />
      <EmptyPanel label="Choose an environment from the environments list." />
    </>
  );
}

function EnvironmentCard({ row }: { row: EnvironmentRow }) {
  return (
    <Link
      to="/environments/$environmentId"
      params={{ environmentId: row.environment.environmentId }}
      className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
    >
    <Card className="min-h-[258px] cursor-pointer transition-colors hover:border-blue-300 hover:bg-blue-50/40 hover:shadow-md">
      <CardContent className="flex h-full flex-col p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-700">
              <Server className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate text-2xl font-bold text-slate-950">{row.environment.environmentId}</span>
                <EnvironmentStatusBadge status={row.status} />
              </div>
            </div>
          </div>
          <MoreHorizontal className="h-5 w-5 text-blue-700" />
        </div>

        <div className="grid gap-0 text-sm">
          <CardDetailRow label="Current DeploySet" value={<CardValue value={row.currentDeploySet?.deploySetId} />} />
          <CardDetailRow label="Last Execution" value={<CardValue value={row.latestExecution?.deploymentExecutionId} />} />
          <CardDetailRow label="Last Deployment" value={<span className="font-medium text-slate-800">{row.latestExecution ? formatDateTime(row.latestExecution.startedAt) : "-"}</span>} />
        </div>

        <div className="mt-auto pt-4">
          <TagList tags={row.environment.tags} />
        </div>
      </CardContent>
    </Card>
    </Link>
  );
}

function CardValue({ value }: { value?: string | null }) {
  return <span className="font-semibold text-slate-800">{value ?? "-"}</span>;
}

function CardDetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[150px_1fr] items-center border-b border-slate-200 py-2 last:border-b-0">
      <span className="font-medium text-slate-600">{label}</span>
      <span className="min-w-0 truncate text-right">{value}</span>
    </div>
  );
}

function EnvironmentDetailsPanel({ row, focused = false }: { row: EnvironmentRow; focused?: boolean }) {
  const latest = row.latestExecution;
  const activities = buildActivities(row);

  return (
    <Card className="mt-4">

      <CardContent className="grid grid-cols-[1fr_1fr] gap-5 p-4">
        <div>
          <div className="grid grid-cols-[180px_1fr_auto] gap-x-3 gap-y-3 text-sm">
            <DetailLabel icon={Server} label="Current DeploySet" />
            <ResourceLink label={row.currentDeploySet?.deploySetId} to="/deploysets/$deploySetId" params={row.currentDeploySet ? { deploySetId: row.currentDeploySet.deploySetId } : undefined} />
            <SmallLink to="/deploysets" label="View details" />
            <DetailLabel icon={SlidersHorizontal} label="Current ConfigSet" />
            <ResourceLink
              label={row.currentComponentSet?.componentSetId}
              to="/component-sets/$componentSetId"
              params={row.currentComponentSet ? { componentSetId: row.currentComponentSet.componentSetId } : undefined}
            />
            {row.currentComponentSet ? (
              <SmallLink to="/component-sets/$componentSetId" params={{ componentSetId: row.currentComponentSet.componentSetId }} label="View details" />
            ) : (
              <SmallLink to="/component-sets" label="View sets" />
            )}
            <DetailLabel icon={Activity} label="Last Deployment" />
            <span className="flex items-center gap-2">
              {latest ? <EnvironmentStatusBadge status={executionToEnvironmentStatus(latest.status)} /> : <Badge>No execution</Badge>}
              <span className="text-slate-600">{formatDateTime(latest?.startedAt)}</span>
            </span>
            <SmallLink to="/executions" label="View execution" />
            <DetailLabel icon={Server} label="Deployment Runner" />
            <span className="font-medium text-blue-700">{latest?.claimedBy ?? "unclaimed"}</span>
            <SmallLink to="/deployment-runners" label="View queue" />
            <DetailLabel icon={Clock3} label="Updated" />
            <span className="text-slate-700">{formatDateTime(row.updatedAt)}</span>
            <span />
            <DetailLabel icon={Filter} label="Tags" />
            <TagList tags={row.environment.tags} />
            <span />
          </div>
        </div>
        <div className="border-l border-slate-200 pl-5">
          <div className="mb-3 flex items-center justify-between">
            <CardTitle>Recent activity</CardTitle>
            <Link to="/executions" className="text-sm font-bold text-blue-600">
              View all events
            </Link>
          </div>
          <div className="divide-y divide-slate-200">
            {activities.length ? (
              activities.map((activity) => (
                <div key={activity.id} className="flex items-center gap-3 py-2">
                  <activity.icon className={cn("h-4 w-4", activity.tone)} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-slate-800">{activity.title}</div>
                    <div className="truncate text-xs text-slate-500">{activity.subtitle}</div>
                  </div>
                  <div className="text-xs text-slate-500">{formatDateTime(activity.time)}</div>
                </div>
              ))
            ) : (
              <div className="py-6 text-sm text-slate-500">No recent execution activity for this environment.</div>
            )}
          </div>
          <Link to="/executions" className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-blue-600">
            View full activity for {row.environment.environmentId} <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function EnvironmentFactCard({
  icon: Icon,
  label,
  value,
  sublabel,
  interactive = false,
}: {
  icon: typeof Globe2;
  label: string;
  value: ReactNode;
  sublabel: string;
  interactive?: boolean;
}) {
  return (
    <Card className={`h-[116px] ${interactive ? "transition-colors hover:border-blue-300 hover:bg-blue-50/40 hover:shadow-md" : ""}`}>
      <CardContent className="flex h-full items-center gap-4 p-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
          <Icon className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-bold text-slate-950">{label}</div>
          <div className="mt-1 truncate text-xl font-bold text-blue-700">{value}</div>
          <div className="mt-1 truncate text-sm text-slate-600">{sublabel}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function MetricCard({
  icon: Icon,
  tone,
  label,
  value,
  sublabel,
}: {
  icon: typeof Globe2;
  tone: "blue" | "green" | "red" | "orange";
  label: string;
  value: number;
  sublabel?: string;
}) {
  const tones = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-emerald-50 text-emerald-600",
    red: "bg-red-50 text-red-600",
    orange: "bg-orange-50 text-orange-500",
  };
  const text = {
    blue: "text-blue-700",
    green: "text-emerald-700",
    red: "text-red-700",
    orange: "text-orange-600",
  };

  return (
    <Card className="h-[116px]">
      <CardContent className="flex h-full items-center gap-4 p-4">
        <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-full", tones[tone])}>
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <div className="text-sm font-bold text-slate-950">{label}</div>
          <div className={cn("mt-1 text-2xl font-bold", text[tone])}>{value}</div>
          <div className="mt-1 text-sm text-slate-600">{sublabel}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function EnvironmentStatusBadge({ status }: { status: EnvironmentStatusKind }) {
  if (status === "healthy") {
    return (
      <Badge variant="green">
        <CheckCircle2 className="h-3 w-3" /> Healthy
      </Badge>
    );
  }
  if (status === "failed") {
    return (
      <Badge variant="red">
        <AlertTriangle className="h-3 w-3" /> Failed
      </Badge>
    );
  }
  if (status === "pending") {
    return (
      <Badge variant="blue">
        <Hourglass className="h-3 w-3" /> Applying
      </Badge>
    );
  }
  return <Badge variant="slate">Idle</Badge>;
}

function ResourceLink({
  label,
  to,
  params,
}: {
  label?: string | null;
  to: "/deploysets" | "/component-sets" | "/deploysets/$deploySetId" | "/component-sets/$componentSetId";
  params?: { deploySetId: string } | { componentSetId: string };
}) {
  if (!label) {
    return <span className="text-slate-500">-</span>;
  }
  const kind: EntityIconKind = to.includes("component-sets") ? "componentSet" : "deployset";
  return (
    <EntityLink kind={kind} to={to} params={params}>
      {label}
    </EntityLink>
  );
}

function SmallLink({
  to,
  params,
  label,
}: {
  to: "/deploysets" | "/component-sets" | "/component-sets/$componentSetId" | "/executions" | "/deployment-runners";
  params?: { componentSetId: string };
  label: string;
}) {
  return (
    <Link to={to} params={params} className="text-xs font-bold text-blue-600">
      {label}
    </Link>
  );
}

function DetailLabel({ icon: Icon, label }: { icon: typeof Server; label: string }) {
  return (
    <span className="flex items-center gap-2 font-semibold text-slate-700">
      <Icon className="h-4 w-4 text-slate-500" />
      {label}
    </span>
  );
}

function TagList({ tags, limit }: { tags?: Record<string, string>; limit?: number }) {
  const entries = Object.entries(tags ?? {});
  if (!entries.length) {
    return <span className="text-slate-500">-</span>;
  }
  const visible = limit ? entries.slice(0, limit) : entries;
  const hidden = limit ? entries.length - visible.length : 0;

  return (
    <span className="flex flex-wrap gap-1.5">
      {visible.map(([key, value]) => (
        <Badge key={key} variant={value === "critical" ? "red" : value === "prod" ? "blue" : "slate"}>
          {value || key}
        </Badge>
      ))}
      {hidden > 0 ? <Badge variant="slate">+{hidden}</Badge> : null}
    </span>
  );
}

function EnvironmentDrawer({
  open,
  onClose,
  onSubmit,
  pending,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (value: ApiEnvironment) => void;
  pending: boolean;
}) {
  const [environmentId, setEnvironmentId] = useState("");
  const [active, setActive] = useState(true);
  const [tags, setTags] = useState<TagDraft[]>([createTagDraft()]);
  const trimmedEnvironmentId = environmentId.trim();
  const tagsError = validateTagDrafts(tags);

  const updateTag = (id: string, patch: Partial<Omit<TagDraft, "id">>) => {
    setTags((current) => current.map((tag) => (tag.id === id ? { ...tag, ...patch } : tag)));
  };

  return (
    <SideDrawer
      open={open}
      title="Create environment"
      description="Add a runtime target that can receive deploy sets and report desired-state progress."
      onClose={onClose}
      footer={
        <>
          <p className="text-xs text-slate-500">New environments start without a current deploy set until one is applied.</p>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button disabled={pending || !trimmedEnvironmentId || Boolean(tagsError)} onClick={() => onSubmit({ environmentId: trimmedEnvironmentId, active, tags: tagsToRecord(tags) })}>
              {pending ? "Creating..." : "Create environment"}
            </Button>
          </div>
        </>
      }
    >
      <div className="space-y-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">Environment identity</h3>
          <p className="mt-1 text-sm text-slate-500">Use a short, stable ID such as prod, staging, qa, or a regional target.</p>
          <label className="mt-4 block text-sm font-medium text-slate-700">
            Environment ID
            <RequiredMark />
            <Input className="mt-1" value={environmentId} onChange={(event) => setEnvironmentId(event.target.value)} placeholder="staging" />
          </label>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <label className="flex items-start gap-3 text-sm text-slate-600">
            <input className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600" type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />
            <span>
              <span className="block font-medium text-slate-800">Active deployment target</span>
              <span>Active environments can receive new deployment executions.</span>
            </span>
          </label>
        </section>
        <TagsCard
          tags={tags}
          error={tagsError}
          onAdd={() => setTags((current) => [...current, createTagDraft()])}
          onChange={updateTag}
          onRemove={(id) => setTags((current) => current.filter((tag) => tag.id !== id))}
        />
        <section className="rounded-2xl border border-blue-100 bg-blue-50/70 p-5">
          <h3 className="text-sm font-semibold text-blue-950">What happens next?</h3>
          <p className="mt-1 text-sm text-blue-800">
            Once created, the environment appears in the environment center. Applying a deploy set will populate current desired state and recent deployment activity.
          </p>
        </section>
      </div>
    </SideDrawer>
  );
}

function buildEnvironmentRows(data: Awaited<ReturnType<typeof fetchEnvironmentCenterData>>): EnvironmentRow[] {
  const stateByEnvironment = new Map(data.environmentState.map((state) => [state.environmentId, state]));
  const deploysetById = new Map(data.deploysets.map((deployset) => [deployset.deploySetId, deployset]));
  const componentSetById = new Map(data.componentSets.map((componentSet) => [componentSet.componentSetId, componentSet]));
  const executionsByEnvironment = groupExecutionsByEnvironment(data.executions);
  const pendingByEnvironment = groupExecutionsByEnvironment(data.pendingExecutions);

  return data.environments.map((environment) => {
    const state = stateByEnvironment.get(environment.environmentId);
    const currentDeploySet = state?.deploySetId ? deploysetById.get(state.deploySetId) : undefined;
    const currentComponentSet = currentDeploySet ? componentSetById.get(currentDeploySet.componentSetId) : undefined;
    const regularExecutions = executionsByEnvironment.get(environment.environmentId) ?? [];
    const pendingExecutions = pendingByEnvironment.get(environment.environmentId) ?? [];
    const latestExecution = regularExecutions[0];
    const recentExecutions = dedupeExecutions([...regularExecutions, ...pendingExecutions]);
    return {
      environment,
      state,
      currentDeploySet,
      currentComponentSet,
      latestExecution,
      recentExecutions,
      pendingExecutions,
      status: deriveEnvironmentStatus(environment, state, pendingExecutions),
      updatedAt: state?.updatedAt ?? latestExecution?.completedAt ?? latestExecution?.startedAt,
    };
  });
}

function dedupeExecutions(executions: ApiDeploymentExecution[]) {
  const byId = new Map<string, ApiDeploymentExecution>();
  for (const execution of executions) {
    byId.set(execution.deploymentExecutionId, execution);
  }
  return [...byId.values()].sort((left, right) => new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime());
}

function groupExecutionsByEnvironment(executions: ApiDeploymentExecution[]) {
  const grouped = new Map<string, ApiDeploymentExecution[]>();
  for (const execution of executions) {
    const existing = grouped.get(execution.environmentId) ?? [];
    existing.push(execution);
    grouped.set(execution.environmentId, existing);
  }
  for (const values of grouped.values()) {
    values.sort((left, right) => new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime());
  }
  return grouped;
}

function deriveEnvironmentStatus(environment: ApiEnvironment, state: ApiEnvironmentState | undefined, pendingExecutions: ApiDeploymentExecution[]): EnvironmentStatusKind {
  if (!environment.active) {
    return "idle";
  }
  if (state?.status === "failed" || state?.status === "cancelled") {
    return "failed";
  }
  if (pendingExecutions.length || state?.status === "pending" || state?.status === "claimed" || state?.status === "running") {
    return "pending";
  }
  if (state?.status === "idle") {
    return "idle";
  }
  return "healthy";
}

function executionToEnvironmentStatus(status: ApiDeploymentExecution["status"]): EnvironmentStatusKind {
  if (status === "failed" || status === "cancelled") {
    return "failed";
  }
  if (status === "pending" || status === "claimed" || status === "running") {
    return "pending";
  }
  return "healthy";
}

function buildActivities(row: EnvironmentRow) {
  const latest = row.latestExecution
    ? [
        {
          id: row.latestExecution.deploymentExecutionId,
          icon: row.latestExecution.status === "failed" ? AlertTriangle : CheckCircle2,
          tone: row.latestExecution.status === "failed" ? "text-red-500" : "text-emerald-600",
          title: `Deployment ${row.latestExecution.deploySetId} ${row.latestExecution.status}`,
          subtitle: `${row.latestExecution.items.length} component actions requested`,
          time: row.latestExecution.completedAt ?? row.latestExecution.startedAt,
        },
      ]
    : [];
  const pending = row.pendingExecutions.slice(0, 3).map((execution) => ({
    id: execution.deploymentExecutionId,
    icon: Hourglass,
    tone: "text-blue-600",
    title: `Execution ${execution.deploymentExecutionId} pending`,
    subtitle: `${execution.items.length} component actions awaiting runner claim`,
    time: execution.startedAt,
  }));
  return [...latest, ...pending].slice(0, 5);
}

function percentage(value: number, total: number) {
  if (!total) {
    return "0% of environments";
  }
  return `${Math.round((value / total) * 1000) / 10}% of environments`;
}
