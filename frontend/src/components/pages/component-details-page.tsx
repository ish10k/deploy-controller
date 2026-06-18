import { useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Boxes, CalendarClock, FileText, GitCommitHorizontal, Package, Server, Tag } from "lucide-react";

import { ApiErrorPanel, EmptyPanel, LoadingPanel, PageHeader } from "@/components/common/api-state";
import { ReleaseDrawer } from "@/components/pages/releases-page";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EntityLink } from "@/components/ui/entity-link";
import { ScrollFade } from "@/components/ui/scroll-fade";
import { TagList } from "@/components/ui/tag-list";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createRelease, getComponent, listReleases, queryKeys, type ApiComponent, type ApiRelease } from "@/lib/api-client";
import { formatRelativeTime } from "@/lib/format";

export function ComponentDetailsPage({ componentId }: { componentId: string }) {
  const query = useQuery({
    queryKey: ["components", "detail", componentId],
    queryFn: async () => {
      const [component, releases] = await Promise.all([getComponent(componentId), listReleases(componentId)]);
      return {
        component,
        releases: [...releases].sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
      };
    },
    retry: 1,
  });

  if (query.isLoading) return <LoadingPanel label="Loading component details..." />;
  if (query.error) return <ApiErrorPanel error={query.error} onRetry={() => query.refetch()} />;
  if (!query.data?.component) return <EmptyPanel label={`Component ${componentId} was not found.`} />;

  return <ComponentDetailsView component={query.data.component} releases={query.data.releases} />;
}

function ComponentDetailsView({ component, releases }: { component: ApiComponent; releases: ApiRelease[] }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [releaseOpen, setReleaseOpen] = useState(false);
  const latestRelease = releases[0];
  const latestReleaseByComponent = useMemo(() => {
    const latest = new Map<string, ApiRelease>();
    if (latestRelease) {
      latest.set(component.componentId, latestRelease);
    }
    return latest;
  }, [component.componentId, latestRelease]);
  const mutation = useMutation({
    mutationFn: createRelease,
    onSuccess: async (release) => {
      setReleaseOpen(false);
      await queryClient.invalidateQueries({ queryKey: queryKeys.releases(component.componentId) });
      await queryClient.invalidateQueries({ queryKey: ["components", "detail", component.componentId] });
      await navigate({ to: "/releases/$componentId/$version", params: { componentId: release.componentId, version: release.version } });
    },
  });

  return (
    <div className="flex h-[calc(100vh-108px)] min-h-0 flex-col overflow-hidden">
      <PageHeader
        title={component.componentId}
        subtitle="Component metadata, release history, and delivery context."
        action={
          <div className="flex gap-2">
            <Button className="px-4" onClick={() => setReleaseOpen(true)}>
              <GitCommitHorizontal className="h-4 w-4" />
              Release
            </Button>
            <Link to="/components">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4" />
                Back to components
              </Button>
            </Link>
          </div>
        }
      />

      <div className="grid shrink-0 grid-cols-3 gap-4">
        <FactCard icon={Server} label="Type" value={component.type ?? "Unspecified"} sublabel={component.active ? "Active component" : "Inactive component"} />
        {latestRelease ? (
          <Link
            to="/releases/$componentId/$version"
            params={{ componentId: latestRelease.componentId, version: latestRelease.version }}
            className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <FactCard icon={Package} label="Latest Release" value={latestRelease.version} sublabel={formatRelativeTime(latestRelease.createdAt, { mode: "short" })} interactive />
          </Link>
        ) : (
          <FactCard icon={Package} label="Latest Release" value="None" sublabel="No releases yet" />
        )}
        <FactCard icon={Boxes} label="Releases" value={String(releases.length)} sublabel="Versions registered" />
      </div>

      <div className="mt-4 grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_380px] gap-4">
        <Card className="flex min-h-0 flex-col overflow-hidden">
          <CardHeader>
            <CardTitle>Release history</CardTitle>
          </CardHeader>
          <CardContent className="min-h-0 flex-1 overflow-hidden p-0">
            {releases.length ? (
              <ScrollFade className="h-full" contentClassName="px-4 pb-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Version</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Artifact</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {releases.map((release) => (
                      <TableRow key={release.version}>
                        <TableCell>
                          <EntityLink
                            kind="release"
                            to="/releases/$componentId/$version"
                            params={{ componentId: release.componentId, version: release.version }}
                          >
                            {release.version}
                          </EntityLink>
                        </TableCell>
                        <TableCell>{formatRelativeTime(release.createdAt, { mode: "short" })}</TableCell>
                        <TableCell className="max-w-[260px] truncate">{release.artifact.key}</TableCell>
                        <TableCell className="max-w-[300px] truncate">{release.notes ?? "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollFade>
            ) : (
              <div className="p-4">
                <EmptyPanel label="No releases have been registered for this component." />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Component metadata</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <MetaRow icon={Package} label="Component" value={component.componentId} />
            <MetaRow icon={Server} label="Type" value={component.type ?? "Unspecified"} />
            <MetaRow
              icon={CalendarClock}
              label="Latest"
              value={
                latestRelease ? (
                  <EntityLink
                    kind="release"
                    to="/releases/$componentId/$version"
                    params={{ componentId: latestRelease.componentId, version: latestRelease.version }}
                  >
                    {latestRelease.version}
                  </EntityLink>
                ) : (
                  "None"
                )
              }
            />
            <MetaRow icon={FileText} label="Description" value={latestRelease?.description ?? "None"} multiline />
            <div className="grid grid-cols-[120px_1fr] gap-3">
              <span className="flex items-start gap-2 font-semibold text-slate-700">
                <Tag className="mt-0.5 h-4 w-4 text-slate-500" />
                Tags
              </span>
              <TagList tags={component.tags} emptyLabel="No tags" />
            </div>
          </CardContent>
        </Card>
      </div>
      <ReleaseDrawer
        componentOptions={[component.componentId]}
        latestReleaseByComponent={latestReleaseByComponent}
        open={releaseOpen}
        onClose={() => setReleaseOpen(false)}
        onSubmit={(release) => mutation.mutate(release)}
        pending={mutation.isPending}
        initialComponentId={component.componentId}
        lockComponent
      />
    </div>
  );
}

function FactCard({
  icon: Icon,
  label,
  value,
  sublabel,
  interactive = false,
}: {
  icon: typeof Server;
  label: string;
  value: string;
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
          <div className="mt-1 truncate text-lg font-bold text-slate-950">{value}</div>
          <div className="mt-1 truncate text-sm text-slate-600">{sublabel}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function MetaRow({ icon: Icon, label, value, multiline = false }: { icon: typeof Package; label: string; value: React.ReactNode; multiline?: boolean }) {
  return (
    <div className={`grid grid-cols-[120px_1fr] gap-3 ${multiline ? "items-start" : "items-center"}`}>
      <span className={`flex gap-2 font-semibold text-slate-700 ${multiline ? "items-start" : "items-center"}`}>
        <Icon className="h-4 w-4 text-slate-500" />
        {label}
      </span>
      <span className={`text-slate-800 ${multiline ? "whitespace-pre-wrap break-words" : "min-w-0 truncate"}`}>{value}</span>
    </div>
  );
}
