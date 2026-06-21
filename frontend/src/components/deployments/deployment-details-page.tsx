import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { AlertTriangle, ArrowLeft, Box, CircleSlash, Clock3, FileText, Package, Radio, RefreshCcw, Server, UserRound } from "lucide-react";

import { ApiErrorPanel, EmptyPanel, LoadingPanel, PageHeader } from "@/components/common/api-state";
import { ReportedActionBadge, RequestedActionBadge, StatusBadge } from "@/components/deployments/status-badge";
import { Button } from "@/components/ui/button";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EntityLink } from "@/components/ui/entity-link";
import { ScrollFade } from "@/components/ui/scroll-fade";
import { TagList } from "@/components/ui/tag-list";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { WorkspaceLink as Link } from "@/components/ui/workspace-link";
import {
  getDeployment,
  listDeployments,
  listEvents,
  cancelDeployment,
  queryKeys,
  type ApiDeployment,
  type ApiDeploymentItem,
  type ApiEventLogEntry,
  ApiRequestError,
} from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { formatDateTime } from "@/lib/format";
import { useToast } from "@/components/ui/toast";
import { canCancelDeployments } from "@/lib/user-permissions";
import { formatRelativeTime } from "@/lib/format";

export function DeploymentDetailsPage({ deploymentId }: { deploymentId: string }) {
  const query = useQuery({
    queryKey: queryKeys.execution(deploymentId),
    queryFn: () => getDeployment(deploymentId),
    retry: 1,
    refetchInterval: (query) => (["pending", "claimed", "in-progress"].includes(query.state.data?.status ?? "") ? 5_000 : false),
    refetchIntervalInBackground: true,
  });
  if (query.isLoading) return <LoadingPanel label="Loading deployment..." />;
  if (query.error) return <ApiErrorPanel error={query.error} onRetry={() => query.refetch()} />;
  if (!query.data) return <EmptyPanel label="Deployment execution not found." />;

  return <ExecutionDetailsView execution={query.data} onRefresh={() => query.refetch()} />;
}

