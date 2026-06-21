import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Boxes, CalendarClock, FileText, GitBranch, Layers3, PackageCheck, RefreshCcw, Rocket, Server, Tag, UserRound } from "lucide-react";

import { ApiErrorPanel, EmptyPanel, LoadingPanel, PageHeader } from "@/components/common/api-state";
import { StatusBadge } from "@/components/deployments/status-badge";
import { DeploymentWorkflowPage } from "@/components/pages/deployment-workflow-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EntityLink } from "@/components/ui/entity-link";
import { ScrollFade } from "@/components/ui/scroll-fade";
import { SideDrawer } from "@/components/ui/side-drawer";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TagList } from "@/components/ui/tag-list";
import { WorkspaceLink as Link } from "@/components/ui/workspace-link";
import {
  listReleases,
  listDeployments,
  listEnvironmentState,
  type ApiRelease,
} from "@/lib/api-client";
import { formatDateTime, formatRelativeTime } from "@/lib/format";

export function ReleaseDetailsPage({ releaseId }: { releaseId: string }) {
  const query = useQuery({
    queryKey: ["releases", "detail", releaseId],
    queryFn: async () => {
      const [releases, environmentState, executions] = await Promise.all([
        listReleases(),
        listEnvironmentState(),
        listDeployments(),
      ]);

      const release = releases.find((entry) => entry.releaseId === releaseId);
      const activeEnvironments = environmentState.filter((state) => state.releaseId === releaseId);
      const relatedExecutions = executions.filter((execution) => execution.releaseId === releaseId);

      return { release, activeEnvironments, relatedExecutions };
    },
    retry: 1,
  });
  if (query.isLoading) return <LoadingPanel label="Loading Release details..." />;
  if (query.error) return <ApiErrorPanel error={query.error} onRetry={() => query.refetch()} />;
  if (!query.data?.release) return <EmptyPanel label={`Release ${releaseId} was not found.`} />;

  return (
    <ReleaseDetailsView
      release={query.data.release}
      componentCount={query.data.release.items.length}
      activeEnvironments={query.data.activeEnvironments}
      relatedExecutions={query.data.relatedExecutions}
      onRefresh={() => query.refetch()}
    />
  );
}

