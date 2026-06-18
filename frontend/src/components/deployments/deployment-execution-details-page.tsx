import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { ArrowLeft, Box, CircleSlash, Clock3, FileText, Network, Package, Radio, Server, UserRound, Zap } from "lucide-react";

import { ApiErrorPanel, EmptyPanel, LoadingPanel, PageHeader } from "@/components/common/api-state";
import { ReportedActionBadge, RequestedActionBadge, StatusBadge } from "@/components/deployments/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EntityLink } from "@/components/ui/entity-link";
import { ScrollFade } from "@/components/ui/scroll-fade";
import { TagList } from "@/components/ui/tag-list";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  getDeploymentExecution,
  listDeploymentExecutions,
  listEvents,
  cancelDeploymentExecution,
  queryKeys,
  type ApiDeploymentExecution,
  type ApiDeploymentExecutionItem,
  type ApiEventLogEntry,
  ApiRequestError,
} from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { formatDateTime } from "@/lib/format";
import { useToast } from "@/components/ui/toast";
import { canCancelDeployments } from "@/lib/user-permissions";

export function DeploymentExecutionDetailsPage({ deploymentExecutionId }: { deploymentExecutionId: string }) {
  const query = useQuery({
    queryKey: queryKeys.execution(deploymentExecutionId),
    queryFn: () => getDeploymentExecution(deploymentExecutionId),
    retry: 1,
  });

  if (query.isLoading) return <LoadingPanel label="Loading deployment execution..." />;
  if (query.error) return <ApiErrorPanel error={query.error} onRetry={() => query.refetch()} />;
  if (!query.data) return <EmptyPanel label="Deployment execution not found." />;

  return <ExecutionDetailsView execution={query.data} />;
}

