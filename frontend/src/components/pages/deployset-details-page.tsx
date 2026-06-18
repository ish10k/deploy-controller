import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Boxes, CalendarClock, FileText, GitBranch, Layers3, PackageCheck, Server, Tag, UserRound } from "lucide-react";

import { ApiErrorPanel, EmptyPanel, LoadingPanel, PageHeader } from "@/components/common/api-state";
import { StatusBadge } from "@/components/deployments/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EntityLink } from "@/components/ui/entity-link";
import { ScrollFade } from "@/components/ui/scroll-fade";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  listComponentSets,
  listDeploymentExecutions,
  listDeploysets,
  listEnvironmentState,
  type ApiDeploySet,
} from "@/lib/api-client";
import { formatDateTime, formatRelativeTime } from "@/lib/format";

export function DeploySetDetailsPage({ deploySetId }: { deploySetId: string }) {
  const query = useQuery({
    queryKey: ["deploysets", "detail", deploySetId],
    queryFn: async () => {
      const [deploysets, componentSets, environmentState, executions] = await Promise.all([
        listDeploysets(),
        listComponentSets(),
        listEnvironmentState(),
        listDeploymentExecutions(),
      ]);

      const deployset = deploysets.find((entry) => entry.deploySetId === deploySetId);
      const componentSet = deployset ? componentSets.find((entry) => entry.componentSetId === deployset.componentSetId) : undefined;
      const activeEnvironments = environmentState.filter((state) => state.deploySetId === deploySetId);
      const relatedExecutions = executions.filter((execution) => execution.deploySetId === deploySetId);

      return { deployset, componentSet, activeEnvironments, relatedExecutions };
    },
    retry: 1,
  });

  if (query.isLoading) return <LoadingPanel label="Loading DeploySet details..." />;
  if (query.error) return <ApiErrorPanel error={query.error} onRetry={() => query.refetch()} />;
  if (!query.data?.deployset) return <EmptyPanel label={`DeploySet ${deploySetId} was not found.`} />;

  return (
    <DeploySetDetailsView
      deployset={query.data.deployset}
      componentCount={query.data.componentSet?.components.length ?? query.data.deployset.items.length}
      activeEnvironments={query.data.activeEnvironments}
      relatedExecutions={query.data.relatedExecutions}
    />
  );
}