function ExecutionDetailsView({ execution, onRefresh }: { execution: ApiDeployment; onRefresh: () => Promise<unknown> }) {
  const queryClient = useQueryClient();
  const auth = useAuth();
  const toast = useToast();
  const canReadEvents = Boolean(auth.user?.permissions?.includes("events:read"));
  const canCancel = canCancelDeployments(auth.user) && ["pending", "claimed", "in-progress"].includes(execution.status);
  const eventQuery = useQuery({
    queryKey: queryKeys.events({ resourceType: "deployment", resourceId: execution.deploymentId, limit: 50 }),
    enabled: canReadEvents,
    queryFn: () => listEvents({ resourceType: "deployment", resourceId: execution.deploymentId, limit: 50 }),
    refetchInterval: ["pending", "claimed", "in-progress"].includes(execution.status) ? 5_000 : false,
    refetchIntervalInBackground: true,
  });
  const executionsQuery = useQuery({
    queryKey: queryKeys.executions(execution.environmentId),
    queryFn: () => listDeployments(execution.environmentId),
    refetchInterval: ["pending", "claimed", "in-progress"].includes(execution.status) ? 5_000 : false,
    refetchIntervalInBackground: true,
  });
  const cancelMutation = useMutation({
    mutationFn: () => cancelDeployment(execution.deploymentId),
    onSuccess: async () => {
      toast({
        variant: "success",
        title: "Deployment cancelled",
        description: `Execution ${execution.deploymentId} is now cancelled.`,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.execution(execution.deploymentId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.executions() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.environmentCenter }),
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
  const claimedByRunners = Array.from(new Set(execution.items.map((item) => item.claimedBy).filter((value): value is string => Boolean(value))));
  const currentVersions = new Map(
    executionsQuery.data
      ?.find((candidate) => candidate.deploymentId !== execution.deploymentId)
      ?.items.map((item) => [item.componentId, item.version]) ?? [],
  );
  const events = eventQuery.data?.events ?? [];

  return (
    <div className="flex h-[calc(100vh-108px)] min-h-0 flex-col overflow-hidden">
      <PageHeader
        title={`Deployment: ${execution.deploymentId}`}
        subtitle="Deployment execution details, component actions, and event history."
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => void Promise.all([onRefresh(), eventQuery.refetch(), executionsQuery.refetch()])}
            >
              <RefreshCcw className="h-4 w-4" />
              Refresh
            </Button>
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
          to="/releases/$releaseId"
          params={{ releaseId: execution.releaseId }}
          className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <ExecutionFactCard
            icon={Package}
            label="Release"
            value={execution.releaseId}
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
            <div className="flex flex-wrap gap-2">
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
                label="Release"
                value={
                  <EntityLink kind="release" to="/releases/$releaseId" params={{ releaseId: execution.releaseId }}>
                    {execution.releaseId}
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
              <MetaRow
                icon={Server}
                label="Claims"
                value={
                  claimedByRunners.length === 1 ? (
                    <EntityLink kind="runner" to="/deployment-runners/$runnerId" params={{ runnerId: claimedByRunners[0] }}>
                      {claimedByRunners[0]}
                    </EntityLink>
                  ) : claimedByRunners.length > 1 ? (
                    "multiple runners"
                  ) : (
                    "unclaimed"
                  )
                }
              />
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
    <ScrollFade className="h-full" contentClassName="space-y-3 pb-4">
      {events.map((event) => (
        <EventLogItem
          key={event.eventId}
          title={event.summary}
          subtitle={event.actorPrincipalId}
          time={formatDateTime(event.occurredAt)}
        />
      ))}
    </ScrollFade>
  );
}

function SyntheticExecutionEvents({ execution }: { execution: ApiDeployment }) {
  const claimedByRunners = Array.from(new Set(execution.items.map((item) => item.claimedBy).filter((value): value is string => Boolean(value))));
  return (
    <ScrollFade className="h-full" contentClassName="space-y-3 pb-4">
      <EventLogItem
        title={`Execution ${execution.status}`}
        subtitle={execution.force ? "Force deployment enabled" : "Standard deployment"}
        time={formatDateTime(execution.startedAt)}
      />
      <hr />
      <EventLogItem
        title={claimedByRunners.length === 1 ? `Claimed by ${claimedByRunners[0]}` : "Component-level claims"}
        subtitle={`Requested by ${execution.requestedBy}`}
        time={formatDateTime(execution.startedAt)}
      />
      <hr />
      {execution.items.map((item) => (
        <div key={item.componentId}>
          <EventLogItem
            title={item.message ?? item.failureReason ?? item.error ?? item.runnerReason ?? `${item.componentId} ${item.status}`}
            subtitle={item.reportedBy ?? item.claimedBy ?? "unclaimed"}
            time={formatDateTime(item.claimedAt ?? execution.startedAt)}
          />
          <hr />
        </div>
      ))}
      <EventLogItem
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
  rows: ApiDeploymentItem[];
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
          <TableHead>Claimed By</TableHead>
          <TableHead>Started</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.componentId}>
            <TableCell className="font-semibold">
              <div className="flex flex-wrap items-center gap-1">
                <EntityLink kind="component" to="/components/$componentId" params={{ componentId: row.componentId }}>
                  {row.componentId}
                </EntityLink>
                {row.runnerMatchWarning ? (
                  <span
                    aria-label="No matching runner found"
                    title="No matching runner found"
                    className="inline-flex h-4 w-4 items-center justify-center text-yellow-600"
                  >
                    <AlertTriangle className="h-3 w-3" />
                  </span>
                ) : null}
              </div>
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
            <TableCell>
              {row.claimedBy ? (
                <EntityLink kind="runner" to="/deployment-runners/$runnerId" params={{ runnerId: row.claimedBy }}>
                  {row.claimedBy}
                </EntityLink>
              ) : (
                <span className="text-slate-400">unclaimed</span>
              )}
            </TableCell>
            <TableCell>{formatRelativeTime(row.claimedAt, { mode: "short" })}</TableCell>
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
  title,
  subtitle,
  time,
}: {
  title: string;
  subtitle: string;
  time: string;
}) {
  return (
    <div className="rounded-lg p-3">
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-slate-900">{title}</div>
        <div className="mt-1 truncate text-xs leading-5 text-slate-600">{subtitle}</div>
        <div className="mt-2 text-xs font-medium text-slate-500">{time}</div>
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
      <EntityLink kind="version" to="/versions/$componentId/$version" params={{ componentId, version: targetVersion }}>
        {targetVersion}
      </EntityLink>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-1">
      <EntityLink
        kind="version"
        to="/versions/$componentId/$version"
        params={{ componentId, version: currentVersion }}
      >
        {currentVersion}
      </EntityLink>
      <span className="shrink-0 text-slate-400">-&gt;</span>
      <EntityLink
        kind="version"
        to="/versions/$componentId/$version"
        params={{ componentId, version: targetVersion }}
      >
        {targetVersion}
      </EntityLink>
    </div>
  );
}