function ReleaseDetailsView({
  release,
  componentCount,
  activeEnvironments,
  relatedExecutions,
  onRefresh,
}: {
  release: ApiRelease;
  componentCount: number;
  activeEnvironments: Awaited<ReturnType<typeof listEnvironmentState>>;
  relatedExecutions: Awaited<ReturnType<typeof listDeployments>>;
  onRefresh: () => Promise<unknown>;
}) {
  const queryClient = useQueryClient();
  const [deployOpen, setDeployOpen] = useState(false);
  const explicitCount = release.items.filter((item) => item.source === "explicit").length;
  const inferredCount = release.items.filter((item) => item.source === "inferred").length;

  return (
    <div className="flex h-[calc(100vh-108px)] min-h-0 flex-col overflow-hidden">
      <PageHeader
        title={`Release: ${release.releaseId}`}
        subtitle="Desired component-version state, lineage, and current runtime usage."
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => void onRefresh()}
            >
              <RefreshCcw className="h-4 w-4" />
              Refresh
            </Button>
            <Button className="px-4" onClick={() => setDeployOpen(true)}>
              <Rocket className="h-4 w-4" />
              Deploy
            </Button>
            <Link to="/releases">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4" />
                Back to Releases
              </Button>
            </Link>
          </div>
        }
      />

      <div className="grid shrink-0 grid-cols-4 gap-4">
        <ReleaseFactCard icon={Layers3} label="Release" value={release.releaseId} sublabel={`${componentCount} components included`} />
        <ReleaseFactCard icon={Boxes} label="Items" value={release.items.length.toString()} sublabel={`${explicitCount} explicit, ${inferredCount} inherited`} />
        <ReleaseFactCard icon={Server} label="Active Environments" value={activeEnvironments.length.toString()} sublabel="Currently pointing here" />
        <ReleaseFactCard icon={CalendarClock} label="Created" value={formatDateTime(release.createdAt)} sublabel={`By ${release.createdBy}`} />
      </div>

      <div className="mt-4 grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_380px] gap-4">
        <Card className="flex min-h-0 flex-col overflow-hidden">
          <CardHeader>
            <CardTitle>Component versions</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Badge variant="blue">{explicitCount} explicit</Badge>
              <Badge variant={inferredCount ? "slate" : "green"}>{inferredCount} inherited</Badge>
            </div>
          </CardHeader>
          <CardContent className="min-h-0 flex-1 overflow-hidden p-0">
            <ScrollFade className="h-full" contentClassName="px-4 pb-4">
              <ReleaseItemsTable release={release} />
            </ScrollFade>
          </CardContent>
        </Card>

        <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Release metadata</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <MetaRow icon={PackageCheck} label="Release" value={release.releaseId} />
              <MetaRow
                icon={Layers3}
                label="Release"
                value={
                  <EntityLink kind="release" to="/releases/$releaseId" params={{ releaseId: release.releaseId }}>
                    {release.releaseId}
                  </EntityLink>
                }
              />
              <MetaRow
                icon={GitBranch}
                label="Base Release"
                value={
                  release.baseReleaseId ? (
                    <EntityLink kind="release" to="/releases/$releaseId" params={{ releaseId: release.baseReleaseId }}>
                      {release.baseReleaseId}
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
                  release.baseEnvironmentId ? (
                    <EntityLink kind="environment" to="/environments/$environmentId" params={{ environmentId: release.baseEnvironmentId }}>
                      {release.baseEnvironmentId}
                    </EntityLink>
                  ) : (
                    "None"
                  )
                }
              />
              <MetaRow icon={UserRound} label="Created by" value={release.createdBy} />
              <MetaRow icon={CalendarClock} label="Created" value={formatDateTime(release.createdAt)} />
              <MetaRow icon={FileText} label="Notes" value={release.notes ?? "None"} multiline />
              <div className="grid grid-cols-[140px_1fr] gap-3">
                <span className="flex items-start gap-2 font-semibold text-slate-700">
                  <Tag className="mt-0.5 h-4 w-4 text-slate-500" />
                  Tags
                </span>
                <TagList tags={release.tags} />
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
                      <div key={execution.deploymentId}>
                        <div
                          className="block rounded-lg bg-white px-3 py-2 transition-colors hover:border-blue-200 hover:bg-blue-50/40"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <EntityLink kind="deployment" to="/deployments/$deploymentId" params={{ deploymentId: execution.deploymentId }}>
                              {execution.deploymentId}
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
                  <p className="text-sm text-slate-500">No deployments reference this Release yet.</p>
                )}
              </ScrollFade>
            </CardContent>
          </Card>
        </div>
      </div>

      <SideDrawer
        open={deployOpen}
        title="Deploy Release"
        description="Create a deployment from this Release."
        maxWidth="max-w-[860px]"
        onClose={() => setDeployOpen(false)}
      >
        <DeploymentWorkflowPage
          showHeader={false}
          initialReleaseId={release.releaseId}
          lockTarget
          onCancel={() => setDeployOpen(false)}
          onCreated={() => setDeployOpen(false)}
        />
      </SideDrawer>
    </div>
  );
}

function ReleaseItemsTable({ release }: { release: ApiRelease }) {
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
        {release.items.map((item) => (
          <TableRow key={item.componentId}>
            <TableCell>
              <EntityLink kind="component" to="/components/$componentId" params={{ componentId: item.componentId }}>
                {item.componentId}
              </EntityLink>
            </TableCell>
            <TableCell>
              <EntityLink
                kind="version"
                to="/versions/$componentId/$version"
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

function ReleaseFactCard({
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