function ExecutionDetailsView({ execution }: { execution: ApiDeploymentExecution }) {
  const queryClient = useQueryClient();
  const auth = useAuth();
  const toast = useToast();
  const canReadEvents = Boolean(auth.user?.permissions.includes("events:read"));
  const canCancel = canCancelDeployments(auth.user) && ["pending", "claimed", "running"].includes(execution.status);
  const eventQuery = useQuery({
    queryKey: queryKeys.events({ resourceType: "deploymentExecution", resourceId: execution.deploymentExecutionId, limit: 50 }),
    enabled: canReadEvents,
    queryFn: () => listEvents({ resourceType: "deploymentExecution", resourceId: execution.deploymentExecutionId, limit: 50 }),
  });
  const executionsQuery = useQuery({
    queryKey: queryKeys.executions(execution.environmentId),
    queryFn: () => listDeploymentExecutions(execution.environmentId),
  });
  const cancelMutation = useMutation({
    mutationFn: () => cancelDeploymentExecution(execution.deploymentExecutionId),
    onSuccess: async () => {
      toast({
        variant: "success",
        title: "Deployment cancelled",
        description: `Execution ${execution.deploymentExecutionId} is now cancelled.`,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.execution(execution.deploymentExecutionId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.executions(execution.environmentId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(execution.environmentId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.pendingExecutions }),
        queryClient.invalidateQueries({ queryKey: ["events"] }),
      ]);
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: "Unable to cancel deployment",
        description: error instanceof ApiRequestError ? error.message : "The deployment could not be cancelled.",
      });
    },
  });
  const driftCount = execution.items.filter((item) => item.driftDetected).length;
  const failedCount = execution.items.filter((item) => item.status === "failed").length;
  const succeededCount = execution.items.filter((item) => item.status === "succeeded").length;
  const currentVersions = new Map(
    executionsQuery.data
      ?.find((candidate) => candidate.deploymentExecutionId !== execution.deploymentExecutionId)
      ?.items.map((item) => [item.componentId, item.version]) ?? [],
  );
  const events = eventQuery.data?.events ?? [];

  return (
    <div className="flex h-[calc(100vh-108px)] min-h-0 flex-col overflow-hidden">
      <PageHeader
        title={`Deployment: ${execution.deploymentExecutionId}`}
        subtitle="Deployment execution details, component actions, and event history."
        action={
          <div className="flex gap-2">
            <Link to="/deployments">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4" />
                Back to deployments
              </Button>
            </Link>
            {canCancel ? (
              <Button
                type="button"
                variant="outline"
                className="border-red-600 bg-red-600 text-white hover:border-red-700 hover:bg-red-700 hover:text-white"
                disabled={cancelMutation.isPending}
                onClick={() => cancelMutation.mutate()}
              >
                <CircleSlash className="h-4 w-4" />
                {cancelMutation.isPending ? "Cancelling..." : "Cancel deployment"}
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="grid shrink-0 grid-cols-3 gap-4">
        <ExecutionFactCard
          icon={Radio}
          label="Status"
          value={<StatusBadge status={execution.status} />}
          sublabel={execution.force ? "Force deployment" : "Standard deployment"}
        />
        <Link
          to="/deploysets/$deploySetId"
          params={{ deploySetId: execution.deploySetId }}
          className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <ExecutionFactCard
            icon={Package}
            label="DeploySet"
            value={execution.deploySetId}
            sublabel={`Environment ${execution.environmentId}`}
            interactive
          />
        </Link>
        <Link
          to="/environments/$environmentId"
          params={{ environmentId: execution.environmentId }}
          className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <ExecutionFactCard
            icon={Package}
            label="Environment"
            value={execution.environmentId}
            sublabel={`Requested by ${execution.requestedBy}`}
            interactive
          />
        </Link>
      </div>

      <div className="mt-4 grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_420px] gap-4">
        <Card className="flex min-h-0 flex-col overflow-hidden">
          <CardHeader>
            <CardTitle>Component actions</CardTitle>
            <div className="flex gap-2">
              <Badge variant="green">{succeededCount} succeeded</Badge>
              <Badge variant={failedCount ? "red" : "slate"}>{failedCount} failed</Badge>
              <Badge variant={driftCount ? "orange" : "slate"}>{driftCount} drift</Badge>
            </div>
          </CardHeader>
          <CardContent className="min-h-0 flex-1 overflow-hidden p-0">
            <ScrollFade className="h-full" contentClassName="px-4 pb-4">
        <ComponentActionsTable rows={execution.items} currentVersions={currentVersions} />
            </ScrollFade>
          </CardContent>
        </Card>

        <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Execution metadata</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <MetaRow
                icon={Box}
                label="DeploySet"
                value={
                  <EntityLink kind="deployset" to="/deploysets/$deploySetId" params={{ deploySetId: execution.deploySetId }}>
                    {execution.deploySetId}
                  </EntityLink>
                }
              />
              <MetaRow
                icon={Package}
                label="Environment"
                value={
                  <EntityLink kind="environment" to="/environments/$environmentId" params={{ environmentId: execution.environmentId }}>
                    {execution.environmentId}
                  </EntityLink>
                }
              />
              <MetaRow icon={UserRound} label="Requested by" value={execution.requestedBy} />
              <MetaRow icon={FileText} label="Notes" value={execution.notes ?? "None"} />
              <MetaRow icon={Server} label="Claimed by" value={execution.claimedBy ?? "unclaimed"} />
              <MetaRow icon={FileText} label="Tags" value={<TagList tags={execution.tags} emptyLabel="No tags" />} />
              <MetaRow icon={Clock3} label="Started" value={formatDateTime(execution.startedAt)} />
              <MetaRow icon={Clock3} label="Completed" value={formatDateTime(execution.completedAt)} />
            </CardContent>
          </Card>

          <Card className="flex min-h-0 flex-col overflow-hidden">
            <CardHeader>
              <CardTitle>Event log</CardTitle>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 overflow-hidden p-0">
              {events.length ? <AuditEventList events={events} /> : <SyntheticExecutionEvents execution={execution} />}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function AuditEventList({ events }: { events: ApiEventLogEntry[] }) {
  return (
    <ScrollFade className="h-full" contentClassName="space-y-3 px-4 pb-4">
      {events.map((event) => (
        <EventLogItem
          key={event.eventId}
          icon={Radio}
          title={event.summary}
          subtitle={event.actorPrincipalId}
          time={formatDateTime(event.occurredAt)}
        />
      ))}
    </ScrollFade>
  );
}

function SyntheticExecutionEvents({ execution }: { execution: ApiDeploymentExecution }) {
  return (
    <ScrollFade className="h-full" contentClassName="space-y-3 px-4 pb-4">
      <EventLogItem
        icon={Radio}
        title={`Execution ${execution.status}`}
        subtitle={execution.force ? "Force deployment enabled" : "Standard deployment"}
        time={formatDateTime(execution.startedAt)}
      />
      <hr />
      <EventLogItem
        icon={UserRound}
        title={execution.claimedBy ? `Claimed by ${execution.claimedBy}` : "Waiting for claim"}
        subtitle={`Requested by ${execution.requestedBy}`}
        time={execution.claimedBy ? formatDateTime(execution.startedAt) : "Pending"}
      />
      <hr />
      {execution.items.map((item, index) => (
        <div key={item.componentId}>
          <EventLogItem
            icon={item.componentId.includes("lambda") ? Zap : Network}
            title={`${item.componentId} ${item.status}`}
            subtitle={[
              `Requested ${item.requestedAction}`,
              item.reportedBy ? `reported by ${item.reportedBy}` : "awaiting runner report",
              item.message ?? item.error ?? item.runnerReason ?? "",
            ]
              .filter(Boolean)
              .join(" | ")}
            time={`Step ${index + 1}`}
            status={<StatusBadge status={item.status} />}
          />
          <hr />
        </div>
      ))}
      <EventLogItem
        icon={Clock3}
        title={execution.completedAt ? `Completed ${execution.status}` : "Execution still in progress"}
        subtitle={execution.completedAt ? "Final execution timestamp recorded" : "No completion timestamp yet"}
        time={execution.completedAt ? formatDateTime(execution.completedAt) : formatDateTime(execution.startedAt)}
      />
    </ScrollFade>
  );
}

export function ComponentActionsTable({
  rows,
  currentVersions,
}: {
  rows: ApiDeploymentExecutionItem[];
  currentVersions: Map<string, string>;
}) {
  if (!rows.length) return <EmptyPanel label="This execution has no item records." />;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Component</TableHead>
          <TableHead>Version</TableHead>
          <TableHead>Requested Action</TableHead>
          <TableHead>Reported Action</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Drift</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.componentId}>
            <TableCell className="font-semibold">
              <EntityLink kind="component" to="/components/$componentId" params={{ componentId: row.componentId }}>
                {row.componentId}
              </EntityLink>
            </TableCell>
            <TableCell>
              <VersionCell componentId={row.componentId} currentVersion={currentVersions.get(row.componentId)} targetVersion={row.version} />
            </TableCell>
            <TableCell>
              <RequestedActionBadge action={row.requestedAction} />
            </TableCell>
            <TableCell>
              <ReportedActionBadge action={row.reportedAction ?? "noop"} failed={row.status === "failed"} />
            </TableCell>
            <TableCell>
              <StatusBadge status={row.status} />
            </TableCell>
            <TableCell>{row.driftDetected ? <StatusBadge status="warning" /> : "-"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function ExecutionFactCard({
  icon: Icon,
  label,
  value,
  sublabel,
  interactive = false,
}: {
  icon: typeof Radio;
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
          <div className="mt-1 truncate text-lg font-bold text-blue-700">{value}</div>
          <div className="mt-1 truncate text-sm text-slate-600">{sublabel}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function MetaRow({ icon: Icon, label, value }: { icon: typeof Box; label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[130px_1fr] items-center gap-3">
      <span className="flex items-center gap-2 font-semibold text-slate-700">
        <Icon className="h-4 w-4 text-slate-500" />
        {label}
      </span>
      <span className="min-w-0 truncate text-slate-800">{value}</span>
    </div>
  );
}

function EventLogItem({
  icon: Icon,
  title,
  subtitle,
  time,
  status,
}: {
  icon: typeof Box;
  title: string;
  subtitle: string;
  time: string;
  status?: ReactNode;
}) {
  return (
    <div className="rounded-lg  p-3">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-slate-600 ring-1 ring-slate-200">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-slate-900">{title}</div>
              <div className="mt-1 text-xs leading-5 text-slate-600">{subtitle}</div>
            </div>
            {status ? <div className="shrink-0">{status}</div> : null}
          </div>
          <div className="mt-2 text-xs font-medium text-slate-500">{time}</div>
        </div>
      </div>
    </div>
  );
}

function VersionCell({
  componentId,
  currentVersion,
  targetVersion,
}: {
  componentId: string;
  currentVersion: string | undefined;
  targetVersion: string;
}) {
  if (!currentVersion || currentVersion === targetVersion) {
    return (
      <EntityLink kind="release" to="/releases/$componentId/$version" params={{ componentId, version: targetVersion }}>
        {targetVersion}
      </EntityLink>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-1">
      <EntityLink
        kind="release"
        to="/releases/$componentId/$version"
        params={{ componentId, version: currentVersion }}
      >
        {currentVersion}
      </EntityLink>
      <span className="shrink-0 text-slate-400">-&gt;</span>
      <EntityLink
        kind="release"
        to="/releases/$componentId/$version"
        params={{ componentId, version: targetVersion }}
      >
        {targetVersion}
      </EntityLink>
    </div>
  );
}