function DeploySetDetailsView({
  deployset,
  componentCount,
  activeEnvironments,
  relatedExecutions,
}: {
  deployset: ApiDeploySet;
  componentCount: number;
  activeEnvironments: Awaited<ReturnType<typeof listEnvironmentState>>;
  relatedExecutions: Awaited<ReturnType<typeof listDeploymentExecutions>>;
}) {
  const explicitCount = deployset.items.filter((item) => item.source === "explicit").length;
  const inferredCount = deployset.items.filter((item) => item.source === "inferred").length;

  return (
    <div className="flex h-[calc(100vh-108px)] min-h-0 flex-col overflow-hidden">
      <PageHeader
        title={deployset.deploySetId}
        subtitle="Desired component-version state, lineage, and current runtime usage."
        action={
          <div className="flex gap-2">
            <Link to="/deploysets">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4" />
                Back to DeploySets
              </Button>
            </Link>
          </div>
        }
      />

      <div className="grid shrink-0 grid-cols-4 gap-4">
        <DeploySetFactCard icon={Layers3} label="Component Set" value={deployset.componentSetId} sublabel={`${componentCount} components included`} />
        <DeploySetFactCard icon={Boxes} label="Items" value={deployset.items.length.toString()} sublabel={`${explicitCount} explicit, ${inferredCount} inherited`} />
        <DeploySetFactCard icon={Server} label="Active Environments" value={activeEnvironments.length.toString()} sublabel="Currently pointing here" />
        <DeploySetFactCard icon={CalendarClock} label="Created" value={formatDateTime(deployset.createdAt)} sublabel={`By ${deployset.createdBy}`} />
      </div>

      <div className="mt-4 grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_380px] gap-4">
        <Card className="flex min-h-0 flex-col overflow-hidden">
          <CardHeader>
            <CardTitle>Component versions</CardTitle>
            <div className="flex gap-2">
              <Badge variant="blue">{explicitCount} explicit</Badge>
              <Badge variant={inferredCount ? "slate" : "green"}>{inferredCount} inherited</Badge>
            </div>
          </CardHeader>
          <CardContent className="min-h-0 flex-1 overflow-hidden p-0">
            <ScrollFade className="h-full" contentClassName="px-4 pb-4">
              <DeploySetItemsTable deployset={deployset} />
            </ScrollFade>
          </CardContent>
        </Card>

        <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-4">
          <Card>
            <CardHeader>
              <CardTitle>DeploySet metadata</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <MetaRow icon={PackageCheck} label="DeploySet" value={deployset.deploySetId} />
              <MetaRow
                icon={Layers3}
                label="Component Set"
                value={
                  <EntityLink kind="componentSet" to="/component-sets/$componentSetId" params={{ componentSetId: deployset.componentSetId }}>
                    {deployset.componentSetId}
                  </EntityLink>
                }
              />
              <MetaRow
                icon={GitBranch}
                label="Base DeploySet"
                value={
                  deployset.baseDeploySetId ? (
                    <EntityLink kind="deployset" to="/deploysets/$deploySetId" params={{ deploySetId: deployset.baseDeploySetId }}>
                      {deployset.baseDeploySetId}
                    </EntityLink>
                  ) : (
                    "None"
                  )
                }
              />
              <MetaRow
                icon={Server}
                label="Base Environment"
                value={
                  deployset.baseEnvironmentId ? (
                    <EntityLink kind="environment" to="/environments/$environmentId" params={{ environmentId: deployset.baseEnvironmentId }}>
                      {deployset.baseEnvironmentId}
                    </EntityLink>
                  ) : (
                    "None"
                  )
                }
              />
              <MetaRow icon={UserRound} label="Created by" value={deployset.createdBy} />
              <MetaRow icon={CalendarClock} label="Created" value={formatDateTime(deployset.createdAt)} />
              <MetaRow icon={FileText} label="Notes" value={deployset.notes ?? "None"} multiline />
              <div className="grid grid-cols-[140px_1fr] gap-3">
                <span className="flex items-start gap-2 font-semibold text-slate-700">
                  <Tag className="mt-0.5 h-4 w-4 text-slate-500" />
                  Tags
                </span>
                <TagList tags={deployset.tags} />
              </div>
            </CardContent>
          </Card>

          <Card className="flex min-h-0 flex-col overflow-hidden">
            <CardHeader>
              <CardTitle>Recent deployments</CardTitle>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 overflow-hidden p-0">
              <ScrollFade className="h-full" contentClassName="space-y-4 px-4 pb-4">
                {relatedExecutions.length ? (
                  <div className="space-y-2">
                    {relatedExecutions.slice(0, 8).map((execution) => (
                      <div key={execution.deploymentExecutionId}>
                        <div
                          className="block rounded-lg bg-white px-3 py-2 transition-colors hover:border-blue-200 hover:bg-blue-50/40"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <EntityLink kind="deployment" to="/deployments/$deploymentExecutionId" params={{ deploymentExecutionId: execution.deploymentExecutionId }}>
                              {execution.deploymentExecutionId}
                            </EntityLink>
                            <StatusBadge status={execution.status} />
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            {execution.environmentId} | {formatRelativeTime(execution.startedAt, { mode: "short" })}
                          </div>
                        </div>
                        <hr></hr>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No deployments reference this DeploySet yet.</p>
                )}
              </ScrollFade>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function DeploySetItemsTable({ deployset }: { deployset: ApiDeploySet }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Component</TableHead>
          <TableHead>Version</TableHead>
          <TableHead>Source</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {deployset.items.map((item) => (
          <TableRow key={item.componentId}>
            <TableCell>
              <EntityLink kind="component" to="/components/$componentId" params={{ componentId: item.componentId }}>
                {item.componentId}
              </EntityLink>
            </TableCell>
            <TableCell>
              <EntityLink
                kind="release"
                to="/releases/$componentId/$version"
                params={{ componentId: item.componentId, version: item.version }}
              >
                {item.version}
              </EntityLink>
            </TableCell>
            <TableCell>
              <Badge variant={item.source === "explicit" ? "blue" : "slate"}>{item.source}</Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function DeploySetFactCard({
  icon: Icon,
  label,
  value,
  sublabel,
}: {
  icon: typeof Layers3;
  label: string;
  value: string;
  sublabel: string;
}) {
  return (
    <Card className="h-[116px]">
      <CardContent className="flex h-full items-center gap-4 p-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
          <Icon className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-bold text-slate-950">{label}</div>
          <div className="mt-1 truncate text-lg font-bold text-slate-950">{value}</div>
          <div className="mt-1 truncate text-sm text-slate-600">{sublabel}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function MetaRow({ icon: Icon, label, value, multiline = false }: { icon: typeof PackageCheck; label: string; value: React.ReactNode; multiline?: boolean }) {
  return (
    <div className={`grid grid-cols-[140px_1fr] gap-3 ${multiline ? "items-start" : "items-center"}`}>
      <span className={`flex gap-2 font-semibold text-slate-700 ${multiline ? "items-start" : "items-center"}`}>
        <Icon className="h-4 w-4 text-slate-500" />
        {label}
      </span>
      <span className={`text-slate-800 ${multiline ? "whitespace-pre-wrap break-words" : "min-w-0 truncate"}`}>{value}</span>
    </div>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">{title}</h3>
      {children}
    </section>
  );
}

function TagList({ tags }: { tags?: Record<string, string> }) {
  const entries = Object.entries(tags ?? {});

  if (!entries.length) {
    return <span className="text-slate-500">No tags</span>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {entries.map(([key, value]) => (
        <span key={key} className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-600">
          {key}:{value}
        </span>
      ))}
    </div>
  );
}
